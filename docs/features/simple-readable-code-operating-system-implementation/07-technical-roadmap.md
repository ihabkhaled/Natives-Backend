# 07 — Technical Roadmap

## Engineering slices

1. Governance owners: rules 25–30, indexes, and cross-links.
2. Procedures/maps: missing skills, declaration/refactor/security/validation/agent navigation, memory decisions, and compact entrypoint pointers.
3. Static guardrails: custom-rule extensions, package boundaries, config activation tests.
4. Auth contracts: shared role/permission values, auth-owned interfaces/constants/mappers/validators.
5. Vendor adapters: JWT signing/verification and bcrypt comparison; module wiring.
6. Guards/decorators: public/current-user/permission guard ownership and typed errors.
7. Articles: owner-scoped repository methods, pre-pagination filtering, mapped model result, tests.
8. DTO/config/reference cleanup: `declare` fields, complete environment schema/tests, stale env removal, correct examples.
9. Full gates and post-implementation artifacts.

## Branch and merge strategy

Work remains uncommitted in the current clean `main` worktree because the user did not request a branch or commit. Changes are kept responsibility-grouped for review. No hook bypass is permitted.

## Schema evolution

Not applicable: in-memory stores only; no database schema or migration. Accepted by repository architect.

## Rollout sequence

Merge governance/enforcement/source/tests/docs as one coherent delivery so no code or rule is temporarily inconsistent. Deploying the reference app requires no flag or migration.

## Rollback sequence

1. Revert runtime/refactor files and their tests together.
2. Revert static-rule/config tests together.
3. Revert governance/index/mirror/docs changes together.
4. Restore `.env.example` only with matching config behavior.

No persisted data rollback is required.

## Compatibility

HTTP route and response shapes remain stable. Deliberate error keys and owner-scoped behavior become safer and are covered by e2e/unit tests. Internal role-based exports may be replaced by permission-based equivalents; all repository consumers are updated in the same change.
