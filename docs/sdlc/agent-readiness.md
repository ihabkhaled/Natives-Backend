# Agent Readiness SDLC Baseline

AI-agent support is a maintained delivery surface.

Permanent policy changes update `claude.md` first, then engineering rules/context/skills, full mirrors, active Cursor rules, legacy shims, and compact family entrypoints in the same delivery. The change must record affected entrypoints, link checks, rule/threshold consistency, and rollback.

Agent readiness never lowers human review, testing, security, QA, release, or approval requirements. Agents must produce the same phase artifacts and validation evidence as any engineer.

Release is blocked when an entrypoint contradicts canonical policy, points to missing owners, advertises stale commands, duplicates large policy bodies, or creates an undocumented model-specific exception.

Canonical engineering rule: [rules/29-agent-readiness-and-mirrors.md](../../rules/29-agent-readiness-and-mirrors.md). Procedure: [skills/prepare-agent-mirrors.md](../../skills/prepare-agent-mirrors.md).
