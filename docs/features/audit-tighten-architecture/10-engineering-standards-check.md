# 10 — Engineering Standards Review

## Standards review matrix

| Standard                                  | Enforced by                                                              | Status | Notes                                    |
| ----------------------------------------- | ------------------------------------------------------------------------ | ------ | ---------------------------------------- |
| Strict TypeScript                         | `tsconfig.json`                                                          | ✅     | No changes needed.                       |
| Zero ESLint errors/warnings               | `eslint.config.mjs`                                                      | ✅     | Must remain 0 after changes.             |
| No `any`                                  | TypeScript + ESLint                                                      | ✅     | Already enforced.                        |
| No `eslint-disable` / `@ts-ignore`        | Policy + review                                                          | ✅     | No suppressions added.                   |
| Zero inline declarations                  | `no-restricted-syntax` + new `architecture/no-inline-layer-declarations` | 🔄     | Strengthening with new rule.             |
| No magic strings/numbers                  | Constants files + new rule where feasible                                | 🔄     | Extract remaining literals.              |
| Thin controllers                          | `architecture/controller-no-logic`                                       | ✅     | No change.                               |
| Service ≤20 lines/method                  | `max-lines-per-function`                                                 | ✅     | No change.                               |
| Repository persistence-only               | Review + architecture map                                                | ✅     | Strengthening.                           |
| Adapter ownership                         | `packageImportBoundaries`                                                | ✅     | No change.                               |
| No `process.env` outside config/bootstrap | `architecture/no-restricted-layer-imports`                               | ✅     | Strengthening.                           |
| Logger adapter only                       | `no-console` + policy                                                    | ✅     | No change.                               |
| Typed AppError with `messageKey`          | `app-error.ts` + policy                                                  | ✅     | No change.                               |
| Tests first / with changes                | Policy + review                                                          | 🔄     | Update tests for new rules and refactor. |
| Documentation with changes                | Policy + review                                                          | 🔄     | Update all affected docs.                |

## Request-specific rules

1. No folder renames; keep the existing architecture map.
2. Add new ESLint rules only with valid and invalid fixtures.
3. The reference app must stay runnable and its API contract unchanged.
4. New AI-agent entrypoints must follow the canonical precedence and backend rules.
5. No weakening of strict rules to make lint pass.
6. No `--no-verify` bypass of Husky.

## Permanent-rule update check

If any new rule proves enduring (e.g., the DTO-import boundary), it must be reflected in `claude.md`, `AGENTS.md`, `.cursor/rules`, and the relevant `rules/` files. This will be done in the same delivery stream.

## Implementation constraints

- Keep `.mjs` ESLint rule files; do not introduce a build step for the plugin.
- Integrate rule tests into Vitest.
- Prefer small, reviewable changes over one large diff.
- Do not create duplicate helper files; search for an existing owner first.
