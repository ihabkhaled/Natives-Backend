# 15 — Developer Validation Report: Simple Readable Code Operating System

## Validation summary

All quality gates are green on the delivered working tree. The change is documentation/governance plus stricter-only lint enforcement and one behavior-neutral relocation in `src/modules/auth`; the pre-existing test suite passes unchanged, and a new 29-case ESLint config-activation spec guards the enforcement fixes.

## Commands run

| Command                 | Result                                                                          |
| ----------------------- | ------------------------------------------------------------------------------- |
| `npm install`           | ✅ Synced stale `node_modules` (bcrypt + `@types/bcrypt` were absent)           |
| `npm run format`        | ✅ Applied to new/modified markdown + spec                                      |
| `npm run format:check`  | ✅ "All matched files use Prettier code style!"                                 |
| `npm run lint`          | ✅ 0 errors, 0 warnings                                                         |
| `npm run typecheck`     | ✅ `tsgo --noEmit` clean, project-wide                                          |
| `npm run test`          | ✅ 20 files, **125 tests** pass                                                 |
| `npm run test:coverage` | ✅ 125 pass; statements 100%, functions 100%, lines 100%, branches 90.47%       |
| `npm run build`         | ✅ `nest build -p tsconfig.build.json` compiles clean                           |
| `npm run security:scan` | ✅ Trivy `--exit-code 1 --severity HIGH,CRITICAL`: 0 vulnerabilities, 0 secrets |
| Markdown link check     | ✅ 211 files scanned, 0 broken relative links                                   |

## Coverage details

| Metric     | Result | Threshold | Status |
| ---------- | ------ | --------- | ------ |
| Statements | 100%   | 95%       | ✅     |
| Functions  | 100%   | 95%       | ✅     |
| Lines      | 100%   | 95%       | ✅     |
| Branches   | 90.47% | 90%       | ✅     |

Branch floor is 90% by standing decision (decorator-transform synthetic branches, [known-pitfalls §I3](../../../memory/known-pitfalls.md)); no threshold was lowered in this change.

## Functional coverage

