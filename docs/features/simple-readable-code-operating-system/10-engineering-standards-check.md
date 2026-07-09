# 10 — Engineering Standards Review: Simple Readable Code Operating System

## Standards review matrix

| Standard                                  | Enforced by                                         | Status | Notes                                                                     |
| ----------------------------------------- | --------------------------------------------------- | ------ | ------------------------------------------------------------------------- |
| Strict TS / no `any` / no suppressions    | tsconfig + typescript.config.mjs                    | ✅     | Untouched                                                                 |
| Zero inline declarations in layer files   | `architecture/no-inline-layer-declarations`         | ✅     | **Revived** — was silently dead (regex-as-glob `files:` entries)          |
| Adapter concurrency ban                   | `no-restricted-syntax` on adapter globs             | ✅     | **Revived** — same defect                                                 |
| Domain DTO isolation                      | `architecture/no-dto-import-in-domain-or-use-case`  | ✅     | **Revived** on `domain/**` + policy/entity/state-machine globs            |
| Service ≤ 20 lines/method                 | `max-lines-per-function` on `**/*.service.ts`       | ✅     | Unchanged                                                                 |
| Cognitive complexity                      | `sonarjs/cognitive-complexity`                      | ✅     | Tightened 20 → **15** (stricter-only)                                     |
| Cyclomatic complexity ≤ 15                | `complexity` (new)                                  | ✅     | base.config.mjs                                                           |
| Nesting depth ≤ 3                         | `max-depth` (new)                                   | ✅     | base.config.mjs                                                           |
| No nested ternaries                       | core `no-nested-ternary` (new)                      | ✅     | Unicorn variant is disabled by eslint-config-prettier — core rule owns it |
| Guard-clause style                        | `no-else-return` (new)                              | ✅     | `allowElseIf: false`                                                      |
| Parameter immutability / no return-assign | `no-param-reassign`, `no-return-assign` (new)       | ✅     | base.config.mjs                                                           |
| One class per layer file                  | `max-classes-per-file: 1` (new)                     | ✅     | On implementation-layer globs                                             |
| Config `files:` glob correctness          | `test/eslint/config-rule-activation.spec.mjs` (new) | ✅     | 24 assertions; regression guard for the silent-disable defect             |
| Line endings                              | `.gitattributes` `* text=auto eol=lf` (new)         | ✅     | Prettier-as-lint now consistent on every OS                               |

## Request-specific rules

1. No existing rule text weakened; every change is additive or stricter.
2. Rule bodies live once in `rules/`; mirrors and entrypoints carry compact pointers only.
3. Simplicity guidance must restate, in place, that safety guarantees are never cut (rule 46).
4. Extend existing owners (rules/06 §6, rules/13, rules/15, docs/sdlc files) instead of creating parallel documents.
5. No `eslint-disable`, `@ts-ignore`, or `--no-verify` used anywhere in this delivery.

## Permanent-rule update check

Permanent rules WERE created: non-negotiables 43–46 and rules 20–24. `claude.md` (canonical), both mirrors, and all entrypoints were updated in the same delivery stream per the canonical-file rules.

## Documented future lint improvements (not implemented — false-positive risk or scope)

`no-magic-numbers` (would fight the LOG_PREFIX/local-literal conventions), `@typescript-eslint/explicit-module-boundary-types`, `no-shadow`, `no-await-in-loop`, `max-params`, `sonarjs/no-duplicate-string`, per-layer `max-lines-per-function` tiers (transport 10 / business 40 / orchestration 80), `max-lines` per file, linting the `eslint/*.mjs` config modules themselves (currently ignored by `ignores.config.mjs`).

## Implementation constraints

- Reference app behavior frozen; only root-cause fixes to keep gates green.
- All markdown follows the folder-local house formats captured during investigation.
- New spec files use the established `test/eslint/*.spec.mjs` + Vitest harness.
