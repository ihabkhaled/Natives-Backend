# tools/knowledge — the compiled AI acceleration layer

> A dependency-free Node ESM generator that compiles this repository's large canonical corpus (`rules/`, `skills/`, `context/`, `memory/`, `agents/`, `testing/` — ~130 files, ~370K tokens) into a small committed [`.ai/`](../../.ai) layer, so a cold-starting AI agent reads a `≤1500`-token bootstrap and a task-specific context pick instead of the whole corpus.

Built as an internal tool that follows the same house convention as [`eslint/architecture-plugin/`](../../eslint/architecture-plugin): plain `.mjs` ESM, standard-library only (`node:fs`/`node:path`/`node:crypto`/`node:url`), no parser/glob/CLI dependency, and Vitest specs that `import` the module directly ([`test/tooling/knowledge/`](../../test/tooling/knowledge)). Layer/module/suffix conventions and import resolution are **reused** from [`eslint/architecture.config.mjs`](../../eslint/architecture.config.mjs) and [`eslint/architecture-plugin/shared/source-utils.mjs`](../../eslint/architecture-plugin/shared/source-utils.mjs) — never re-derived (rules/22).

## Commands

| Command                                   | What it does                                                                                                                                               |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run knowledge:build`                 | Regenerates the 4 manifests + `BOOTSTRAP.md` under `.ai/`. Run this after changing any `src/` or doc file.                                                 |
| `npm run knowledge:check`                 | Fails if the committed manifests are stale vs. the working tree. Wired into `npm run validate` and CI (`gate-knowledge.yml`).                              |
| `npm run knowledge:context -- --task="…"` | Ranks the exact rules/skills/source relevant to a task → `.ai/local/current-context.{json,md}`. Also accepts `--files=a.ts,b.ts` and `--diff=base...head`. |

## Files

| File                           | Role                                                                                  |
| ------------------------------ | ------------------------------------------------------------------------------------- |
| `build-manifests.mjs`          | Builds `repository.json`, `modules.json`, `documents.json`, `dependency-graph.json`   |
| `build-hashes.mjs`             | `--check` staleness detection against the committed manifests                         |
| `build-summaries.mjs`          | Builds `.ai/BOOTSTRAP.md` from `claude.md` + `rules/00` + `package.json`              |
| `resolve-context.mjs`          | The task-context resolver CLI                                                         |
| `lib/hash.mjs`                 | `sha256` content + tree hashing                                                       |
| `lib/walk-repo.mjs`            | Deterministic sorted file walk                                                        |
| `lib/extract-symbols.mjs`      | Per-file layer/module classification + export extraction (reuses architecture.config) |
| `lib/extract-doc-metadata.mjs` | Doc title/intent/keyword/related-link extraction from house-style markdown            |
| `lib/rank-context.mjs`         | The deterministic ranking algorithm (pure; no I/O)                                    |

## Generation contract

- Everything under `.ai/` **except `.ai/local/`** is generated and committed — never hand-edit it; change the generator instead.
- `.ai/local/` is per-run resolver output and is gitignored.
- The generator is deterministic: repeated runs against unchanged source produce byte-identical manifests (the `generatedAt` field is informational and excluded from the staleness comparison).
- What this deliberately does **not** do (documented, not accidental): AST-based symbol typing, semantic/embedding retrieval, file-watching, static per-task-type packs, and call/contract/event/deployment graphs. See `docs/features/knowledge-acceleration-plane/06-technical-refinement.md` for the reasoning — each was declined because this is a 115-source-file repo where regex-on-existing-conventions is sufficient, or describes a subsystem that does not exist here yet (there is no event bus, no IaC, no on-disk OpenAPI).
