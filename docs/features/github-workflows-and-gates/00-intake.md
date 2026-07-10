# 00 — Intake: GitHub Workflows and Gates

## Request metadata

- Request ID: `OPS-2026-07-10-GITHUB-GATES`
- Title: Add GitHub Actions workflows and merge gates for IronNest
- Type: infrastructure / CI/CD / security / developer experience
- Source: repository owner
- Delivery track: standard
- Severity: high—required checks are currently absent
- Urgency: high
- Owners: repository owner (approval), AI-assisted delivery agent (implementation), GitHub Actions (execution)

## Scope

Mirror the reviewer-friendly TwinzyAI gate layout for this NestJS backend:

- lint plus formatting
- strict typecheck
- unit/static-rule tests
- backend E2E tests through Nest/Fastify/Supertest
- coverage
- build
- dependency audit plus Trivy/SARIF security scan
- npm and GitHub Actions Dependabot updates
- documented required-check names and branch-protection setup

## Explicit constraint

No Playwright installation, dependency, report, or browser workflow. No commit, push, branch-protection mutation, or other GitHub write before owner review.

## Initial findings

- IronNest has no `.github/workflows/`.
- `main` is not branch-protected.
- Existing local scripts/hooks cover lint/typecheck/coverage/build but CI does not reproduce them.
- Dependabot has an empty package ecosystem and is non-functional.
- `.nvmrc` is missing and the current `node >=20` claim is stale. CI must pin the current Node 24 LTS patch and align npm/tooling metadata.
- Existing backend E2E coverage is `test/app.e2e-spec.ts`; Playwright is not installed or needed.
