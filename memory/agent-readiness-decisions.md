# Agent Readiness Decisions

## Decision: one canonical policy

`claude.md` remains the long-form authority. Rules are policy, skills are procedures, context routes, and memory records rationale. Compact entrypoints never override them.

## Decision: full mirrors are exceptional

`codex.md` and `cursor.md` are the existing full mirrors. `codex.md` fulfills the GPT-family/Sol request; another full GPT copy would add drift without a new consumer.

## Decision: entrypoints route, not restate

Every supported agent receives the Simple Code Ladder, the minimum-safe boundary, and links to rule 00, simplicity/reuse/refactor/declaration rules, skills index/full cleanup, architecture map, and known pitfalls.

## Decision: synchronization is part of delivery

Permanent changes update canonical policy, mirrors, active Cursor rules, legacy shim, and relevant family files together. Broken links, stale rule ranges, commands, or thresholds are defects.

**See:** [rules/29-agent-readiness-and-mirrors.md](../rules/29-agent-readiness-and-mirrors.md) · [context/agent-readiness-map.md](../context/agent-readiness-map.md).
