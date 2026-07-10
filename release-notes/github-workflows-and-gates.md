# Draft — GitHub Workflows and Gates

## Summary

IronNest will add seven independent GitHub Actions checks for lint/format, typecheck, unit tests, backend E2E tests, coverage, build, and security scanning.

## Operator impact

- Pull requests and pushes to `main` will run clean-environment checks on Node 24 LTS.
- Dependency audit and Trivy HIGH/CRITICAL findings will block the security job.
- Trivy will publish SARIF for same-repository events.
- Dependabot will check npm and GitHub Actions weekly.
- The backend E2E gate uses Vitest/Supertest; no Playwright browser or report is installed.

## Activation

After the workflows are pushed and complete successfully once, administrators can require the seven stable check names by following [`runbooks/github-required-checks.md`](../runbooks/github-required-checks.md).

## Rollback

Remove obsolete required-check entries before reverting or renaming workflow jobs so `main` is never locked behind a check that cannot run.

## Status

Draft until owner review, first green GitHub-hosted execution, and branch-protection approval.
