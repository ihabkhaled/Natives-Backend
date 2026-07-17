# 19 — Security Review

## Reviewed

- Workflow token permissions and fork behavior
- dependency/install reproducibility
- npm install-script allow/deny policy
- audit and Trivy failure behavior
- SARIF publication
- secrets/config usage
- bypass and lockfile-integrity risks

## Findings

- No critical/high dependency or Trivy finding.
- No workflow secret is required.
- No `continue-on-error`, legacy peer bypass, or manual lock metadata override remains.
- Required native build scripts are explicitly allowed; Scarf telemetry is denied.
- SARIF write permission is isolated to the security workflow.

## Decision

Approved for push. Branch-protection activation remains conditional on a green first remote run.
