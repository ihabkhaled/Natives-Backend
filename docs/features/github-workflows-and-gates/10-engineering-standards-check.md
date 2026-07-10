# 10 — Engineering Standards Check

## Required standards

- CI invokes authoritative npm scripts, not shadow commands.
- `npm ci` uses the committed lockfile.
- Runtime is pinned and engines agree with tool requirements.
- Workflows have minimal permissions, explicit timeouts, concurrency cancellation, and no `continue-on-error`.
- Pull requests, `main` pushes, and manual dispatch are covered.
- Security findings at configured severity fail the job.
- No Playwright or frontend-only command is introduced.
- Documentation, runbook, release note, Dependabot, and configuration change together.
- No commit/push or external repository mutation before review.

## Permanent-rule decision

No new permanent policy is needed; this delivery implements the existing CI/CD, local-gate, security, documentation, and rollback rules in `claude.md`.

## Review matrix

- Architecture: no application-layer change
- Security: least privilege and SARIF reviewed
- Testing: independent unit/E2E/coverage gates
- Operations: check names and branch-protection order documented
- Maintainability: one concern per workflow, shared script ownership in `package.json`
