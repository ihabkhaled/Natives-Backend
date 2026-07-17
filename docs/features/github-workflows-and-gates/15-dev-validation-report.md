# 15 — Developer Validation Report

## Environment

- Date: 2026-07-10
- OS: Windows
- Node: 24.18.0 LTS
- npm: 11.16.0
- Typecheck/build CLI: TypeScript 7.0.2
- Tooling API compatibility: `@typescript/typescript6`

## Evidence

- `npm outdated --json` → `{}`.
- `npm ci --dry-run` → pass without legacy-peer bypass.
- `npm run lint` → pass.
- `npm run typecheck` → pass with TypeScript 7.0.2.
- `npm run test:unit` → 35 files / 247 tests pass.
- `npm run test:e2e` → 1 file / 15 tests pass.
- `npm run test:coverage` → 36 files / 262 tests pass; 99.6% statements/lines, 94.93% branches, 100% functions.
- `npm run build` → pass with `tsc -p tsconfig.build.json`.
- `npm exec -- nest build -p tsconfig.build.json` → pass through the compatibility API; the original Nest CLI crash is resolved.
- `npm run security:audit` → zero vulnerabilities.
- `npm run security:scan` → zero HIGH/CRITICAL vulnerabilities, secrets, or misconfigurations.
- GitHub action release checks → checkout v7, setup-node v6, CodeQL v4, and setup-trivy v0.3.1 are current major/reference versions.

## Acceptance validation

- Seven independent workflows exist.
- Backend E2E uses Vitest/Supertest only.
- No Playwright command, dependency, browser install, or report exists.
- Jobs use minimal permissions, timeouts, concurrency cancellation, `.nvmrc`, npm cache, and `npm ci`.
- npm and GitHub Actions Dependabot entries are valid.

## Remaining external evidence

GitHub-hosted execution and SARIF upload can be proven only after push. Branch protection remains deferred until every check has run successfully once.
