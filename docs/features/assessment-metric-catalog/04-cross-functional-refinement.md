# Cross-functional refinement

- Product: keep legacy 0–5 while exposing timed/count/percentage/categorical/text scale kinds.
- Engineering: create an `assessments` bounded module; reuse UnitOfWork, Clock, IdGenerator, audit,
  outbox, auth guards, and team/season tables through stable IDs.
- QA: prove null/zero semantics at the policy/contract boundary, weight totals, period dates,
  archive-in-use, stale versions, deterministic paging, and cross-team denial.
- Security: team/season scope comes only from validated path/query values; out-of-scope resources
  resolve to not-found; audit payloads contain identifiers and state only.
- Operations: additive reversible migration; seeded rows are deterministic/idempotent by stable
  keys; no backfill or new configuration.
- Analytics/support: stable keys and versions are reporting dimensions; metric dictionary and
  rollback runbook are required.

Decision: template metric references pin a concrete metric-definition row/version. Published
templates are immutable; later edits create another template version. No unresolved requirement
blocks implementation. Formal independent approvals remain release gates.

