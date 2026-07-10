# 08 — Architecture Review

## Current context

CI/CD is an operational layer around the existing NestJS architecture. No controller/application/domain/persistence/integration boundary changes.

## Boundary impact

- GitHub workflows may invoke only public `package.json` scripts.
- Security upload receives `security-events: write`; all other jobs use `contents: read`.
- E2E remains backend-only and exercises production `createApp()` wiring.
- Workflow concurrency is isolated by workflow/ref and cancels stale runs.

## Contract changes

Stable required-check names become an operational contract:

- `lint`
- `typecheck`
- `test:unit`
- `test:e2e`
- `test:coverage`
- `build`
- `security:scan`

## ADR

No ADR required: this implements existing CI/CD policy rather than changing application architecture.

## Risks

Action-version availability, npm/network failures, SARIF permission differences, and check-name drift. Mitigated through reviewed versions, timeouts, minimal permissions, and documented names.
