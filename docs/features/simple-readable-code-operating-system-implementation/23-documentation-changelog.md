# 23 — Documentation Changelog

## Governance

- Added rules 25–30 and extended rule 00, layer rules, testing/coverage, and review guidance.
- Added eight missing focused cleanup/mirror skills and normalized the requested existing skills with explicit intent/use/not-use/checklist/gates.
- Added practical docs for readable code, AI style, cleanup, declarations, maintenance, token cost, review, agent readiness, security-safe and validation-safe refactoring.

## Context and memory

- Added declaration ownership, refactor, agent-readiness, security, and validation maps.
- Added refactor/agent/security/validation decision records and updated simplicity, architecture, library, security, context-map, and pitfalls memory.
- Updated reference patterns to use wrapped validation/OpenAPI imports, model contracts, app-owned config, structural HTTP types, and `declare readonly`.

## Agent entrypoints

- Updated `claude.md` first, full `codex.md`/`cursor.md` mirrors, `AGENTS.md`, Cursor rules/shim, and five family files.
- Added compact `MISTRAL.md`.
- Converted all six family files to compact routers and kept `codex.md`/`cursor.md` byte-identical to canonical policy.
- Did not create redundant `OPENAI.md`, `ANTHROPIC.md`, or GPT Sol full copies: `codex.md` and `claude.md` already own those roles.

## Runtime/tooling docs

- Updated README, `.env.example`, architecture map, adapter registry, testing standards, coverage policy, and source-facing skill examples.
- Removed unused Passport and Istanbul dependencies/documentation; standardized live V8 and coverage wording.
- Added release note, support guide, config/auth smoke runbook, and reusable auth/permission/ownership security test case.
- Added this request's phase 00–27 artifacts.

## Documentation gaps

No blocking local documentation gap. External QA/security/release approvals must update phases 17/19/22/25 when performed.

## Owners

Repository architect/release owner maintains policy and approvals; future behavior changes update the same owners in one delivery.
