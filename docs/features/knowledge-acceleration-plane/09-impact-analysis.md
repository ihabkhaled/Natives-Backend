# 09 — Impact Analysis: Knowledge Acceleration Plane

## Affected systems

| System / surface          | Impact                                                                                                                                                                       |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New `tools/knowledge/`    | New directory, new generator + CLI, dependency-free                                                                                                                          |
| New `.ai/`                | New committed manifests (`repository.json`, `modules.json`, `documents.json`, `dependency-graph.json`) + `BOOTSTRAP.md`; gitignored `.ai/local/` for per-run resolver output |
| `package.json`            | 3 new scripts (`knowledge:build`, `knowledge:check`, `knowledge:context`); `validate` chain gains `knowledge:check`                                                          |
| `.gitignore`              | New `.ai/local/` entry                                                                                                                                                       |
| CI                        | New `.github/workflows/gate-knowledge.yml`                                                                                                                                   |
| `memory/`, `context/`     | 3 new files; route-table rows added to `ai-context-map.md`, `codebase-navigation.md`, both READMEs                                                                           |
| Root `README.md`          | One new row/mention pointing at `tools/knowledge/`                                                                                                                           |
| `src/` (application code) | Untouched — read-only input to the generator                                                                                                                                 |
| Runtime behavior          | None — no application, API, or DB surface touched                                                                                                                            |

## Affected teams / roles

Engineers and AI agents working in this repository. No external team, client, or consumer.

## Backward compatibility

No API, contract, schema, or runtime behavior change. All existing gates (`lint`, `typecheck`, `test:coverage`, `build`, `security:scan`) are additive-only affected — `tools/` sits outside the coverage `include` allowlist (same precedent as `eslint/`), validated by its own Vitest specs instead.

## Migration needs

None. `.ai/` manifests are generated fresh by `npm run knowledge:build`; nothing pre-existing is migrated.

## Monitoring / support / training impact

- Monitoring: Not applicable — no runtime change. Accepted by: repository architect.
- Support: Not applicable — no operator-facing change. Accepted by: repository architect.
- Training: `.ai/BOOTSTRAP.md` itself is the onboarding artifact for AI agents; no human training session required.

## Compliance / privacy impact

None. No data, retention, or privacy surface touched. (This request is also the trigger for adding `memory/privacy-decisions.md`, which records that this repo has no privacy surface beyond auth credentials.)
