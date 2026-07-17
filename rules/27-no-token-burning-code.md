# 27 — No Token-Burning Code

> Developer attention, reviewer attention, AI context, CI time, and runtime resources are shared budgets. Code and documentation must spend them only on current behavior or a real boundary.

## Avoid

- duplicated policy bodies across rules, skills, docs, memory, and compact agent routers; the only approved full duplicates are byte-synchronized `codex.md` and `cursor.md` mirrors required by canonical policy;
- generated-looking boilerplate, giant diffs, repeated setup, meaningless wrappers, and one-use abstractions;
- comments that restate code, implementation-detail tests, broad snapshots, and mocks that reproduce the implementation;
- unused config/env values, dead exports, speculative DTOs/providers/factories, and parallel constants/helpers;
- huge files or chains that force readers to retain unrelated context.

## Prefer

- one canonical owner plus compact links;
- small responsibility-based changes and scenario-named tests;
- shared builders only after setup repetition becomes meaningful;
- direct code with named steps;
- deletion of proven dead surfaces, including exports/docs/config/tests;
- concise agent entrypoints that route to `claude.md`, rules, skills, context, and pitfalls.

## Safety boundary

Never reduce context by hiding validation, guards, permissions, ownership, error mapping, transactions, observability, or rollback behavior. Safety-relevant explicitness is useful context, not waste.

## Review checklist

- [ ] Every new file and abstraction has a current job.
- [ ] Canonical text lives once; compact routers link, while only approved full mirrors remain byte-identical.
- [ ] Test setup and fixtures are proportionate and intention-revealing.
- [ ] Unused code/config/env/docs were removed as one complete surface.
- [ ] The diff can be reviewed one responsibility at a time.

**Related:** [21-yagni-and-minimalism.md](./21-yagni-and-minimalism.md) · [22-reuse-before-creating.md](./22-reuse-before-creating.md) · [28-codebase-refactor-discipline.md](./28-codebase-refactor-discipline.md) · [../skills/remove-unnecessary-code.md](../skills/remove-unnecessary-code.md)
