# 11 — Test Strategy

## Requirement-to-test mapping

- Unit split: run `npm run test:unit`; prove E2E file is excluded while source and ESLint-rule suites execute.
- Backend E2E: run `npm run test:e2e`; prove Nest/Fastify/Supertest flow passes without Playwright.
- Coverage: run complete `npm run test:coverage`; enforce configured thresholds.
- Lint/format/type/build: run each authoritative command.
- Security: run npm audit and Trivy when available; inspect SARIF command parity.
- Workflow syntax: format-check all YAML and inspect triggers, permissions, concurrency, action versions, and commands.
- Lock/bootstrap: run `npm ci` semantics through an unchanged lockfile or package-lock-only regeneration.

## Negative and edge cases

- Search workflows/package scripts for `playwright`.
- Ensure no workflow uses `continue-on-error`.
- Ensure security write permission is absent from non-security jobs.
- Ensure E2E command targets only backend E2E tests.
- Ensure every workflow has a finite timeout and stable job name.

## Evidence

Record commands, pass/fail status, environment, and any external tool limitation in `15-dev-validation-report.md`.
