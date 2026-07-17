# 06 — Technical Refinement

## Reference reviewed

TwinzyAI `main`:

- `gate-build.yml`
- `gate-coverage.yml`
- `gate-e2e.yml`
- `gate-lint.yml`
- `gate-security-scan.yml`
- `gate-typecheck.yml`
- `gate-unit-tests.yml`
- npm plus GitHub Actions Dependabot configuration

## Chosen adaptation

Keep the same independent gate topology and action versions. Replace the Playwright workflow with a backend Vitest/Supertest E2E command. Omit frontend-only dead-code, circular, accessibility, mobile, and Playwright report steps.

## Alternatives rejected

- One monolithic workflow: slower feedback and less stable required-check ownership.
- Matrix workflow: check names and failure ownership become less obvious.
- Playwright: no browser/frontend exists.
- New quality dependencies: violates reuse/minimalism for concerns already covered by strict ESLint and architecture rules.

## Toolchain decision

Pin `.nvmrc` to Node `24.18.0` LTS and engines to `>=24.18.0 <25` with npm `>=11.16.0`.

Use Microsoft’s supported TypeScript 7 transition layout:

- `@typescript/native` aliases TypeScript `7.0.2` and owns the `tsc` executable used by typecheck/build.
- `typescript` aliases `@typescript/typescript6` only for Nest CLI, typescript-eslint, SonarJS, and other compiler-API consumers.

Rejected: forcing incompatible peers, enabling `legacy-peer-deps`, or editing lockfile peer metadata. Those approaches can hide install errors but cannot restore APIs absent from TypeScript 7.

## Open questions

None blocking implementation. Branch protection and SARIF repository settings require owner review after push.
