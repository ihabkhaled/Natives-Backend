# GLM.md — IronNest Agent Entrypoint

This is the compact GLM-family router, not a policy mirror.

Read `claude.md` first; it is globally canonical. Rules are policy, skills are procedures, and `claude.md` wins every conflict.

Before writing code, run the IronNest Simple Code Ladder:

`need it → reuse existing → native/platform → existing adapter/dependency → small helper → direct readable code → new abstraction only when justified`

Be lazy about code volume, never lazy about reading, validation, security, authentication, authorization, ownership, tests, docs, observability, rollback, or architecture.

Required route:

1. `claude.md`
2. `rules/README.md` and `rules/00-non-negotiable-rules.md`
3. `rules/20-simple-readable-code.md`, `rules/22-reuse-before-creating.md`, `rules/28-codebase-refactor-discipline.md`, `rules/30-declaration-ownership.md`
4. `context/architecture-map.md`, `context/refactor-navigation.md`, `context/declaration-ownership-map.md`
5. `skills/README.md`, `skills/full-codebase-cleanup.md`
6. `memory/known-pitfalls.md`
7. Real code and tests

Keep controllers thin, services focused, use cases transactional/orchestrating, domain pure, repositories persistence-only/bounded/scoped, and vendors behind app-owned adapters. Use typed config, the logger adapter, DTO validation, typed `AppError` keys, auth + permissions + ownership, strict TypeScript/ESLint, and tests/docs in the same change.

Run repository scripts; never use `--no-verify`, `eslint-disable`, `@ts-ignore`, `any`, or assertions to force a gate.

Every CI gate must be green **before you commit and before you push** — formatting, lint, typecheck, unit, coverage, e2e, build, knowledge build/validation, OpenAPI contract, security, and the aggregate `all-gates-green` check (rule 52, `rules/31-ci-gates-before-commit-and-push.md`). After any `src/**` or corpus change, run `npm run knowledge:build` and commit the regenerated `.ai/**` in the same commit. Fix a red gate at its root cause; never mark a required check optional or `continue-on-error`.
