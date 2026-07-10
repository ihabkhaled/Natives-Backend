# 03 — Product Requirements

## User stories

1. As a reviewer, I see an independent check for each material backend gate.
2. As a contributor, CI uses the same commands as local hooks and docs.
3. As a security owner, dependency audit and Trivy results block unsafe changes and publish SARIF.
4. As a maintainer, Dependabot updates npm and GitHub Actions weekly.

## Acceptance criteria

- Workflows run on pull requests, pushes to `main`, and manual dispatch.
- Jobs use the pinned `.nvmrc` runtime, npm cache, `npm ci`, minimal permissions, timeouts, and cancel-in-progress concurrency.
- Lint workflow runs `npm run lint` and `npm run format:check`.
- Typecheck workflow runs `npm run typecheck`.
- Unit workflow runs `npm run test:unit`.
- E2E workflow runs `npm run test:e2e` using Vitest/Supertest only.
- Coverage workflow runs `npm run test:coverage`.
- Build workflow runs `npm run build`.
- Security workflow runs `npm run security:audit`, Trivy, and SARIF upload.
- No Playwright reference exists.
- Dependabot covers npm and `github-actions`.
- Exact branch-protection check names are documented.

## Non-goals

Deployment, Docker/image scanning, Playwright/browser testing, environment promotion, release automation, or changing GitHub branch protection before review.
