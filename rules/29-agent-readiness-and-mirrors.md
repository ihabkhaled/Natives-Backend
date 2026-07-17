# 29 — Agent Readiness and Mirrors

> Every supported coding agent must reach the same canonical rules quickly without creating another source of truth.

## Authority

`claude.md` is the global canonical policy and wins every conflict. Within subordinate NestJS engineering guidance, `rules/00-non-negotiable-rules.md` and `context/architecture-map.md` are the hard policy; layer rules define requirements, skills are procedures, context routes, and memory records decisions. A stricter safety rule may block work but never override `claude.md`.

## Entrypoint requirements

Each supported entrypoint must:

- direct the agent to `claude.md`, rules index/00, architecture map, skills index, cleanup skill, declaration ownership, and known pitfalls;
- carry the compact Simple Code Ladder and minimum-safe-code sentence;
- state that tests/docs/security/validation/auth/authorization/ownership/observability/architecture are never reduced;
- identify whether it is a full mirror, bootstrap, active rule, or compact family entrypoint;
- avoid copying large rule bodies.

## Synchronization

Permanent policy changes update `claude.md` first, then full mirrors and compact pointers in the same delivery. Broken/stale links, mismatched rule counts, and conflicting thresholds are defects.

## Agent implementation behavior

Agents read real code and tests, search the owner, document phases 00–13, write tests first for changed behavior, make the smallest safe change, run repository scripts, and report gaps rather than claiming false readiness.

## Review checklist

- [ ] Canonical precedence is explicit and consistent.
- [ ] Simple Code Ladder and safety boundary are present compactly.
- [ ] Required links resolve and point to current owners.
- [ ] No giant duplicated rule body or unsupported agent-specific exception.
- [ ] `claude.md` remains canonical; skills defer to rules.

**Related:** [30-declaration-ownership.md](./30-declaration-ownership.md) · [../context/agent-readiness-map.md](../context/agent-readiness-map.md) · [../skills/prepare-agent-mirrors.md](../skills/prepare-agent-mirrors.md)
