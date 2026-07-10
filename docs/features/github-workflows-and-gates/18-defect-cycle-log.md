# 18 — Defect Cycle Log

## Cycle 1

- Direct-only TypeScript 7 install failed runtime consumers.
- Reworked to vendor-supported side-by-side compiler/API ownership.
- Regenerated lockfile and reran install, lint, typecheck, build, tests, and security checks.

## Cycle 2

- Unit gate exposed undeclared parser dependency.
- Declared and upgraded `@typescript-eslint/parser`.
- Unit/static-rule suite rerun passed.

## Cycle 3

- Workflow inspection found duplicate coverage YAML.
- Removed duplicate definition and scheduled final formatting/static validation.

## Decision

Return to release-gate validation after one final uninterrupted all-gates run.
