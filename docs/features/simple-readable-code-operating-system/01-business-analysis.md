# 01 — Business Analysis: Simple Readable Code Operating System

## Problem statement

IronNest already enforces _where_ code lives (layers, boundaries, gates) but does not yet state, as permanent policy, _how simple that code must read_. Without an explicit simplicity policy, AI agents and humans under strict rules tend to over-produce: speculative abstractions, clever TypeScript, duplicate helpers, oversized diffs, and "framework demo" code that is technically compliant but expensive to read, review, and maintain — especially for a mixed-experience team.

## Stakeholders and personas

| Persona                     | Pain today                                                               |
| --------------------------- | ------------------------------------------------------------------------ |
| Junior backend engineer     | Cannot follow clever chains, type gymnastics, or 500-line services       |
| Senior engineer / tech lead | Burns review time untangling speculative abstractions and duplicate code |
| QA engineer                 | Unreadable test setups hide what behavior is actually proven             |
| Security reviewer           | Hidden side effects and magic flows obscure the security surface         |
| Production support          | Cannot trace incidents through indirection layers                        |
| AI coding agents            | No explicit instruction to prefer boring, reuse-first, minimal-safe code |
| Future maintainers          | Every change touches many places because logic has no single owner       |

## Current state

- Rules `00`–`19` cover architecture, security, validation, testing, observability, i18n, config, errors, async.
- Rule 00 §13 already bans duplicate constants/util files; rule 03 caps service methods at ~20 lines; ESLint enforces layer boundaries.
- No rule owns: readability as a goal, YAGNI, the reuse-before-create search procedure, clever-TypeScript limits, or a team-readable review checklist.

## Desired state

A permanent, canonical Simple Readable Code Operating System: rules `20`–`24`, ten applying skills, compact agent-entrypoint pointers, durable memory decisions, context navigation, and a docs/sdlc baseline — all consistent with (and never weakening) existing policy.

## Business goals and success metrics

| Goal                    | Metric                                                                                  |
| ----------------------- | --------------------------------------------------------------------------------------- |
| Lower review cost       | Reviewers can answer the rule-24 checklist without archaeology                          |
| Lower onboarding cost   | A junior can follow any use case top-to-bottom (stated review gate)                     |
| Less duplicate code     | Reuse-before-create search is a documented, checkable step                              |
| Less AI over-production | Agent entrypoints instruct minimal-safe output; Simple Code Ladder runs before new code |
| No safety regression    | All existing gates stay green; no rule weakened (verified in review)                    |

## Assumptions

- Docs/governance changes do not require runtime code changes; gates must still pass unchanged.
- Existing ESLint size/complexity enforcement is largely sufficient; changes only if safe and tested.

## Dependencies

- Canonical precedence chain: `claude.md` → `rules/00` + `context/architecture-map.md` → layer rules → skills.

## Risks of not doing the work

Continued token-burning output from AI agents, growing duplicate helpers, slower reviews, junior attrition on unreadable code, and a widening gap between "passes gates" and "maintainable".
