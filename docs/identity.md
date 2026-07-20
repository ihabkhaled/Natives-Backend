# Identity, Invitations, Authentication & Recovery

The `identity` module (`src/modules/identity`) owns invitation-based accounts and
the full session lifecycle for Ultimate Natives: invitations, authentication,
refresh-session rotation with reuse detection, logout, and password recovery. It
builds on the prompt-100 persistence layer (raw parameterized SQL through the
vendor-free `UnitOfWorkPort`) and the `auth` module's JWT and bcrypt ports. There
is **no open self-registration** — accounts exist only by invitation.

## Data model (migration `1721300000000-identity-schema`)

All tables use UUID primary keys (`gen_random_uuid()` from the pgcrypto
baseline), `timestamptz` in UTC, and snake_case columns.

| Table                   | Purpose                                                                                                                                                                             |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `users`                 | Account + status (`invited`/`active`/`inactive`/`suspended`/`left`), soft-delete `deleted_at`, optimistic `version`. Partial unique index on `lower(email)` where not soft-deleted. |
| `password_credentials`  | bcrypt hash only (never plaintext). One row per user (unique `user_id`).                                                                                                            |
| `invitations`           | sha-256 `token_hash` (unique), `invited_by`, role, status, `expires_at`, `accepted_at`, `revoked_at`. Partial unique index on `lower(email)` where `status='pending'`.              |
| `refresh_sessions`      | sha-256 `token_hash` (unique), `family_id`, conservative `device_label`, `issued_at`, `expires_at`, `rotated_at`, `revoked_at`, `reuse_detected_at`.                                |
| `password_reset_tokens` | sha-256 `token_hash` (unique), `expires_at`, `consumed_at`.                                                                                                                         |
| `failed_login_state`    | Per-identity attempt counter + lockout window, keyed by `lower(email)` (unique).                                                                                                    |
| `security_events`       | Append-only audit log (`event_type`, `actor_user_id`, privacy-safe `context` jsonb, `occurred_at`).                                                                                 |

`email_verification_tokens` is intentionally **deferred** (optional in the spec);
add it with its own expand migration when email verification ships.

Migrate-from-empty and reversible rollback are proven in
`test/database/identity.integration.spec.ts`.

## Tokens: never plaintext, always hashed

- **Passwords** — bcrypt (cost 12) via `PASSWORD_HASH_PORT`. Only the hash is
  stored, returned, or logged.
- **Opaque tokens** (invitation, refresh, password-reset) — 32 bytes of CSPRNG
  entropy (`node:crypto` behind `SECURE_RANDOM_PORT`), base64url-encoded. Only
  the **sha-256 hex digest** is persisted (`hashOpaqueToken`). The plaintext is
  delivered out-of-band (a future notification port) and is **never persisted,
  logged, or returned by the create/resend/forgot endpoints**. Refresh/reset
  plaintext is returned exactly once to the caller that minted the session.
- **Access token** — short-lived JWT (`AUTH_TOKEN_PORT`) carrying `userId`,
  `email`, the minimal `roles` claim, and the issuing refresh-session `sessionId`.
  Existing tokens without `sessionId` remain valid until expiry, but cannot use
  revoke-others because the server will never guess which session to preserve.
  A successful login separately resolves the caller's effective global
  permission keys for immediate client hydration; permissions are never trusted
  back from the client.

## Token lifetimes (typed config, `src/config/identity.config.ts`)

| Setting                               | Default    | Env var                                |
| ------------------------------------- | ---------- | -------------------------------------- |
| Refresh session TTL                   | 14 days    | `IDENTITY_REFRESH_TOKEN_TTL_SECONDS`   |
| Invitation TTL                        | 7 days     | `IDENTITY_INVITATION_TTL_SECONDS`      |
| Password-reset TTL                    | 1 hour     | `IDENTITY_PASSWORD_RESET_TTL_SECONDS`  |
| Max failed login attempts (then lock) | 5          | `IDENTITY_MAX_FAILED_LOGIN_ATTEMPTS`   |
| Failed-login window                   | 15 minutes | `IDENTITY_FAILED_LOGIN_WINDOW_SECONDS` |
| Account lockout duration              | 15 minutes | `IDENTITY_ACCOUNT_LOCKOUT_SECONDS`     |

Access-token TTL remains `JWT_EXPIRES_IN_SECONDS` (security config). All values
are validated fail-fast in `environment-variables.dto.ts`.

