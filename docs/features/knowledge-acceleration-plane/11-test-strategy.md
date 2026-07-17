# 11 — Test Strategy: Knowledge Acceleration Plane

## Requirement-to-test mapping

| Requirement                                                                          | Validation                                                                                                                                                                            |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hash.mjs` produces stable sha256 hashes                                             | `test/tooling/knowledge/hash.spec.mjs` — fixed input string → fixed expected hash                                                                                                     |
| `walk-repo.mjs` returns a deterministic, sorted file list                            | `test/tooling/knowledge/walk-repo.spec.mjs` — fixture directory, exact expected array                                                                                                 |
| `extract-symbols.mjs` classifies layer correctly, reusing `architecture.config.mjs`  | `test/tooling/knowledge/extract-symbols.spec.mjs` — fixture paths per layer (controller/service/repository/etc.), asserted against `eslint/architecture.config.mjs`'s own `layer` map |
| `extract-doc-metadata.mjs` parses house-style docs + the two task-router tables      | `test/tooling/knowledge/extract-doc-metadata.spec.mjs` — fixture markdown strings matching the real `rules/*.md` and `memory/*.md` blockquote styles                                  |
| `build-manifests.mjs` produces the 4 manifests with the agreed schemas               | `test/tooling/knowledge/build-manifests.spec.mjs` — runs against a small fixture repo tree, asserts schema shape                                                                      |
| `build-hashes.mjs --check` detects staleness                                         | `test/tooling/knowledge/build-hashes.spec.mjs` — fixture: unchanged hash → clean; touched file → non-zero with the changed path named                                                 |
| `resolve-context.mjs` ranks deterministically and matches the documented warm-up set | `test/tooling/knowledge/resolve-context.spec.mjs` — fixed fixture manifest + task string → exact expected top-N ordering                                                              |
| `build-summaries.mjs` keeps `BOOTSTRAP.md` within its token budget                   | `test/tooling/knowledge/build-summaries.spec.mjs` — word-count-based token estimate asserted ≤ 1500                                                                                   |
| Existing behavior unchanged                                                          | Full existing Vitest suite (125 tests) must pass unchanged; `tools/` is read-only w.r.t. `src/`                                                                                       |
| CI gate wired correctly                                                              | `.github/workflows/gate-knowledge.yml` runs `npm run knowledge:check` and fails on injected staleness (manual verification during rollout)                                            |

## Test layers used

- **Unit (tooling):** direct in-process `import` of each `.mjs` module, Vitest assertions, fixture-based — mirrors `test/eslint/architecture-plugin/rules/*.spec.mjs` exactly. No subprocess spawning, no snapshots (rule 21 §5).
- **Integration (generator end-to-end):** `npm run knowledge:build` run against the real repo tree, asserting the 4 manifests exist, parse as valid JSON, and are byte-identical across two consecutive runs with no source changes.
- **Static:** `npm run lint`, `npm run typecheck` (where applicable — `.mjs` files are outside `tsconfig.eslint.json`'s TS-checked scope, same as `eslint/*.mjs`), `npm run build`, `npm run security:scan`.

## Negative and edge cases

- `resolve-context.mjs` with no `--task` and no `--files`/`--diff` → returns only the warm-up set, no error.
- `build-hashes.mjs --check` against a manifest that has never been built → clear "run knowledge:build first" message, non-zero exit.
- `extract-doc-metadata.mjs` against a markdown file that doesn't match either house-style blockquote pattern (e.g. a `docs/features/` artifact) → returns a minimal record (path + title only), never throws.

## Migration and rollback tests

Not applicable — no schema or data change. Accepted by: repository architect.

## Environments and evidence

Local Windows working copy, Node ≥24.18.0 <25; evidence = command outputs recorded in `15-dev-validation-report.md`.
