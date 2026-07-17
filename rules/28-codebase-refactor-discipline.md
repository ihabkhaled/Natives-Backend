# 28 — Codebase Refactor Discipline

> Refactor by responsibility, with behavior and safety pinned first. A broad cleanup is a sequence of small verified moves—not a rewrite.

## Required sequence

1. Read the full affected flow, tests, owners, and current runtime/static baseline.
2. Classify each finding: dead code, wrong owner, duplicate owner, unsafe behavior, or readability debt.
3. Add characterization/regression tests before a behavior-affecting move.
4. Change one responsibility: move declarations, isolate a vendor, extract a policy/mapper, scope a query, or remove a proven dead surface.
5. Update imports, DI wiring, public exports, docs, and fixtures in the same slice.
6. Run the focused test and static checks; continue only when green.
7. Run the full gate set and record remaining gaps honestly.

## Preserve or strengthen

DTO validation, typed `AppError`/message keys, auth, permissions, ownership/tenant checks, query parameterization/bounds, config validation, logging redaction, adapters, transactions/event order, terminal states, tests, docs, and observability.

## Forbidden

Random file splitting, drive-by cleanup unrelated to the recorded scope, mixed structural/behavior changes without tests, deleting safety code because it looks unused, changing public contracts accidentally, weakening assertions/rules/coverage, or leaving half-migrated duplicate owners.

## Large-file rule

Drain misplaced decisions/shaping/vendor access first. Split only if multiple current responsibilities remain, and keep a facade only when it protects a real stable multi-capability surface.

## Review checklist

- [ ] Baseline and target behavior are recorded.
- [ ] Each move has one owner and one reason.
- [ ] Public/security behavior changed only where explicitly required and tested.
- [ ] No duplicate/dead surface remains after migration.
- [ ] Focused and full gates pass; rollback is a coherent reverse slice.

**Related:** [23-function-service-file-size-discipline.md](./23-function-service-file-size-discipline.md) · [24-team-readable-code-review.md](./24-team-readable-code-review.md) · [../skills/full-codebase-cleanup.md](../skills/full-codebase-cleanup.md) · [../skills/simplify-existing-code.md](../skills/simplify-existing-code.md)
