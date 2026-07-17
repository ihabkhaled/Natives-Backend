# Refactor Decisions

## Decision: refactor by responsibility

**What:** broad cleanup is executed as small owner-based slices with characterization/regression tests first.

**Why:** structural and behavioral changes mixed together hide regressions and make rollback ambiguous.

**Rules:** [28-codebase-refactor-discipline.md](../rules/28-codebase-refactor-discipline.md).

## Decision: declaration moves are complete migrations

**What:** move the declaration, update every import/export/provider/doc/test, and delete the old owner in one slice.

**Why:** half migrations leave duplicate sources of truth.

## Decision: split only at current seams

**What:** drain misplaced policy/mapping/vendor/config concerns before splitting; retain a facade only for a real stable multi-capability boundary.

**Why:** line-count-only splits increase files without reducing coupling.

## Decision: behavior improvements are explicit

**What:** a security/error/config correction discovered during cleanup gets its own test and artifact note; it is not mislabeled behavior-neutral.

**Why:** reviewers need to distinguish relocation from changed contracts.
