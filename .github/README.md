# GitHub Automation

This directory owns repository-level dependency maintenance and clean-environment quality gates. Workflows call the public scripts in [`package.json`](../package.json); they must not grow a second, divergent implementation of a local check.

## Required workflows

- `gate-lint.yml` → check `lint` → `npm run lint` and `npm run format:check`
- `gate-typecheck.yml` → check `typecheck` → `npm run typecheck`
- `gate-unit-tests.yml` → check `test:unit` → `npm run test:unit`
- `gate-e2e.yml` → check `test:e2e` → `npm run test:e2e`
- `gate-coverage.yml` → check `test:coverage` → `npm run test:coverage`
- `gate-build.yml` → check `build` → `npm run build`
- `gate-security-scan.yml` → check `security:scan` → npm audit, blocking Trivy scan, and Trivy SARIF upload

Every workflow runs for pull requests, pushes to `main`, and manual dispatch. Jobs pin Node through [`.nvmrc`](../.nvmrc), install with `npm ci`, have finite timeouts, cancel stale runs, and receive only the permissions they need.

## Backend E2E boundary

IronNest has no browser application. The E2E gate runs the Nest/Fastify/Supertest suite in `test/app.e2e-spec.ts`. Do not add Playwright, browser installation, or Playwright report steps unless a separately approved frontend scope is introduced.

## Required-check setup

Do not configure branch protection until these files have been reviewed, pushed, and all seven checks have completed successfully at least once. Then follow [`runbooks/github-required-checks.md`](../runbooks/github-required-checks.md).

## Dependency maintenance

[`dependabot.yml`](dependabot.yml) checks npm dependencies and GitHub Actions weekly. Minor and patch npm updates are grouped to reduce review noise.

## Extension rules

1. Add or change the authoritative npm script first.
2. Keep one stable required-check name per independent concern.
3. Keep default permissions read-only; grant writes only to the step that needs them.
4. Never use `continue-on-error` for a required gate.
5. Update this file, quality-gate documentation, runbook, and branch-protection settings when a required check changes.
