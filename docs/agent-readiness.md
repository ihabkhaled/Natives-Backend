# Agent Readiness

An agent-ready repository lets any supported model find authoritative policy, code owners, tests, commands, and known traps without guessing.

## Required entrypoint route

1. `claude.md` — canonical long-form policy.
2. `rules/00-non-negotiable-rules.md` and `context/architecture-map.md`.
3. Rules 20, 22, 28, and 30 for simplicity, reuse, refactor, and declaration ownership.
4. `skills/README.md` and `skills/full-codebase-cleanup.md`.
5. `memory/known-pitfalls.md`.

Entrypoints carry only the compact Simple Code Ladder and safety boundary plus links. Full mirrors must match `claude.md`; family files must not invent exceptions.

## Readiness checks

- Every current rule/skill/context/memory file is indexed.
- Reference patterns match live lint and strict TypeScript.
- Commands come from `package.json`.
- Static enforcement has activation tests.
- Request artifacts reveal assumptions, risks, validation, and rollback.
- Public module owners and adapter boundaries are discoverable.
- No stale rule counts, broken links, duplicate full mirror, or unsupported model-specific policy.

`codex.md` is the full GPT/Codex mirror in this repository; a separate GPT Sol copy is unnecessary. `claude.md` remains canonical.
