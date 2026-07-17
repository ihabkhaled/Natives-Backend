# 03 — Product Requirements: Simple Readable Code Operating System

## Epic

As an engineering organization with mixed experience levels and heavy AI-agent usage, we want a permanent Simple Readable Code Operating System wired into IronNest governance so every future change is junior-readable, senior-trustworthy, reuse-first, and minimal-safe.

## User stories and acceptance criteria

| #   | Story                                                                       | Acceptance criteria                                                                                                      |
| --- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| 1   | As an engineer, I can read canonical simplicity rules in `rules/`           | `rules/20`–`24` exist, follow existing rule format, are indexed in `rules/README.md`, and never contradict `rules/00`    |
| 2   | As an engineer, I can follow step-by-step simplicity playbooks in `skills/` | 10 new skills exist, follow existing skill format, end with the standard quality gates, indexed in `skills/README.md`    |
| 3   | As an AI agent, I see the Simple Code Ladder before writing code            | Every agent entrypoint carries the compact ladder + pointer; no entrypoint duplicates full rule bodies                   |
| 4   | As a reviewer, I have a team-readable review checklist                      | Rule 24 checklist exists; `rules/15` and `docs/sdlc/code-review-checklist.md` link to it                                 |
| 5   | As a future agent, durable decisions are in memory                          | `memory/code-simplicity-decisions.md` exists; `memory/known-pitfalls.md` gains over-production pitfalls; indexes updated |
| 6   | As a navigator, I can find where simplicity concerns live                   | `context/simple-code-map.md` exists and is indexed; `codebase-navigation.md` links to it                                 |
| 7   | As a policy owner, the ESLint enforcement state is known                    | Rule 13 / the standards artifact records what is already enforced and what gaps remain, with a tested-change-only policy |
| 8   | As a gatekeeper, nothing regressed                                          | `lint`, `typecheck`, `test`, `test:coverage`, `build`, `security:scan` all green; no existing rule text weakened         |

## In-scope

Rules, skills, agent entrypoints, memory, context, docs/sdlc, README mention, SDLC artifacts, ESLint investigation.

## Out-of-scope / non-goals

- Runtime/app code changes; new modules; new dependencies.
- Weakening any existing rule, threshold, gate, or hook.
- "Fewest lines at any cost": minimal means minimum **safe** code (validation, auth, ownership, AppError/messageKey, adapters, bounds, tests, docs all stay).

## UX expectations

Not applicable (no user-facing product surface). Accepted by: repository architect — this is a governance/documentation change.

## Error states / permissions / analytics / localization expectations

Not applicable — no runtime behavior changes. Accepted by: repository architect. Localization discipline itself (rule 16) is restated, not modified.

## Product definition of done

All acceptance criteria above pass; all gates green; documentation changelog artifact lists every touched file.
