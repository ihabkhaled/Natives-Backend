# 19 — Threat Model

## Assets and trust boundaries

- Source, lockfile, workflow definitions, GitHub token, Actions logs, cache, and SARIF results.
- Trust transitions: contributor code → GitHub runner → npm registry/action repositories → code scanning.

## Threats and mitigations

- Malicious dependency/action update → lockfile, `npm ci`, Dependabot review, minimal permissions, audit, and Trivy.
- Secret disclosure → no workflow secrets, Trivy secret scanning, no debug dumps.
- Privilege escalation → read-only contents permission; only security workflow receives `security-events: write`.
- Gate bypass → no `continue-on-error`; stable required-check names; documented branch protection.
- Stale/duplicate execution → workflow/ref concurrency with cancellation.
- Fork-token misuse → SARIF upload skipped for fork pull requests; blocking local scan still runs.
- Dependency metadata falsification → generated lockfile only; manual peer-range edits prohibited.

## Residual risk

Marketplace actions use reviewed major/version tags rather than immutable SHAs, and branch protection is not active until first remote checks run. Dependabot and owner review mitigate version drift; branch-protection activation is a post-push gate.