- **ESLint activation** — `test/eslint/config-rule-activation.spec.mjs` (29 cases) resolves the real `eslint.config.mjs` per representative path and asserts: the six new simplicity caps with exact options; `sonarjs/cognitive-complexity: 15`; `max-lines-per-function: 20` on services; `no-inline-layer-declarations` + `max-classes-per-file: 1` on service/controller/repository/adapter/**nested adapter**/guard/**nested guard**; `controller-no-logic`; the adapter `Promise.*` ban on flat **and nested** adapter paths; the domain DTO-import ban; and two negative cases (`lib/` is not an implementation layer; spec files keep their relaxations while `no-explicit-any` stays `error`).
- **Auth behavior** — `verifyPassword` moved from `auth.service.ts` to `auth/lib/password.helpers.ts`. Same bcrypt `compare`, same call site, same `Promise<boolean>`. `auth.service.spec.ts` (unmodified) exercises login success, wrong password, and unknown user against real bcrypt hashes; all pass.
- **Whole codebase under the stricter caps** — `npm run lint` is 0/0 with `complexity: 15`, `max-depth: 3`, `no-nested-ternary`, `no-else-return`, `no-param-reassign`, `no-return-assign`, and three revived overrides active.

## Operational checks

- No runtime, deployment, config, migration, or observability surface touched.
- `.gitattributes` (`* text=auto eol=lf`) added and the worktree renormalized; `git diff --numstat` confirms only intended files carry content changes.
- Husky hooks unchanged; no `--no-verify`, no `eslint-disable`, no `@ts-ignore` anywhere in the delivery.

## Acceptance-criteria validation

- [x] Repository inspected before authoring (8-agent investigation sweep across rules/skills/eslint/mirrors/context/memory/docs/src).
- [x] New rules `20`–`24` exist; `rules/00` gains non-negotiables 43–46; `rules/13` and `rules/15` extended.
- [x] 10 new skills exist and follow the house skill format; `skills/README.md` catalogs them.
- [x] `rules/README.md`, `skills/README.md`, `context/README.md`, `memory/README.md`, `memory/ai-context-map.md` indexes updated.
- [x] All 12 agent-entrypoint surfaces carry the compact Simple Code Ladder pointer (≤ 2 lines each); no rule body duplicated into a mirror.
- [x] `docs/sdlc/simple-readable-code.md` added; `code-review-checklist.md` and `engineering-standards.md` extended; root `README.md` updated.
- [x] `memory/code-simplicity-decisions.md` added; `known-pitfalls.md` gains section J (J1–J5).
- [x] `context/simple-code-map.md` added and cross-linked from navigation.
- [x] ESLint enforcement investigated; gaps closed with tested, stricter-only changes; remaining candidates documented in `10-engineering-standards-check.md`.
- [x] No existing rule, threshold, gate, or checklist item weakened (independently audited — see below).
- [x] All gates green.

## Independent verification

A four-auditor adversarial review ran against the completed working tree (no-weakening audit, two skill-quality audits, cross-file consistency/acceptance audit). Verdict: **no rule text, threshold, gate, or checklist item was deleted or softened anywhere**; every documentation diff is additive; the ESLint diff is strictly tightening.

## Defects found and fixed before this report

| #   | Defect                                                                                                                | Severity   | Fix                                                                                                                       |
| --- | --------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------- |
| 1   | `skills/split-large-service.md` taught a repository throwing `errors.article.notFound`, contradicting rules/04        | MUST FIX   | Rewrote the example: repo returns `null`, the **service** throws; added a callout                                         |
| 2   | `skills/review-for-readable-code.md` labeled a rule-9 domain-string + nested-ternary violation as SHOULD FIX          | MUST FIX   | Reclassified as MUST FIX; added a "severity comes from the rule" callout + a table row                                    |
| 3   | Same skill claimed "fifteen [questions] have mechanical help"                                                         | MUST FIX   | Corrected: Q9/Q11/Q16/Q18 have no lint rule; Q9 is safety-critical and must never be delegated                            |
| 4   | `agents/backend-code-reviewer.md` still said "all 42 non-negotiable rules"                                            | MUST FIX   | Updated to 46                                                                                                             |
| 5   | `skills/refactor-smart-code-to-boring-code.md` asserted `unicorn/no-nested-ternary` is `error`                        | MUST FIX   | It is disabled by `eslint-config-prettier`; corrected to core `no-nested-ternary`                                         |
| 6   | Same wrong attribution in `rules/20-simple-readable-code.md`                                                          | SHOULD FIX | Corrected                                                                                                                 |
| 7   | `adapterFileGlobs` / layer globs matched only direct children — a nested adapter would escape the overrides           | SHOULD FIX | Widened to `**/adapters/**/*.ts` (and the rules' internal `filePatterns` regexes to `.+`); added 5 nested-path spec cases |
| 8   | `rules/00` line 23 still credited `no-restricted-syntax` for zero-inline enforcement                                  | SHOULD FIX | Names `architecture/no-inline-layer-declarations` + `max-classes-per-file`; `.cursorrules` widened too                    |
| 9   | Rule 44 read literally ("one use ⇒ no helper") could refuse extraction that rules 20/23 require                       | SHOULD FIX | Added an explicit carve-out in rules/21 §3 and rule 44                                                                    |
| 10  | Rule 46's "never cuts rules 25–42" could imply rules 1–24 were tradeable                                              | NOTE       | Rescoped to "no rule in this rulebook is tradeable for a smaller diff" (5 files)                                          |
| 11  | `skills/reuse-before-creating.md` search block referenced non-existent paths (`src/modules/article/`, `shared/utils`) | SHOULD FIX | Corrected to real repo paths; `src/core` inventory aligned to disk and rule 22 §1                                         |
| 12  | `skills/extract-helper-safely.md` claimed lint enforces absence of `lib`→`domain`→`model` cycles                      | SHOULD FIX | `import-x/no-cycle` runs `maxDepth: 1`; reworded to state the real limit                                                  |
| 13  | `ArticleStatus` casing drift (UPPER in docs vs PascalCase in the real enum)                                           | SHOULD FIX | Normalized 7 files to the owner's PascalCase members                                                                      |
| 14  | Mapper filename drift (`article.mapper.ts` vs canon `<feature>.mappers.ts`)                                           | SHOULD FIX | Normalized new skills to the canon plural form                                                                            |
| 15  | `skills/split-large-use-case.md` modeled an unawaited post-commit dispatch (floating promise)                         | SHOULD FIX | Awaited it; clarified that "fire-and-forget" describes handler isolation, not an unawaited call                           |
| 16  | Same skill left `findByIdOrThrow` layer-ambiguous; a snippet path comment mislabeled an emit call                     | SHOULD FIX | Both corrected                                                                                                            |
| 17  | `memory/code-simplicity-decisions.md` asserted an incident that no record supports                                    | SHOULD FIX | Reworded as the risk pattern rules/06 §6 warns about; added a Project-records slot                                        |
| 18  | Intake declared "auth not touched / `src/` refactor out of scope" after auth was edited                               | SHOULD FIX | Intake amended in place with the phase-14 reconciliation                                                                  |
| 19  | `09-impact-analysis.md` said "two minimal fixes" but named one                                                        | NOTE       | Corrected to one behavior-neutral fix (1 modified, 1 added)                                                               |
| 20  | Direct `bcrypt` import had no recorded exception                                                                      | NOTE       | Added a "Recorded direct-use exceptions" table to `memory/library-boundaries.md`                                          |
| 21  | Pre-existing: `rules/03` and `rules/10` showed `repo.findByIdOrThrow`, contradicting rules/04                         | SHOULD FIX | Both corrected to service-owned loaders                                                                                   |
| 22  | Pre-existing: `testing/coverage-policy.md` §3 claimed istanbul provider + `branches: 95` vs live v8 + 90              | SHOULD FIX | Aligned to the live config, with a config-wins note                                                                       |

## Stability decision

**Stable.** All gates are green, all MUST FIX and SHOULD FIX findings are resolved, and no rule or safety guarantee was weakened. Ready for review and merge.
