# 06 — Technical Refinement: Simple Readable Code Operating System

## Technical context

IronNest's engineering OS already enforces layers, sizes (service ≤ 20 lines), and duplication bans mechanically. Missing: a named simplicity canon (readability bar, YAGNI, reuse procedure, size judgment beyond lint, review questions) and correct activation of three architecture overrides.

## Alternatives considered

| Option                                                            | Verdict                                                                                       |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| A. Fold simplicity guidance into existing rules 03/06/13/15 only  | Rejected — the concerns (ladder, YAGNI, review questions) have no owner; discoverability poor |
| B. New rules 20–24 + compact entrypoint pointers (**chosen**)     | One owner per concern; matches the numbered-rulebook structure; mirrors stay thin             |
| C. One mega-rule "20-simplicity.md"                               | Rejected — five distinct concerns in one file recreates the god-file problem the rule bans    |
| D. Heavy new lint (no-magic-numbers, explicit-return-types, etc.) | Rejected for now — false-positive risk; recorded as possible future improvements              |
| E. Duplicate full rule bodies into KIMI/GEMINI/… entrypoints      | Rejected — violates canonical-file rules and the no-token-burning rule itself                 |

## Chosen approach

- Canon: `rules/20`–`24`; non-negotiables 43–46 in `rules/00`; hooks in `rules/13`, `rules/15`.
- Procedure: 10 skills applying the canon; existing `decompose-large-file.md` referenced for shared mechanics, not duplicated.
- Enforcement: stock-rule additions (`complexity: 15`, `max-depth: 3`, `no-nested-ternary`, `no-else-return`, `no-param-reassign`, `no-return-assign`), `sonarjs/cognitive-complexity` 20 → 15 (stricter-only), `max-classes-per-file: 1` on layer files, and glob-corrected overrides — all guarded by `test/eslint/config-rule-activation.spec.mjs`.
- Navigation/memory: `context/simple-code-map.md`, `memory/code-simplicity-decisions.md`, pitfalls section J, route rows in `memory/ai-context-map.md`.

## Rejected approaches (recorded)

Options A, C, D, E above; also rejected: creating `docs/ai-agent-coding-style.md` and `docs/sdlc/engineering/` (both would invent structure and duplicate owners).

## Open technical questions

None blocking. Future lint candidates (documented in `10-engineering-standards-check.md`): `no-magic-numbers`, `explicit-module-boundary-types`, `no-shadow`, `no-await-in-loop`, `sonarjs/no-duplicate-string`, per-layer `max-lines-per-function` tiers, linting the `eslint/` config modules themselves.

## Debt impact

Reduces debt: fixes the dead-override defect, the CRLF checkout risk, a stale-dependency footgun, and rules/13 doc drift.
