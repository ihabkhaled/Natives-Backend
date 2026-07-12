# 15 — Developer Validation Report: Knowledge Acceleration Plane

## Validation summary

All quality gates are green, including the new `knowledge:check` staleness gate wired into `npm run validate`. The delivery adds a dependency-free `tools/knowledge/` generator + CLI, a committed `.ai/` compiled layer, three genuinely-missing documentation files, and route-table updates — with no change to application runtime behavior. The full existing test suite passes unchanged alongside 95 new tooling tests.

## Commands run

| Command                                                 | Result                                                                                     |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `npm run knowledge:build`                               | ✅ 141 source files, 3 modules, 132 docs, 254 dependency edges; `BOOTSTRAP.md` ~449 tokens |
| `npm run knowledge:check`                               | ✅ "manifests are up to date"                                                              |
| `npm run knowledge:context -- --task="…"`               | ✅ 5 warm-up + 12 ranked → `.ai/local/current-context.{json,md}`                           |
| `npm run format:check`                                  | ✅ "All matched files use Prettier code style!"                                            |
| `npm run lint`                                          | ✅ 0 errors, 0 warnings                                                                    |
| `npm run typecheck`                                     | ✅ `tsc --noEmit` clean                                                                    |
| `npm run test:coverage`                                 | ✅ 45 files, **357 tests** pass                                                            |
| `npm run build`                                         | ✅ `tsc -p tsconfig.build.json` compiles clean                                             |
| `npm run security:scan`                                 | ✅ Trivy `--exit-code 1 --severity HIGH,CRITICAL`: 0 findings                              |
| `npm run validate` (full chain incl. `knowledge:check`) | ✅ exit 0 end-to-end                                                                       |

## Coverage details

| Metric     | Result           | Threshold | Status |
| ---------- | ---------------- | --------- | ------ |
| Statements | 99.6% (254/255)  | 95%       | ✅     |
| Functions  | 100% (83/83)     | 95%       | ✅     |
| Lines      | 99.6% (250/251)  | 95%       | ✅     |
| Branches   | 94.93% (150/158) | 90%       | ✅     |

Coverage is measured on `src/**` only (the standing `include` allowlist). `tools/knowledge/` sits outside it by design — the same precedent as `eslint/`, which is validated by its own specs rather than %-coverage. The tooling's own 95 Vitest tests exercise every module directly.

## Functional coverage

- **Generator determinism** — `npm run knowledge:build` produces a stable `treeHash` across repeated runs on unchanged source (asserted in `build-manifests.spec.mjs`); the `generatedAt` field is informational and excluded from the staleness comparison.
- **Manifests** — `repository.json` (141 files with hash/layer/module/spec-linkage), `modules.json` (3 modules + cross-cutting `core`/`shared`/`config`/`bootstrap`, `hasEvents: false`), `documents.json` (132 canonical docs with title/rule-number/keywords/related-links), `dependency-graph.json` (254 internal/cross-module/cross-cutting edges). Layer classification and import resolution reuse `eslint/architecture.config.mjs` and `source-utils.mjs` — asserted against them, not re-derived.
- **Staleness detection** — `knowledge:check` exits 0 on a fresh build and non-zero (naming the changed path) after touching a tracked file, proven both in `build-hashes.spec.mjs` and by manual injection during development.
- **Resolver** — the fixed 5-file warm-up set (verbatim from `memory/ai-context-map.md`) plus deterministic ranking; spot-checked against the existing task-router rows: "add a guard to a controller" → `rules/07`, `skills/add-guard-and-permission.md`, the auth guard source, `agents/backend-security-reviewer.md`; "add a paginated repository query" → `skills/create-repository.md`, `rules/04`, `rules/08`, `memory/database-decisions.md`, `agents/database-reviewer.md`.
- **BOOTSTRAP.md** — assembled from `claude.md` Purpose + `rules/00` categories + `package.json` gates; ~449 tokens, well within the 1500 budget (asserted in `build-summaries.spec.mjs`).

## Operational checks

- No application runtime, API, config, or DB surface touched; `src/` is read-only input to the generator.
- `.ai/local/` is gitignored; the 4 manifests + `BOOTSTRAP.md` are committed for cold-start and kept fresh by the CI gate.
- Generated `.ai/` artifacts (except the hand-authored `.ai/README.md`) are Prettier-ignored — the generator's deterministic output is the source of truth.
- No `eslint-disable`, `@ts-ignore`, or `--no-verify` used anywhere.

## Defects found and fixed during development

| #   | Defect                                                                                       | Fix                                                                                 |
| --- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 1   | `extractImplementsRule` swallowed the "00" from a linked filename as a false rule number     | Windowed the capture to stop at the first `.`/newline/`[`/`(`                       |
| 2   | Generic recipe verbs ("add", "create") dominated ranking, drowning the distinguishing noun   | Added them to the keyword stopword list                                             |
| 3   | Terse intent blockquotes missed the vocabulary that lived in the next paragraph              | Added `extractLeadParagraph` and folded it into keyword derivation                  |
| 4   | `extractSection` regex lookahead (`$` under `/m`) silently returned an empty Purpose section | Replaced the clever regex with boring string slicing                                |
| 5   | Prettier reformatting the generated manifests/BOOTSTRAP created a format↔build loop          | Added the generated paths to `.prettierignore` (same category as `dist/`/lockfiles) |
| 6   | The git-diff resolver test assumed a `main` default branch (this repo defaults to `master`)  | Pinned `git init -b main` in the fixture                                            |

## Stability decision

**Stable.** All gates are green; the full `validate` chain (now including `knowledge:check`) passes exit 0. Ready for review and merge.
