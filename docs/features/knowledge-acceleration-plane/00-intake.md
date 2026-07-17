# 00 — Intake: Knowledge Acceleration Plane

## Request metadata

| Field               | Value                                                                                    |
| ------------------- | ---------------------------------------------------------------------------------------- |
| Request ID          | `GOV-2026-07-10`                                                                         |
| Title               | Right-sized AI knowledge-acceleration layer: `tools/knowledge/` generator + CLI resolver |
| Type                | Internal tooling / AI-agent behavior / documentation                                     |
| Source              | Repository owner                                                                         |
| Severity            | Low                                                                                      |
| Urgency             | Low                                                                                      |
| Affected domains    | Developer/AI-agent tooling, governance docs (memory/context additions), CI               |
| Delivery track      | Standard                                                                                 |
| Critical-risk flags | None (no auth, money, privacy, tenant, or runtime application behavior touched)          |

## Initial scope statement

Add a compiled AI-acceleration layer on top of the existing, already-large canonical governance corpus (`rules/`, `skills/`, `context/`, `memory/`, `agents/`, `testing/` — 129 files, ~367K tokens):

1. `tools/knowledge/` — a dependency-free Node ESM generator that builds 4 committed JSON manifests (`repository.json`, `modules.json`, `documents.json`, `dependency-graph.json`) plus a compact `.ai/BOOTSTRAP.md`, and a deterministic `resolve-context.mjs` CLI that ranks relevant docs/source for a `--task="..."` description.
2. A hash-based staleness check (`knowledge:check`) wired into `npm run validate` and a new CI gate.
3. Three genuinely-missing documentation files added by extending existing patterns: `memory/privacy-decisions.md`, `memory/operations-decisions.md`, `context/contracts-map.md`.

Full scoping rationale (what was investigated, what was explicitly declined and why) lives in `06-technical-refinement.md` — it mirrors the approved plan.

## Owners

| Role            | Owner                                                                                   |
| --------------- | --------------------------------------------------------------------------------------- |
| Technical owner | Repository architect                                                                    |
| Implementation  | AI-assisted delivery agent                                                              |
| QA              | Automated test suite + lint/typecheck/coverage/build gates + new `knowledge:check` gate |
| Docs            | Same delivery agent                                                                     |

## In-scope

- `tools/knowledge/` generator + CLI, with Vitest specs mirroring `test/eslint/architecture-plugin/rules/*.spec.mjs`.
- 4 committed JSON manifests + `.ai/BOOTSTRAP.md` under `.ai/`.
- `package.json` scripts (`knowledge:build`, `knowledge:check`, `knowledge:context`) and `validate` chain update.
- New `.github/workflows/gate-knowledge.yml`.
- `memory/privacy-decisions.md`, `memory/operations-decisions.md`, `context/contracts-map.md`.
- Route-table updates in `memory/ai-context-map.md`, `context/codebase-navigation.md`, `context/README.md`, `memory/README.md`, root `README.md`.

## Out-of-scope

- Any new top-level canonical directory (`security/`, `privacy/`, `operations/`, `product/`, `domain/`, `contracts/`, `quality/`, `incidents/`, `knowledge/`, `structure/`) — each is either already covered or genuinely not applicable; see `06-technical-refinement.md`.
- AST-based symbol extraction, semantic embeddings, file-watching, static per-task-type context packs, call/contract/event/deployment graphs — all explicitly declined with reasons.
- Filing real ADRs into `architecture/adrs/` (would require fabricating historical decisions).
- Any change to application runtime behavior, `src/modules/*` business logic, or existing rules/skills/agents content.
