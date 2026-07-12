# 10 — Engineering Standards Review: Knowledge Acceleration Plane

## Standards review matrix

| Standard                             | Enforced by                                                                                                                             | Status | Notes                                                                                    |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------- |
| No new dependencies                  | Manual review — `tools/knowledge/` uses only `node:fs`, `node:path`, `node:crypto`, `node:url`                                          | ✅     | Reuses `eslint/architecture.config.mjs` + `source-utils.mjs` instead of a parser library |
| Dependency-free tooling convention   | Matches `eslint/architecture-plugin/` precedent (`.mjs` ESM)                                                                            | ✅     | Same extension, same import style, same lack of a build step                             |
| Reuse before create (rule 45)        | `moduleSuffix`/`layer`/`suffixPattern` and `getImportCandidates` imported, not reimplemented                                            | ✅     | Verified against `eslint/architecture.config.mjs` and `source-utils.mjs`                 |
| No speculative abstraction (rule 44) | 4 manifests, not ~20; no per-module cards until measured need; no event/contract/call/deployment graphs for subsystems that don't exist | ✅     | See `06-technical-refinement.md` rejected-options table                                  |
| Deterministic, no snapshots          | `resolve-context.mjs` ranking tested against fixed fixture manifests, exact top-N assertions                                            | ✅     | Mirrors `test/eslint/architecture-plugin/rules/*.spec.mjs` style                         |
| Test style matches house convention  | Direct in-process `import` of `.mjs` modules, Vitest, no subprocess spawning                                                            | ✅     | `test/**/*.spec.mjs` already in `vitest.config.mts` include — no config change           |
| CI gate shape                        | `.github/workflows/gate-knowledge.yml` mirrors `gate-lint.yml` exactly                                                                  | ✅     | checkout → setup-node (`.nvmrc`) → `npm ci` → gate command                               |
| No secrets/PII in `.ai/` artifacts   | Manifests contain only file paths, hashes, and doc metadata                                                                             | ✅     | No source file contents, no env values, no credentials                                   |

## Request-specific rules

1. No new top-level canonical directory created (`security/`, `privacy/`, `operations/`, `product/`, `domain/`, `contracts/`, `quality/`, `incidents/`, `knowledge/`, `structure/`) — each already has a home or is genuinely not applicable.
2. `tools/` stays outside the `src/` coverage-`include` allowlist — validated by its own specs, not %-coverage-gated, matching the `eslint/` precedent exactly.
3. `.ai/` committed artifacts (manifests, `BOOTSTRAP.md`) must be byte-identical on repeated `npm run knowledge:build` runs against unchanged source (determinism requirement).
4. No `eslint-disable`, `@ts-ignore`, or `--no-verify` used anywhere in this delivery.
5. Application code (`src/modules/*`, `src/core/*`) is read-only input to the generator — never modified by this delivery.

## Permanent-rule update check

No new permanent rule is required. This delivery is tooling + 3 documentation files that extend already-existing patterns (`memory/*-decisions.md`, `context/simple-code-map.md`); it does not introduce a new category of engineering constraint.

## Implementation constraints

- All `tools/knowledge/*.mjs` files are plain ESM, importable directly by Vitest specs without a build step.
- Manifest JSON output uses stable key ordering and sorted arrays for determinism.
- The resolver's ranking algorithm is fully described by precomputed, inspectable fields in the manifests — no hidden runtime heuristics.
