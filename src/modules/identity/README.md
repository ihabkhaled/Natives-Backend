# Identity module

Identity owns invitation-based accounts, credential authentication, refresh
sessions, recovery, security-event recording, and the login client projection.

## Boundaries

- Controllers delegate once to application use cases.
- Persistence uses the vendor-free unit-of-work port through identity-owned
  repositories.
- JWT and password hashing are consumed through the `@modules/auth` public
  ports.
- Effective permissions are consumed through the core resolver port provided by
  `RbacModule`; identity never imports RBAC services or repositories.
- Public cross-module exports are limited to `IdentityModule`, the client
  `AccountState`, `UserStatus`, and the typed `LoginResponse`.

## Session and invitation projections

- `GET /auth/sessions` is bounded and owner-scoped. It exposes only a supplied
  device label, issuance time, and whether the signed access-token `sessionId`
  matches; no IP, location, or fingerprint is collected.
- Revoke-one uses `session id + authenticated user id` in the database predicate,
  so foreign and missing IDs have the same not-found result.
- Revoke-others requires the access token's current-session claim and refuses
  legacy claims instead of risking revocation of the current device.
- Public invitation inspection is token-hash based and returns a minimal pending
  projection. It deliberately omits team name because invitations do not own a
  team relationship.
- The HTTP logger replaces the opaque segment in
  `/auth/invitations/:token` before pino serialization while preserving request
  method, sanitized route, request id, status, and duration. Request referrer
  headers are censored because the web invitation link also carries the token.

## Login contract

Login returns `{ tokens, user }`. `user.permissions` is server-resolved and
sorted; `accountState` collapses internal statuses to
`active | pending | suspended`; `memberships` is empty until a members-owned
projection is available. Refresh and invitation acceptance intentionally retain
their existing flat session response. See `docs/identity.md` and
`docs/features/remote-auth-bootstrap/`.

## Validation

Core scenarios live in `application/login.use-case.spec.ts`,
the session/invitation use-case and repository specs,
`lib/identity.mapper.spec.ts`, `test/database/identity.integration.spec.ts`, and
`test/identity.e2e-spec.ts`.
