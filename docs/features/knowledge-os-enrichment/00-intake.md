# 00 — Intake: Knowledge-OS Enrichment & Governance Gap-Fill

## Request metadata

| Field               | Value                                                                                        |
| ------------------- | -------------------------------------------------------------------------------------------- |
| Request ID          | `GOV-2026-07-12`                                                                             |
| Title               | Enrich the compiled knowledge plane (routing/benchmark/verify) and fill audited Part II gaps |
| Type                | Engineering-operating-system enhancement / tooling / governance gap-fill                     |
| Source              | Repository owner (Universal Knowledge-OS mega-prompt)                                        |
| Severity            | Medium                                                                                       |
| Urgency             | Medium                                                                                       |
| Affected domains    | Knowledge tooling (`tools/knowledge`), skills, docs/sdlc, runbooks, rules, `claude.md`       |
| Delivery track      | Standard                                                                                     |
| Critical-risk flags | None (no auth, money, privacy, tenant, or application runtime change)                        |

## Origin and decision

The owner supplied a large "Universal Knowledge-OS & Engineering-Governance" spec (Part I: a compiled `.ai/` acceleration plane; Part II: the full governance corpus). A reconciliation established that the repo already satisfies ~90–95% of it — Part I's core shipped last delivery (`feat/knowledge-acceleration-plane`), and Part II (rules, skills, agents, SDLC brain, mirrors, runbooks) already exists. Two scoping decisions were confirmed with the owner:

1. **Part I → targeted enrichment** (not the heavier `scripts/knowledge/` compiler): add a routing-map-driven task→pack layer, a golden-benchmark gate, and a contradiction-check.
2. **Part II → full section-by-section audit (§12–§23) + fill only the genuine gaps** (no duplication; §19 AI/ML governance is N/A — no AI component).

## Initial scope statement

1. Compile `memory/ai-context-map.md`'s task-router table into an executable routing-map; emit a curated pack (rules/skills/reviewers/lane/validation) from the resolver.
2. Add a golden-benchmark routing-regression gate and a contradiction-check gate; wire both into `validate` and CI-equivalent scripts.
3. Fill the four genuine Part II gaps the audit found: the `resolve-task-context` skill (§15), the exceptions register (§22), the safe-diagnostics runbook + runbooks index (§18), and the incomplete repository-structure section in `claude.md` (§23).

## Owners

| Role            | Owner                                                |
| --------------- | ---------------------------------------------------- |
| Technical owner | Repository architect                                 |
| Implementation  | AI-assisted delivery agent                           |
| QA              | Automated test suite + lint/typecheck/coverage gates |
| Docs            | Same delivery agent                                  |

## In-scope

- `tools/knowledge/` enrichment (routing-map, resolve-pack, golden benchmark, contradiction-check) + tests + npm scripts.
- The four Part II gap-fills + their index/route-table updates.
- SDLC artifacts for this request.

## Out-of-scope (non-goals)

- The heavier `knowledge/` authored folder + `scripts/knowledge/` ~20-command compiler (explicitly scoped out by the owner).
- Re-creating any existing rule/skill/agent/doc (audit confirmed present).
- §19 AI/ML pipeline governance (no AI/ML component exists).
- Deployment/secret-rotation/outage runbooks (consciously deferred — no deployment target; `memory/operations-decisions.md`).
- HOT_MEMORY/active-work file, env-vars.md, thin skill wrappers, ADR backfill, codex/cursor thinning (declined with reasoning in `06-technical-refinement.md`).

## Critical-risk review

No money flow, auth, permissions, privacy, tenant, compliance, or application runtime is touched. `src/` is read-only input to the generator; the one `src`-adjacent change is none (all new code is under `tools/` and `test/`).
