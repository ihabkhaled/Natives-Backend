# 11 — Test Strategy

## Requirement mapping

- Seed config: defaults for synthetic email/display name; missing/blank/weak password rejection; explicit runtime values accepted.
- Database ensure: existing DB no-op; missing DB creates after strict identifier validation; unsafe name and connection/query failures reject.
- Runtime provider: initializes the configured data source without invoking database creation.
- Seed: existing/new user paths, password credential update/insert, missing RBAC role, one global role assignment, commit/rollback/release.
- Mapper: active/pending/suspended states, display-name fallback, tokens, permissions, onboarding flag, empty memberships.
- Login use case: resolver called only on success; exact nested response; denied paths do not resolve permissions.
- HTTP/E2E: exact nested contract, no top-level tokens, nested refresh-token consumption, authenticated follow-up.

## Layers

- Unit: config, ensure helper with pg boundary doubled, seed functions, mapper, use case.
- Integration: identity persistence lifecycle and RBAC-backed permission resolution.
- E2E: real Nest pipeline and PostgreSQL contract where the test database is available.

Negative/security cases: unknown/wrong/suspended/locked login, unsafe database identifier, missing seed password, missing role, transaction failure, and credential non-disclosure.

Environment: unit tests require no database. Integration/E2E use disposable `_test` PostgreSQL and may skip only with the repository’s established explicit unreachable message.
