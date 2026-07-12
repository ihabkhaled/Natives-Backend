# .ai — compiled AI acceleration layer (generated)

> **Generated — do not hand-edit.** Everything here except `local/` is produced by `npm run knowledge:build` from the canonical corpus and source tree. To change it, change the generator under [`tools/knowledge/`](../tools/knowledge), not these files. A CI gate (`gate-knowledge.yml`, via `npm run knowledge:check`) fails if these committed artifacts drift from the working tree.

## What an AI agent reads

1. [`BOOTSTRAP.md`](./BOOTSTRAP.md) — the `≤1500`-token cold start: project purpose, authority precedence, non-negotiable rule categories, the fast-task protocol, and the quality gates.
2. Then run `npm run knowledge:context -- --task="<your task>"` and read `local/current-context.md` — the 5-file warm-up set plus the ranked rules/skills/source for that specific task.

## Contents

| Path                              | Committed?      | What it is                                                               |
| --------------------------------- | --------------- | ------------------------------------------------------------------------ |
| `BOOTSTRAP.md`                    | yes             | The cold-start file (from `claude.md` + `rules/00` + `package.json`)     |
| `manifests/repository.json`       | yes             | Every `src/**/*.ts` file with hash, layer, module, spec linkage          |
| `manifests/modules.json`          | yes             | Per-module cards (layers, file/spec counts, public surface, `hasEvents`) |
| `manifests/documents.json`        | yes             | The canonical-doc catalog (title, rule number, keywords, related links)  |
| `manifests/dependency-graph.json` | yes             | Internal `src/` import edges (`{from, to, type}`)                        |
| `local/`                          | no (gitignored) | Per-run resolver output (`current-context.{json,md}`)                    |

See [`tools/knowledge/README.md`](../tools/knowledge/README.md) for the generation contract and what this layer deliberately does not do.
