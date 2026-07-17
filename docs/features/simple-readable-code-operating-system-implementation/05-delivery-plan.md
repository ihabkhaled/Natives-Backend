# 05 — Delivery Plan

## Workstreams and sequence

1. Audit all governance, runtime, test, and enforcement owners; record baseline gates.
2. Complete request artifacts `00`–`13`.
3. Extend rules, skills, practical docs, memory, context, and compact agent guidance.
4. Add focused static checks and tests for inline type literals, definite-assignment assertions, layer-size budgets, and vendor ownership where safe.
5. Refactor authentication/authorization adapters and contracts.
6. Refactor article ownership persistence, DTO declarations, config validation, and stale examples.
7. Run focused tests after each responsibility slice, then all gates.
8. Complete validation, defect, security, documentation, risk, and readiness evidence.

## Milestones

- M1: documented audit and implementation readiness.
- M2: governance and navigation aligned.
- M3: static enforcement tested.
- M4: source/test refactor green.
- M5: full validation and review evidence complete.

## Dependencies

Current package lock/toolchain, existing architecture plugin, Nest module wiring, and the previous simplicity request artifacts.

## Blockers

No implementation blocker identified. External QA/UAT/client/release approvals cannot be self-issued and will be recorded as pending/not applicable to local implementation.

## Approvals

Technical implementation may proceed once phase 13 confirms readiness. Merge/release remains subject to repository-owner review and the canonical governance gates.

## Rollout

Single repository change set. No feature flag or data migration. Consumers receive stricter lint and safer reference behavior after merge.

## Risk list

- Guard/provider order regression.
- JWT payload shape accepted without runtime validation.
- Permission-map drift.
- Owner-scoped pagination behavior change.
- Environment validation rejecting formerly tolerated invalid values.
- Documentation duplication or broken links.
- Over-extraction that makes navigation worse.

Each risk has targeted tests and a rollback path in phases 07, 11, and 13.
