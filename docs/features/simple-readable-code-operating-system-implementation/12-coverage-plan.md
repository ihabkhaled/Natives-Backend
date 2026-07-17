# 12 — Coverage Plan

## Touched logic modules

- ESLint architecture plugin and resolved configuration.
- Auth token/password adapters, identity validator/mapper, auth service, JWT and permission guards.
- Article ownership policy/mapping, service, and repository.
- Config parsers and environment validation.
- Error mapping or typed pipe behavior if changed.

## Thresholds

- Statements: at least 95%.
- Lines: at least 95%.
- Functions: at least 95%.
- Branches: existing repository floor of at least 90%, with every real security/validation branch exercised.
- Critical auth/permission/ownership/config logic: near-complete scenario coverage regardless of aggregate percentage.

## Critical scenarios

Valid/invalid credentials, valid/invalid/malformed JWT payload, missing/invalid bearer header, allowed/denied permissions, missing identity, same-owner/cross-owner access, pagination before/after scope, config defaults/invalid values/production secrets, and lint-rule valid/invalid AST forms.

## Measurement and evidence

`npm run test:coverage` is authoritative. Focused specs are run while refactoring; final summary and any uncovered real branch are reviewed against `coverage/lcov`/text output.

## Exclusions

Pure declarations, DTO metadata, Nest module wiring, and bootstrap assembly follow the existing Vitest coverage policy; behavior is covered through e2e/module boot tests. No application logic is newly excluded.

Custom ESLint `.mjs` logic is not part of the application V8 denominator because RuleTester loads it outside the application transform. Its coverage evidence is behavioral: valid/invalid AST cases plus real resolved-config activation tests, including aliases, re-exports, dynamic/template imports, nested layers, and package subpaths.

## Waiver status

No waiver requested or planned.
