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
  `email`, and the minimal `roles` claim. No RBAC catalog resolution here (that
  is prompt 102).

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

| Method & path                  | Auth                | Behaviour                                                                           |
| ------------------------------ | ------------------- | ----------------------------------------------------------------------------------- |
| `POST /invitations`            | `invitation:create` | Create a pending invitation (409 on active user/pending collision).                 |
| `POST /invitations/:id/resend` | `invitation:create` | Rotate token + expiry on a pending invitation.                                      |
| `POST /invitations/:id/revoke` | `invitation:revoke` | Revoke a pending invitation.                                                        |
| `POST /invitations/accept`     | public              | Atomic: create user + credential + activate + consume invitation; issues a session. |
| `POST /auth/login`             | public              | Verify credentials; issue access + refresh tokens.                                  |
| `POST /auth/refresh`           | public              | Rotate the refresh session (reuse detection).                                       |
| `POST /auth/logout`            | bearer              | Revoke the presented session.                                                       |
| `POST /auth/logout-all`        | bearer              | Revoke every session for the caller.                                                |
| `GET  /auth/me`                | bearer              | Current principal; re-checks live user state.                                       |
| `POST /auth/forgot-password`   | public              | Always-generic acknowledgement (no enumeration).                                    |
| `POST /auth/reset-password`    | public              | Consume a one-time token; replace credential; revoke all sessions.                  |

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
- **Compromised account** — call `POST /auth/logout-all` (or revoke sessions
  directly) and trigger a password reset; the reset revokes all sessions.
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
