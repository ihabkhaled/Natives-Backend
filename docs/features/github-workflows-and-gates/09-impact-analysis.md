# 09 — Impact Analysis

## Affected

- CI/CD and repository controls
- Node/npm bootstrap compatibility
- dependency maintenance
- security scanning/code scanning
- test execution topology
- contributor, review, release, and support documentation

## Not affected

Application API, database, migrations, auth behavior, tenant isolation, configuration schema, runtime infrastructure, analytics, localization, or user workflows.

## Backward compatibility

Contributors need Node `24.18.0` LTS and npm `>=11.16.0`. TypeScript API consumers remain compatible through Microsoft’s side-by-side package while the authoritative typecheck/build commands use TypeScript 7.0.2.

## Operational impact

Seven clean jobs each run `npm ci`, trading CI minutes for isolated failure ownership and parallel execution. Stale runs are cancelled. Security scan uploads SARIF.

## Support/training

Maintainers need the required-check runbook and must know that branch protection is intentionally deferred until after first successful remote runs.

## Compliance/privacy

No customer data is processed. Workflows use no repository secrets. Permissions remain least-privilege.
