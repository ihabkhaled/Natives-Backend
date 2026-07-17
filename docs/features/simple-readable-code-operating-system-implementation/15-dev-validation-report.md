# 15 — Developer Validation Report

## Validation summary

Local implementation and runtime validation are green. The suite exercises real Nest/Fastify routes, typed errors, permissions, ownership isolation, config validation, adapters, and static rules.

## Commands and results

- `npm run format:check`: pass.
- `npm run lint`: pass, 0 errors/warnings (ESLint emitted only its non-gating poor-concurrency advisory).
- `npm run typecheck`: pass (`tsgo --noEmit`).
- `npm run test`: pass, 36 files / 262 tests.
- `npm run test:coverage`: pass; 99.6% statements, 100% functions, 99.6% lines, 94.93% measured branches.
- `npm run build`: pass.
- `npm run security:scan`: pass; 0 HIGH/CRITICAL vulnerabilities, 0 detected secrets, 0 detected misconfigurations in the scanned targets.
- `npm run deps:check`: pass as an inventory command; newer package releases are available and intentionally not upgraded in this refactor.

## Functional evidence

- Login: valid 200/token; invalid credentials 401 with `errors.auth.invalidCredentials`.
- Auth: missing token 401 with `errors.auth.tokenRequired`; malformed/invalid payloads rejected.
- Authorization: missing role permission 403 with `errors.auth.permissionDenied`.
- Ownership: another owner receives 404; list scope and total are filtered before pagination.
- Validation: invalid DTO and malformed UUID return typed validation keys.
- Config: malformed consumed values and weak/missing production JWT secret fail validation.
- Vendors: JWT/bcrypt package-boundary tests reject imports from services/guards/repositories.
- Static enforcement: anonymous layer types, DTO assertions, method budgets, aliases, private layers, re-exports, dynamic/template imports, nested globs, and vendor subpaths have regression tests.
- Hardening review: required `NODE_ENV`/secret, 15–30-minute JWT lifetime, bcrypt 72-byte bound, forwarded-IP trust disabled, and recursive redacted Error diagnostics are covered.

## Operational checks

E2E logs were inspected in command output: authorization is `[Redacted]`; no password/JWT secret/token value was logged. No schema, migration, queue, or external network dependency was introduced.

## Coverage interpretation

Touched application logic has 99.6% statements/lines and 100% functions; measured branches are 94.93%. Remaining gaps are decorator-transform synthetic branches. Custom ESLint MJS is validated by RuleTester and real resolved-config activation because it loads outside the application V8 transform.

## Defects found

Implementation defects discovered and fixed are recorded in `16-dev-bug-log.md`. No open local blocking defect remains.
