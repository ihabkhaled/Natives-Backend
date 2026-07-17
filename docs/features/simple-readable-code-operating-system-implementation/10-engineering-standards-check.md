# 10 — Engineering Standards Check

## Standards matrix

- Strict TypeScript/no `any`/no assertions/suppressions: preserve; add definite-assignment coverage.
- Strict ESLint 0 warnings: preserve; new checks are errors and tested.
- Layer architecture: preserve; core must not depend on feature internals.
- Zero inline declarations: extend to inline type literals in implementation layers.
- Declaration ownership: constants/types/interfaces/enums/DTOs/helpers stay with their named owner.
- Controllers: one delegation; no new logic.
- Services/use cases: focused recipe-like methods; model contracts, typed errors, no vendor access.
- Repositories: persistence-only, owner-scoped where required, bounded before pagination.
- Adapters: sole vendor importers; app-owned ports and normalized types.
- Validation: DTO boundary validation and startup config validation; no duplicate service validation.
- Errors: typed `AppError` + `errors.<feature>.<key>` for exposed cases.
- Security: token-derived identity, permission guard, ownership/tenant defense, no existence leakage.
- Config/logging: no raw env outside config/bootstrap; logger adapter/redaction unchanged.
- Tests/docs: tests first for behavior/static changes; practical docs and artifacts in same delivery.

## Request-specific constraints

1. Extend existing owners; do not recreate rules 20–24 or the prior feature folder.
2. Add rules 25–30 for the six uncovered requested concerns.
3. Keep agent files compact; `claude.md` remains canonical and `codex.md` remains the GPT full mirror.
4. External package boundaries for JWT/bcrypt must be executable and tested.
5. No security/validation/auth/ownership behavior may be removed during cleanup.
6. No facade/file split without a current responsibility seam.

## Permanent-rule update

Required. The declaration/refactor/agent-readiness additions are permanent and must update `claude.md`, `rules/00`, indexes, Cursor rules, memory/context, and compatible agent entrypoints in the same delivery.

## Static-enforcement decision

Implement low-false-positive checks for inline type literals, DTO definite assignment, conservative layer method size, and package ownership. Document—not guess at—general magic strings, repository business intent, and unbounded-query detection that cannot be reliably inferred from syntax alone.

## Prohibited implementation techniques

No `eslint-disable`, `@ts-ignore`, undocumented `@ts-expect-error`, `!`, `any`, raw console, raw user-facing `Error`, hook bypass, bare `tsc`, Jest, or gate reduction.
