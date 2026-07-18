# Implementation readiness

- Canonical policy, prompt, architecture, async/reliability rules, skills, pitfalls, current
  practices/platform code, migrations, and tests reviewed.
- Branch: `feat/ultimate-natives-completion`; shared dirty changes are preserved.
- Schema: additive feed-token and quiet-hours tables, indexed and reversible; no backfill.
- Config/dependency: none.
- Rollout: apply migration, deploy additive endpoints, run smoke/preview/test, then expose UI.
- Rollback: stop route traffic, revoke/delete feed rows, revert application, then migration down.
- Observability: safe admin preview/test response, outbox metrics/replay, delivery attempts, and
  correlation-aware existing request logging.
- Security: opaque raw token shown once, hash at rest, active membership recheck, generic invalid
  credential response, no PII/private calendar fields.
- Test scaffolding: unit, repository, integration, and E2E plan documented.
- Readiness decision: implementation may begin. Final release remains blocked until QA/security/UAT,
  exact-toolchain gates, contract regeneration, deployment smoke, and GO approval are recorded.
