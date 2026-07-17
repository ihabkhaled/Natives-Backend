# 04 — Cross-Functional Refinement

## Findings

- Engineering: use repository scripts; do not embed divergent commands.
- QA: separate unit/static tests from backend E2E while coverage still runs the complete suite.
- Security: npm audit and Trivy are both required; SARIF upload needs scoped write permission.
- Platform: pin current Node `24.18.0` LTS with `.nvmrc` and npm `>=11.16.0`.
- Tooling: run TypeScript 7.0.2 for CLI typecheck/build while retaining the vendor-supported TypeScript 6 compatibility API for tools that import `typescript`.
- Release: branch protection is currently absent and must be configured only after the check names exist remotely.
- Documentation/support: README, quality-gate docs, runbook, and release notes change together.

## Integration points

`package.json`, lockfile root metadata, `.nvmrc`, Dependabot, seven workflows, Husky/local gates, testing docs, and GitHub branch protection.

## Decisions

- Follow TwinzyAI’s separate-workflow pattern.
- Replace Playwright E2E with `test/app.e2e-spec.ts`.
- Do not add dead-code/circular tools that IronNest does not currently own.
- Do not mutate repository settings or push during this delivery.
