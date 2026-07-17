# 08 — Architecture Review: Simple Readable Code Operating System

## Current architecture context

The one-way layered architecture in `context/architecture-map.md` is unchanged. This change adds judgment-layer rules (how simple code must be) on top of the structural rules (where code lives), plus enforcement corrections.

## Impact by area

| Area                   | Impact                                                                                                                           |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Layer model            | None — budgets per layer restated in rules/23, unchanged                                                                         |
| Module anatomy         | None — `lib/`/`domain/`/`model/` ownership reaffirmed; `src/modules/auth/lib/` created per that anatomy                          |
| Import boundaries      | Strengthened — three dead ESLint overrides now actually enforce (inline declarations, adapter concurrency, domain DTO isolation) |
| Public surfaces        | None — no barrel changed except documentation                                                                                    |
| Contracts / data flows | None                                                                                                                             |
| Enforcement            | Stricter — new simplicity caps; `files:` glob correctness now regression-tested                                                  |

## Boundary or contract changes

None. `verifyPassword` moved within the auth module (service → `lib/`), private to the module.

## ADR decision

No new ADR required: no architecture shape changed. The durable decisions are recorded in `memory/code-simplicity-decisions.md` per the memory conventions; the precedence chain (`claude.md` → `rules/00` + architecture map → layer rules → skills) is unchanged and restated in every new file.

## Architecture risks

- Revived rules could reject future code patterns that were silently tolerated — intended behavior; the config-activation spec makes any future silent disablement a test failure.
- None to runtime.