## Endpoints

Base path `/api/v1`.

| Method & path                       | Auth                | Behaviour                                                                           |
| ----------------------------------- | ------------------- | ----------------------------------------------------------------------------------- |
| `POST /invitations`                 | `invitation:create` | Create a pending invitation (409 on active user/pending collision).                 |
| `POST /invitations/:id/resend`      | `invitation:create` | Rotate token + expiry on a pending invitation.                                      |
| `POST /invitations/:id/revoke`      | `invitation:revoke` | Revoke a pending invitation.                                                        |
| `POST /invitations/accept`          | public              | Atomic: create user + credential + activate + consume invitation; issues a session. |
| `POST /auth/login`                  | public              | Verify credentials; return nested tokens plus enriched user/permission state.       |
| `POST /auth/refresh`                | public              | Rotate the refresh session (reuse detection).                                       |
| `POST /auth/logout`                 | bearer              | Revoke the presented session.                                                       |
| `POST /auth/logout-all`             | bearer              | Revoke every session for the caller.                                                |
| `GET  /auth/me`                     | bearer              | Current principal; re-checks live user state.                                       |
| `GET  /auth/sessions`               | bearer + self scope | List active sessions in a bounded, ordered page.                                    |
| `POST /auth/sessions/:id/revoke`    | bearer + self scope | Revoke one session only when it belongs to the caller.                              |
| `POST /auth/sessions/revoke-others` | bearer + self scope | Revoke every other session while preserving the JWT session.                        |
| `GET  /auth/invitations/:token`     | public              | Inspect minimal pending-invitation details by a high-entropy opaque token.          |
| `POST /auth/forgot-password`        | public              | Always-generic acknowledgement (no enumeration).                                    |
| `POST /auth/reset-password`         | public              | Consume a one-time token; replace credential; revoke all sessions.                  |

## Threat model → mitigations

- **Account enumeration** — login returns an identical generic
  `errors.auth.invalidCredentials` for unknown account, wrong password, locked
  account, and non-active user. A missing credential is compared against a fixed
  dummy bcrypt hash so timing does not leak existence. `forgot-password` always
  returns the same acknowledgement whether or not the account exists.
- **Account takeover / brute force** — per-identity failed-login counter with a
  windowed lockout; strong password policy (min length + bcrypt byte bound); rate
  limiting via the global throttler; every login/refresh/invite/recovery emits a
  `security_events` row.
- **Refresh-token theft & replay** — refresh tokens are single-use and rotate on
  every refresh. Presenting an already-rotated/revoked token is **reuse**: the
  whole token family is revoked and a `session.reuseDetected` event recorded. The
  revocation is committed even though the caller receives a generic 401 (it is
  not rolled back by the error).
- **Session IDOR / invasive tracking** — session list and revoke SQL is scoped by
  the verified caller before count/order/pagination. Foreign and missing IDs
  return the same 404. The projection uses the user-supplied device label and
  issuance time only; it does not store or infer IP, location, fingerprint, or
  background activity.
- **Invitation-link disclosure** — the public lookup hashes the supplied token
  and returns only email, role, optional inviter display name, and expiry for a
  pending unexpired invitation. Every unknown, accepted, revoked, or expired
  token returns the same sanitized error. Team context is omitted because the
  current invitation schema has no team relationship. Before pino writes the
  HTTP request record, the logger-owned serializer replaces the token path
  segment and censors request referrer headers. It retains the sanitized route
  alongside the standard method, request-id, status, and duration diagnostics.
- **One-time token races** — invitation-accept and password-reset lock the token
  row `FOR UPDATE` and guard on `accepted_at`/`consumed_at`, so a token is
  redeemed exactly once under concurrent requests (proven under a simulated race
  in the integration suite).
- **Session-outliving-reset** — a completed password reset revokes ALL of the
  user's sessions.
- **Mid-session state change** — `GET /me` and refresh re-check live user state;
  a deactivated/suspended/soft-deleted user is denied generically.
- **Secret exposure** — passwords and plaintext tokens are never persisted,
  logged, returned, or placed in fixtures; audit `context` payloads carry only
  ids/booleans, never emails or tokens; errors are typed `AppError` subclasses
  with stable `messageKey`s and never leak driver internals.

## Support & recovery runbook

