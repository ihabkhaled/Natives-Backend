# 06 — Technical Refinement: Knowledge-OS Enrichment & Gap-Fill

## Technical context

The compiled `.ai/` plane (manifests + BOOTSTRAP + deterministic resolver + staleness gate) shipped last delivery. This change adds the three highest-value pieces of the mega-prompt's Part I that a 115-source-file repo actually benefits from, and fills the four genuine Part II gaps a full §12–§23 audit found. The audit's non-gaps (§13/§14/§16/§17 largely complete; §12 realized) are deliberately left untouched.

## Part I — chosen approach

- **Routing-map task→pack layer.** Authored as `tools/knowledge/data/routing-map.mjs` (dependency-free `.mjs`, not YAML — the tooling has no YAML parser and config-as-`.mjs` is the repo convention). It is the executable compilation of `memory/ai-context-map.md`'s task-router + reviewer tables, not a parallel router (rules/22). `lib/resolve-pack.mjs` matches a task to entries (whole-word single keywords, phrase substrings for multi-word) and merges the top matches into one bundle: strictest lane, unioned rules/skills/reviewers/validation. `resolve-context.mjs` emits it as a guaranteed "Curated pack" section alongside the keyword-ranked results.
- **Golden benchmark.** `data/golden-tasks.mjs` (12 realistic phrasings + expected mustInclude paths + expected lane), `lib/run-benchmark.mjs` (asserts each mustInclude is surfaced in warm-up ∪ pack ∪ ranked, and the lane matches), a `benchmark.mjs` CLI (`knowledge:benchmark`), and a Vitest gate. A routing regression now fails a test.
- **Contradiction-check.** `data/contradiction-checks.mjs` intent encoded in `lib/run-checks.mjs`: assert-file-exists (governance files), mirror-sync (every family router carries the shared marker), assert-paths-exist (warm-up, routing-map, golden-task paths), assert-absent (no blind suppressions in `src/`). A `verify.mjs` CLI (`knowledge:verify`), a Vitest gate, and wired into `validate`.

### Alternatives considered

| Option                                                                        | Verdict                                                                                        |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `routing-map.yaml` + a YAML parser dependency                                 | Rejected — breaks the dependency-free contract; `.mjs` is the repo convention                  |
| Full `scripts/knowledge/` ~20-command compiler + authored `knowledge/` folder | Rejected — owner scoped to targeted enrichment; over-built for 115 files (rules/21)            |
| Fold benchmark/verify into `knowledge:check` only (no separate scripts)       | Rejected — separate scripts give manual entry points; Vitest specs give the auto-gate          |
| Duplicate `loadManifests` into the benchmark CLI                              | Rejected — extracted to `lib/load-manifests.mjs`, re-exported for the existing spec (rules/22) |

## Part II — chosen fills (genuine gaps only)

| Gap                                                               | Fill                                                                                                                                                  | Why not a duplicate                                                                                                                   |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| §15 — no skill makes the resolver the mandatory first step        | `skills/resolve-task-context.md` + skills/README step 0 + route-table row                                                                             | The tooling existed but no playbook designated it; nothing else covers it                                                             |
| §22 — no discoverable exceptions register                         | `docs/sdlc/exceptions-register.md` (indexes the 6 real relaxations) + template + pointers from rules/00 §4-6 and rules/13                             | Aggregates what was scattered/in-place into one owned index; the bans already existed but nothing collected the sanctioned exceptions |
| §18 — no safe-diagnostics meta-runbook; runbooks index incomplete | `runbooks/safe-diagnostics.md` + fixed `runbooks/README.md` (all 6 files)                                                                             | Genuinely absent (grep-confirmed); the index omitted 3 files                                                                          |
| §23 — `claude.md` structure section omits engineering folders     | Rewrote "Mandatory Repository Structure" to include rules/skills/context/memory/agents/testing/eslint/tools/.ai; synced to codex.md/cursor.md mirrors | The section literally omitted them; README had the full list but the named-canonical section did not                                  |

## Deliberately declined (recorded, not dropped)

- **HOT_MEMORY / active-work file** — a perpetually-near-empty governed file is the speculative artifact rules/21 forbids for a solo reference kit; `.ai/local/current-context.md` already serves the ephemeral per-task role.
- **Deployment / secret-rotation / dependency-outage runbooks** — consciously deferred per `memory/operations-decisions.md` (no deployment target); filling them would fabricate environment-specific content.
- **env-vars.md, local-dev-environment doc, thin skill wrappers** (create-ADR/update-memory/prepare-release/…) — each duplicates an existing owner (`.env.example`+rules/17; README Quick start; runbooks/rules/memory).
- **codex.md/cursor.md thinning** (§12.3) — the full-mirror shape is an intentional, documented repo decision; changing it would contradict the owner's own precedence rules.
- **ADR backfill** — filing ADRs now would fabricate history; `memory/*-decisions.md` already is the decision log.
- **§19 AI/ML pipeline governance** — no AI/ML component in `src/`.

## Debt impact

Reduces debt: the contradiction-check now mechanically guards mirror-sync and resolver-path integrity (previously unchecked); the golden benchmark guards routing quality; the exceptions register makes every relaxation discoverable and owned.
