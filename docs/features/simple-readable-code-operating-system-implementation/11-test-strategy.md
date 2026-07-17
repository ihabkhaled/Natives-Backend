# 11 — Test Strategy

## Requirement-to-test mapping

- Inline type literals/definite assignment/layer budgets: custom RuleTester and resolved-config activation tests.
- JWT/bcrypt package ownership: import-boundary RuleTester cases plus whole-repo lint.
- JWT adapter: sign success, valid verified payload, malformed payload, and vendor failure normalization.
- Password adapter: matching and non-matching password behavior.
- Identity validator/mapper: valid and malformed payload scenarios.
- Permission helper/guard: no requirement, allowed role, denied role, missing identity, and central map behavior.
- Auth service: valid login, unknown user, wrong password, typed error key, app-owned token/password ports.
- JWT guard: public, missing header, malformed bearer header, invalid token, valid identity attachment.
- Articles repository/service: owner-scoped id access, cross-owner non-disclosure, owner filtering before pagination, cap/defaults/order.
- DTOs: existing e2e validation continues after replacing `!` with declarations.
- Config: parser behavior; every consumed variable; invalid bounds/booleans/enums/URLs; production missing/weak secret.
- Error mapping/e2e: specific auth keys, sanitized bodies, permission denial, owner isolation, unchanged success responses.
- Docs/mirrors: format and link/consistency review.

## Test layers

- Unit: pure validators, mappers, helpers, adapters, services, repositories, guards, config.
- Static unit: ESLint custom rules and config activation.
- Integration/e2e: Nest module wiring, global guard order, login, protected article routes, validation, persistence result.
- Regression: full existing suite and focused changed-module tests.
- Security: negative token, permission, ownership, secret-validation, and package-boundary cases.

## Negative and boundary cases

Missing/malformed authorization, malformed JWT payload, unknown role, permission denial, cross-owner article id/list, `limit` above max, invalid offset, invalid env numbers/boolean/log level/origin, production placeholder secret, and unknown exceptions.

## Environment and data

Local Windows workspace, current Node/npm constraints, in-memory repositories, deterministic reference user/hash, generated JWT through the owned adapter. Tests remain isolated and reset mocks/stores.

## Coverage

Touched logic targets 95% lines/functions/statements and existing 90% branch floor; security-critical validators/guards/adapters should be scenario-complete. No waiver planned.

## Migration/rollback tests

No data migration. Rollback is validated by unchanged public success contracts and responsibility-sliced changes that can be reverted together.

## Evidence

Focused test outputs during implementation and final `lint`, `typecheck`, `test`, `test:coverage`, `build`, `security:scan`, `format:check`, and `deps:check` results in phase 15.
