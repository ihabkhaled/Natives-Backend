# 02 — Business Development: Simple Readable Code Operating System

## Commercial value

IronNest is a reusable operating system for NestJS delivery. A codified simplicity policy directly lowers the cost of every future engagement: faster reviews, cheaper onboarding, fewer AI tokens burned on over-produced code, and fewer maintenance regressions. It is a differentiator for teams of mixed experience ("hundreds of developers, all levels can maintain it").

## Target segment / rollout audience

- All engineers and AI agents working in this repository or any repository bootstrapped from it.
- Effective immediately on merge; no tenant/account gating applies.

## Contract / SLA impact

None. No runtime behavior, API contract, or operational surface changes.

## Adoption risks

| Risk                                                        | Mitigation                                                                          |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| "Simplicity" misread as permission to skip safety           | Every new rule states explicitly that safety/validation/tests/docs are never cut    |
| New rules ignored because entrypoints are unchanged         | Compact pointer added to every agent entrypoint file                                |
| Duplicate guidance drifting across mirrors                  | Rule bodies live only in `rules/`; mirrors carry pointers per canonical-file policy |
| Over-extraction ("tiny files with no meaning") as a fashion | Rules 20/23 include explicit do-not-extract guidance                                |

## Enablement notes

- `rules/README.md` and `skills/README.md` indexes advertise the new material.
- `docs/sdlc/simple-readable-code.md` is the human-readable baseline for onboarding.
- Memory (`memory/code-simplicity-decisions.md`) records the durable decisions for future agents.
