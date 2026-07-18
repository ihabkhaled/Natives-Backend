# 23 — Documentation Changelog

## Updated

- `.env.example` — synthetic database example and blank runtime-only seed secret
- `README.md` — local PostgreSQL, setup, and idempotent administrator workflow
- `docs/database.md` — explicit database creation/migration/seed ownership and
  runtime least privilege
- `docs/identity.md` — breaking nested login contract, status mapping,
  permission resolution, and seed behavior
- `src/modules/identity/README.md` — module boundary, public surface, contract,
  and focused validation commands
- `docs/features/remote-auth-bootstrap/00`–`13` — intake through implementation
  readiness
- `docs/features/remote-auth-bootstrap/15`, `16`, `19`, and `23` — validation,
  defect, threat/security, and documentation evidence

## Contract note

`POST /api/v1/auth/login` now returns the documented nested
`{ tokens, user }` response. Consumers of the former top-level token fields must
read `response.tokens.accessToken` and `response.tokens.refreshToken`.
