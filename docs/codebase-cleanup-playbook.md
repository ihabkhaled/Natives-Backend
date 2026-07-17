# Codebase Cleanup Playbook

Use [skills/full-codebase-cleanup.md](../skills/full-codebase-cleanup.md); this page is the operational summary.

## Audit

- Establish clean lint/type/test baselines.
- Inventory governance owners before adding files.
- Trace protected routes, validation, errors, persistence scope, config, vendors, and logs.
- Classify findings as safety defect, wrong owner, duplicate, dead surface, size/readability debt, or static-enforcement gap.

## Refactor order

1. Security/auth/permissions/ownership and validation.
2. Declaration ownership and direct vendor access.
3. Controllers → application → domain → repositories → adapters.
4. Core/shared/config/bootstrap.
5. Tests/fixtures and canonical examples.
6. Static enforcement and documentation alignment.

For each finding: name the owner, add a test first if behavior can move, change one responsibility, update wiring/exports/docs, delete the old surface, run the focused test.

## Do not

Rewrite the architecture, split by line count, mix unrelated upgrades, weaken assertions/rules, move business policy into repositories, wrap SDK calls in `lib/`, filter tenant data after pagination, or delete guards/bounds/errors as “duplicate.”

## Completion

Run format check, lint, typecheck, test, coverage, build, security scan, and dependency check when available. Record actual evidence in the feature artifacts; external QA/UAT/release approvals remain external.
