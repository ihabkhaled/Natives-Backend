# Reusable Test Cases

Detailed repeatable cases are grouped by validation layer:

- `unit/` — isolated logic templates.
- `integration/` — module/persistence/integration templates.
- `e2e/` — full HTTP workflow templates.
- `business/` — business/UAT templates.
- `security/` — security templates and [auth-permission-ownership-regression.md](./security/auth-permission-ownership-regression.md).
- `ci/` — clean-environment and repository-control cases, including [github-gates.md](./ci/github-gates.md).

Each executed case records environment/build, setup, inputs, actual result, persisted state where relevant, telemetry/redaction checks, cleanup, and defect/retest evidence.