- **Locked-out account** — the lockout auto-clears after
  `IDENTITY_ACCOUNT_LOCKOUT_SECONDS`; a successful login also clears the counter.
  Support can clear `failed_login_state` for the identity if warranted.
- **Compromised account** — inspect `GET /auth/sessions`, revoke an owned device
  with `POST /auth/sessions/:id/revoke`, or call `logout-all`, then trigger a
  password reset; the reset revokes all sessions.
- **Lost invitation** — resend (`POST /invitations/:id/resend`) issues a fresh
  token and expiry; the old link stops working. Stale pending invitations are
  swept to `expired` by `ExpireInvitationsUseCase`.
- **Forgotten password** — `POST /auth/forgot-password` then `reset-password`
  with the emailed one-time token.

## Synthetic seed credentials (tests & local only)

All fixtures use the reserved **`example.test`** domain and are deterministic —
never real users, phones, or emails. There is **no seeded production account**.

| Field    | Value                                             |
| -------- | ------------------------------------------------- |
| Admin    | `admin-<uuid>@example.test` (role `admin`)        |
| Member   | `player-<uuid>@example.test` (role `user`)        |
| Password | `correct-horse-battery-staple` (synthetic, tests) |

Tests freeze time via the `ClockPort`, generate ids via the `IdGeneratorPort`,
and inject a deterministic `SecureRandomPort` so token flows are reproducible
without ever exposing a real secret.

## Login response contract

`POST /api/v1/auth/login` intentionally differs from the flat session response
used by refresh and invitation acceptance. It is a coordinated breaking contract
for web/mobile clients:

```json
{
  "tokens": {
    "accessToken": "<jwt>",
    "refreshToken": "<opaque-token>"
  },
  "user": {
    "id": "<uuid>",
    "email": "member@example.test",
    "displayName": "Member",
    "permissions": ["practice.read", "team.read"],
    "accountState": "active",
    "onboardingComplete": true,
    "memberships": [
      {
        "membershipId": "<uuid>",
        "teamId": "<uuid>",
        "teamSlug": "ultimate-natives",
        "teamName": "Ultimate Natives",
        "seasonId": "<uuid|null>",
        "seasonSlug": "2026",
        "seasonName": "Season 2026",
        "status": "active",
        "roles": ["coach", "member"]
      }
    ]
  }
}
```

Internal `active` maps to client `active`, `invited` maps to `pending`, and all
other non-authenticating lifecycle states map to `suspended`. Permission keys are
sorted for deterministic clients.

### `memberships` — the principal's team contexts

`GET /api/v1/auth/me` returns the same `user` payload, and both routes populate
`memberships` from real data. This is what lets a client establish a team context
instead of guessing.

- **Self-scoped by construction.** The user id comes from the verified token and is
  passed to the members public surface (`MembershipContextService`), so a principal can
  only ever see their own memberships. Soft-deleted rows are excluded; the read is
  bounded (`MEMBERSHIP_CONTEXT_MAX`).
- **Two bounded queries, never one per membership.** One join over
  `memberships → teams → seasons`, plus one read of the caller's live role assignments
  through the RBAC public surface. The projection itself is pure
  (`lib/membership-payload.mapper.ts`).
- **Season context is resolved, not invented.** A membership bound to a season reports it.
  A team-level membership reports the team's season covering today, falling back to the
  latest non-archived season. A team with no season at all reports
  `seasonId`/`seasonSlug`/`seasonName` as `null` — never a blank placeholder.
- **Status is the real lifecycle state** (`invited`, `active`, `inactive`, `suspended`,
  `left`, `archived`, `anonymized`), so a client can render a suspended membership
  honestly instead of hiding it.
- **`roles` is informational.** It carries the lower-snake role slugs live in that
  team/season scope (see [`member-roles.md`](./member-roles.md)) so navigation can be
  shaped without a second round trip. Authorization is always decided from
  `permissions`, never from these slugs.
- A principal with no memberships gets `[]`.

## Explicit local administrator bootstrap

There is no default administrator password. To provision or deliberately rotate
the local bootstrap administrator, set `SEED_ADMIN_PASSWORD` at command runtime
and run `npm run seed:admin` after migrations, or use the complete
`npm run db:setup` workflow. The command is idempotent: it restores the matching
non-deleted account to active/admin, replaces its password hash, and ensures one
global `TEAM_ADMIN` assignment. Never run it against a shared environment
without explicit operator approval.
