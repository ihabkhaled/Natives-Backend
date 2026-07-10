# 01 — Business Analysis

## Problem

Local hooks are strong, but merge eligibility is not independently reproduced in a clean environment. A contributor can push directly to unprotected `main`, and repository configuration currently promises CI that does not exist.

## Stakeholders

Backend engineers, reviewers, security/platform owners, support, and AI coding agents.

## Desired state

Every pull request and push to `main` runs visible, independent, binary GitHub checks using the same `package.json` scripts as local development. Required-check names are stable and documented.

## Success metrics

- Seven workflows parse and run without Playwright.
- Clean `npm ci` bootstrap on the pinned Node runtime.
- Every existing authoritative gate remains green.
- Dependabot creates grouped npm updates and GitHub Actions updates.
- Branch-protection instructions name the exact required checks.

## Assumptions and dependencies

- GitHub-hosted Ubuntu runners and repository Actions are available.
- GitHub code scanning accepts Trivy SARIF when `security-events: write` is permitted.
- Branch protection is applied only after workflows are reviewed and pushed.

## Risk of not delivering

False local-green confidence, inconsistent contributor environments, direct unverified merges, stale dependencies/actions, and no GitHub-visible security gate.
