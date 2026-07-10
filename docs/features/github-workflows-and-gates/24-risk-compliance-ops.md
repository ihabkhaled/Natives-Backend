# 24 — Risk, Compliance, and Operational Readiness

## Review

- Business risk: reduced through visible merge blocking.
- Technical risk: isolated jobs, pinned runtime, generated lockfile, finite timeouts.
- Security risk: least privilege, audit, Trivy, SARIF, no workflow secrets.
- Privacy/compliance: no customer data or regulated workflow introduced.
- Operational risk: stable check names, troubleshooting/runbook, rollback ordering.
- Supply-chain risk: Dependabot covers npm and GitHub Actions; current action releases were verified.

## Open operational item

`main` is not yet protected. This is intentional until GitHub observes one successful run for each check. The runbook defines activation and rollback.

## Decision

Ready for controlled push and first-run observation. Not ready to claim branch-protected enforcement until repository settings are applied and validated.
