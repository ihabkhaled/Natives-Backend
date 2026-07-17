# Agent Readiness Map

## Required load order

1. `claude.md`
2. `docs/features/<current-request>/00`–`13`
3. `context/architecture-map.md`
4. `rules/00-non-negotiable-rules.md`
5. Affected layer rules plus rules 20, 22, 28, and 30
6. Matching skill and `skills/full-codebase-cleanup.md` for broad work
7. `memory/known-pitfalls.md`
8. Real code and tests

## Entrypoint roles

- Canonical long form: `claude.md`
- Full reference mirrors: `codex.md`, `cursor.md`
- Codex bootstrap: `AGENTS.md`
- Active Cursor policy: `.cursor/rules/*.mdc`
- Legacy shim: `.cursorrules`
- Compact family entrypoints: family-named root markdown files

`codex.md` fulfills GPT/Codex/Sol full-mirror needs; do not add another full copy.

## Synchronization set

Permanent rule change → canonical policy → rules/index → context/skills/memory → full mirrors → active/legacy Cursor files → affected compact family entrypoints → README/docs/request artifacts.

Review with [skills/prepare-agent-mirrors.md](../skills/prepare-agent-mirrors.md). Broken links, stale rule ranges/counts, commands, thresholds, and conflicting precedence are blockers.
