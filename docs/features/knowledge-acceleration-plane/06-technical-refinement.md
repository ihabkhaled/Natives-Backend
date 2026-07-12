# 06 — Technical Refinement: Knowledge Acceleration Plane

## Technical context

An external spec asked for a full "AI-native knowledge and delivery operating system": a canonical plane (20+ new top-level directories: `security/`, `privacy/`, `operations/`, `product/`, `domain/`, `contracts/`, `quality/`, `incidents/`, `structure/`, `knowledge/`, …) plus a compiled `.ai/` plane (~40 categories of JSON manifests/indexes/graphs, 35+ static per-task packs, a hash-based CLI resolver, semantic embeddings as a fallback).

Two investigation passes established the actual starting point before any design decision was made:

- The canonical plane already exists and is large: `rules/` (32), `skills/` (46), `context/` (12), `memory/` (19), `agents/` (11), `testing/` (9) = 129 files, ~21K lines, ~367K tokens.
- 115 non-spec `src/**/*.ts` files, 26 spec files — genuinely small.
- No glob/AST/CLI-parsing/watcher library installed; no `/scripts` or `/tools` directory; no manifest-generation precedent anywhere.
- `eslint/architecture-plugin/` is the one existing precedent for exactly this kind of tool: dependency-free `.mjs` ESM, regex/AST-lite matching against `eslint/architecture.config.mjs`'s layer/suffix conventions, Vitest specs that `import` the module directly.
- `src/core/events/` does not exist in this codebase. No Dockerfile/K8s/Terraform anywhere. No on-disk OpenAPI JSON (Swagger doc is built in-memory only at runtime).
- 7 GitHub Actions gate workflows already exist (`gate-lint.yml`, `gate-build.yml`, `gate-coverage.yml`, `gate-e2e.yml`, `gate-typecheck.yml`, `gate-unit-tests.yml`, `gate-security-scan.yml`), no knowledge gate yet.

## Alternatives considered

| Option                                                                                                                                                                      | Verdict                                                                                                                                                                                                                                  |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A. Build the full external spec verbatim (~40 manifest/index/graph categories, 20+ new top-level dirs, embeddings fallback)                                                 | Rejected — massively disproportionate to a 115-file repo; would itself violate this repo's own `rules/21-yagni-and-minimalism.md`; several categories (event-graph, contract-graph, deployment-graph) have literally nothing to describe |
| B. Replace the existing rules/skills/context/memory/agents/testing system with the spec's `knowledge/` taxonomy                                                             | Rejected by explicit user instruction — "extend the existing system," not replace it                                                                                                                                                     |
| C. Build only static hand-authored `.ai/` files, no real generator                                                                                                          | Rejected by explicit user instruction — "build the full generator system," meaning real, working, automated                                                                                                                              |
| D. Right-sized `tools/knowledge/` generator (4 manifests, not 40) + 3 genuinely-missing doc files, reusing existing eslint/architecture.config.mjs conventions (**chosen**) | Matches both explicit user answers (extend existing; build a real generator) while respecting this repo's own simplicity/reuse rules                                                                                                     |
| E. AST-based extraction via `ts-morph`/`typescript-estree`                                                                                                                  | Rejected for v1 — 115 files means regex against already-established conventions is sufficient; adds a new dependency for no measured need                                                                                                |
| F. Semantic/embedding-based context retrieval                                                                                                                               | Rejected for v1 — deterministic keyword/path/module/layer scoring is the spec's own stated starting point; embeddings are justified only by measured routing failures, which cannot exist on a fresh build                               |

## Chosen approach

- **Generator**: `tools/knowledge/` — dependency-free Node ESM `.mjs`, reusing `moduleSuffix`/`layer`/`suffixPattern` from `eslint/architecture.config.mjs` and `getImportCandidates` from `eslint/architecture-plugin/shared/source-utils.mjs`. Produces exactly 4 committed manifests (`repository.json`, `modules.json`, `documents.json`, `dependency-graph.json`) — not the spec's ~20+ index/manifest/graph files, most of which are either cheap runtime views over these 4, or describe subsystems (events, deployment, contracts-as-OpenAPI) that don't exist in this codebase yet.
- **Resolver**: `resolve-context.mjs` implements, in executable form, the exact orientation sequence `memory/ai-context-map.md` already documents (5-file constant warm-up, then change-specific ranking) — not a generic search algorithm invented from scratch.
- **Bootstrap**: `.ai/BOOTSTRAP.md` only, ≤1500 tokens, assembled from `claude.md`'s Purpose section, `rules/00`'s condensed rule list, and `package.json`'s gate commands. Per-module summary cards deferred until `BOOTSTRAP.md` measurably exceeds its budget.
- **Docs**: 3 new files following the exact existing `memory/*-decisions.md` (`Decision N` / `**Why:**` / `**Project records:**`) and `context/simple-code-map.md` (routing-only) skeletons — not new top-level directories.
- **CI**: `gate-knowledge.yml` mirrors `gate-lint.yml`'s exact shape (checkout → setup-node via `.nvmrc` → `npm ci` → gate command).

## Rejected approaches (recorded)

Options A, B, C, E, F above; also rejected: a `.ai/config/project-profile.json` (tooling config already lives in `eslint/architecture.config.mjs` — a second JSON config for the same category of thing is itself a small YAGNI violation); `source-to-test-graph.json` as a separate hashed artifact (folded into `repository.json` as `hasSpec`/`specPath` fields — a one-line `fs.existsSync` check); `by-module.json`/`by-task.json` as committed files (computed live inside `resolve-context.mjs` instead).

## Open technical questions

None blocking. Future extension candidates, documented not built: per-module `.ai/summaries/*.md` cards (once `BOOTSTRAP.md` exceeds budget); an OpenAPI-JSON-backed API contract manifest (requires bootstrapping the Nest DI container in a script — heavier than v1's scope); an event-graph (the moment `src/core/events/` is introduced, `modules.json`'s `hasEvents` field self-updates and signals the need).

## Debt impact

Reduces debt: adds automated staleness detection for the (already large) canonical corpus, closing the gap this repo currently has with no doc-lint/link-check/index-generation tooling of any kind.
