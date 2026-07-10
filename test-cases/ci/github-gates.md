# GitHub Gate Regression Cases

## Preconditions

- Node/npm match `.nvmrc` and `package.json`.
- Dependencies installed with `npm ci`.
- No uncommitted generated output.

## Local command cases

1. `npm run lint` and `npm run format:check` exit zero.
2. `npm run typecheck` reports TypeScript 7.0.2 and exits zero.
3. `npm run test:unit` executes source and ESLint-rule suites without the E2E file.
4. `npm run test:e2e` executes `test/app.e2e-spec.ts` without Playwright.
5. `npm run test:coverage` executes the complete suite and enforces thresholds.
6. `npm run build` creates `dist/src/main.js` through TypeScript 7.
7. `npm run security:audit` and `npm run security:scan` report no blocking finding.

## Workflow cases

For each pull request, `main` push, and manual dispatch:

- all seven expected jobs are created;
- every job uses Node from `.nvmrc` and `npm ci`;
- stale runs are cancelled per workflow/ref;
- a failed command fails its job;
- no job uses `continue-on-error`;
- the E2E job installs no browser;
- fork pull requests run Trivy but skip privileged SARIF upload;
- same-repository events publish `trivy-fs` SARIF.

## Branch-protection cases

After activation, verify pending/failing checks block merge and all seven green checks plus required review permit merge. Follow [`runbooks/github-required-checks.md`](../../runbooks/github-required-checks.md).
