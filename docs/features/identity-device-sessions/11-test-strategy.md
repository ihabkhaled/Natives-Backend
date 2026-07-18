# 11 Test strategy

- Unit: auth identity accepts valid optional session IDs and rejects malformed claims; issuer signs the
  persisted session ID; repository SQL is bounded, ordered, parameterized, active-only, and owner-scoped.
- Application: list maps conservative rows/current state; revoke-one audits owned success and returns the
  same not-found for missing/foreign; revoke-others preserves current, handles zero, and rejects legacy
  claims; invitation lookup accepts pending/unexpired and generically denies every other state.
- HTTP/E2E: 401 without access token, list response/current flag, cross-user revoke returns 404 without
  mutation, revoke-others preserves current, invalid page/token validation, public invitation lifecycle.
- Integration/persistence: existing PostgreSQL identity suite verifies persisted revocation/audit effects
  when the test database is reachable.
- Regression: login, refresh rotation/reuse, logout, invitation accept, forgot/reset, JWT verification.
- Security: no raw token in SQL projections, responses, errors, audit context, or logs.
- Logger unit/E2E: ordinary URLs remain unchanged; invitation URLs redact only
  the opaque segment; a real pino-http request log contains the method,
  sanitized route, and request id without the raw token.

Synthetic UUIDs and the injected clock keep tests deterministic. Unavailable DB execution is reported
as unverified/skipped with its environment reason, never as a pass.
