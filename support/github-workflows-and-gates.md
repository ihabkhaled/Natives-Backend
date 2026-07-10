# GitHub Workflows and Gates — Support Guide

## Expected behavior

Every pull request and push to `main` starts seven independent checks. A red or pending required check blocks merge after branch protection is activated.

## First-response triage

1. Open the failed check and identify the exact npm command.
2. Reproduce with Node/npm versions from `.nvmrc` and `package.json`.
3. Run `npm ci`; do not repair CI with an uncommitted lockfile.
4. Fix the root cause and rerun the complete local gate set.
5. Treat repeated transient failures as defects, not permission to bypass.

## Routing

- Lint/typecheck/test/build failures → backend engineering.
- Coverage regression → change owner plus test reviewer.
- npm audit or Trivy finding → security owner.
- SARIF upload permission only → repository administrator; the blocking Trivy scan remains authoritative.
- Expected check never appears → repository administrator using [`runbooks/github-required-checks.md`](../runbooks/github-required-checks.md).

## Prohibited response

Do not mark checks optional, add `continue-on-error`, bypass hooks, force merge, or remove a rule to clear a deadline.
