# 12 — Coverage Plan: Simple Readable Code Operating System

## Touched modules

| Touched                                                                  | Coverage treatment                                                                                                                                              |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/modules/auth` (service import move + new `lib/password.helpers.ts`) | Covered by the existing `auth.service.spec.ts` (login paths exercise `verifyPassword` against real bcrypt hashes); repo-wide ≥ 95% floor must hold              |
| `eslint/*.mjs` config modules                                            | Outside the coverage `include` globs by standing config (mirrors the plugin precedent); validated instead by the 24-case config-activation spec + full lint run |
| `test/eslint/config-rule-activation.spec.mjs`                            | Test code — executes in `npm run test` / `test:coverage`                                                                                                        |
| Markdown (rules/skills/context/memory/docs/entrypoints)                  | Not coverable; validated by the adversarial verification sweep and link checks                                                                                  |

## Thresholds

Repository floor stays at 95% statements/functions/lines (90% branches per the agents/README note); no threshold changed, no exclusion added.

## Critical scenario areas

Auth login happy path + wrong-password + unknown-user paths (existing specs) — the only runtime code touched.

## Waivers

None requested.
