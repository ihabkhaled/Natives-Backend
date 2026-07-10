# Skills Index

> Step-by-step recipes for the most common NestJS backend changes. Each skill applies — never replaces — the canon in [00-non-negotiable-rules.md](../rules/00-non-negotiable-rules.md) and [/context/architecture-map.md](../context/architecture-map.md). Every skill ends with the same quality gates you must run before declaring the task done.

Skills are procedures, not policy. When a skill and a rule appear to disagree, the rule wins — fix the skill or surface the conflict. The authoritative sources, in priority order:

1. [/rules/00-non-negotiable-rules.md](../rules/00-non-negotiable-rules.md) — the hard rules.
2. [/context/architecture-map.md](../context/architecture-map.md) — the layered architecture (single source of truth).
3. [/context/stack-and-toolchain.md](../context/stack-and-toolchain.md) — the exact toolchain + commands.
4. [/memory/known-pitfalls.md](../memory/known-pitfalls.md) — learned-mistake log.
5. The relevant skill below.

---

## Catalog

### Authoring — build the thing

| Skill                                                        | Use when you need to…                                                                                                          |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| [create-module.md](./create-module.md)                       | Scaffold a brand-new `src/modules/<feature>/`, wire its `*.module.ts`, and expose only its `index.ts` public surface.          |
| [create-controller.md](./create-controller.md)               | Add a thin controller method: DTO/param decorators in, exactly one application call, typed return — no logic.                  |
| [create-use-case.md](./create-use-case.md)                   | Add an `application/<action>.use-case.ts` for multi-entity/multi-step work under one transaction + ordered post-commit events. |
| [create-service.md](./create-service.md)                     | Add a `<feature>.service.ts` method that orchestrates a focused capability via repositories/adapters/domain (≤20 lines).       |
| [create-repository.md](./create-repository.md)               | Add an `infrastructure/<feature>.repository.ts` method: parameterized, bounded (cap 100), persistence-only.                    |
| [create-dto-validation.md](./create-dto-validation.md)       | Add a DTO in `api/dto/` with class-validator decorators (or the documented Zod pipe alternative).                              |
| [create-error.md](./create-error.md)                         | Add a typed `AppError` subclass carrying an `errors.<feature>.<key>` messageKey + filter mapping + tests.                      |
| [add-config-value.md](./add-config-value.md)                 | Add a typed config value via `@nestjs/config` with startup validation — never read `process.env` elsewhere.                    |
| [add-library-adapter.md](./add-library-adapter.md)           | Introduce a new dependency behind an `adapters/<vendor>.adapter.ts` so business code never imports the SDK.                    |
| [add-guard-and-permission.md](./add-guard-and-permission.md) | Add an RBAC permission to the catalog and chain auth + permissions + ownership guards on a route.                              |
| [add-event-handler.md](./add-event-handler.md)               | Subscribe a fail-safe, fire-and-forget handler to a domain event.                                                              |
| [add-notification.md](./add-notification.md)                 | Send a new notification (email/SMS/push) through a provider adapter, usually triggered by a domain event.                      |
| [add-i18n-message-key.md](./add-i18n-message-key.md)         | Add/change an `errors.<feature>.<key>` and its translation in each supported locale.                                           |
| [add-migration-backfill.md](./add-migration-backfill.md)     | Write a reversible schema migration and/or chunked, resumable data backfill.                                                   |

### Architecture — keep it clean as it grows

| Skill                                                | Use when you need to…                                                                                                              |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| [decompose-large-file.md](./decompose-large-file.md) | Split an oversized controller/service/use-case into focused collaborators behind a public surface that stays byte-for-byte stable. |
| [migration-plan.md](./migration-plan.md)             | Plan a safe, reversible schema change (forward + rollback + sequencing) before any code is written.                                |

### Simplicity — boring, reuse-first, minimal-safe ([rules 20–30](../rules/README.md))

| Skill                                                                                          | Use when you need to…                                                                                                        |
| ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| [write-simple-readable-code.md](./write-simple-readable-code.md)                               | Apply the Simple Code Ladder on every change: reuse → native → adapter → helper → direct code → justified abstraction.       |
| [reuse-before-creating.md](./reuse-before-creating.md)                                         | Search the existing owner before adding any file, helper, constant, DTO, enum, adapter, or fixture — never ship a duplicate. |
| [simplify-existing-code.md](./simplify-existing-code.md)                                       | Make an overbuilt or hard-to-scan file boring again behind characterization tests, without changing public behavior.         |
| [extract-helper-safely.md](./extract-helper-safely.md)                                         | Give repeated logic or a complex condition one named, typed, tested owner in the correct folder.                             |
| [split-large-service.md](./split-large-service.md)                                             | Break a multi-capability service apart by responsibility (decisions → `domain/`, shaping → `lib/`, facade if needed).        |
| [split-large-use-case.md](./split-large-use-case.md)                                           | Restore a god use case to a readable table of contents with an explicit transaction boundary and terminal states.            |
| [split-large-repository.md](./split-large-repository.md)                                       | Evict business logic from a repository and consolidate parameterized, allowlisted, bounded query helpers.                    |
| [review-for-readable-code.md](./review-for-readable-code.md)                                   | Run the nineteen readability questions of [rules/24](../rules/24-team-readable-code-review.md) on a diff before merge.       |
| [remove-unnecessary-code.md](./remove-unnecessary-code.md)                                     | Prove code/config/env/tests unused, then delete them and every reference — without touching a safety control.                |
| [refactor-smart-code-to-boring-code.md](./refactor-smart-code-to-boring-code.md)               | Rewrite clever chains, nested ternaries, and type gymnastics into named, direct, junior-readable code.                       |
| [extract-constants-types-enums.md](./extract-constants-types-enums.md)                         | Move constants, contracts, interfaces, and enums into one discoverable owner.                                                |
| [refactor-inline-declarations.md](./refactor-inline-declarations.md)                           | Remove module-level and anonymous inline declarations from implementation layers.                                            |
| [split-large-adapter.md](./split-large-adapter.md)                                             | Split a multi-capability vendor wrapper without leaking SDK types or weakening resilience.                                   |
| [split-large-guard-or-pipe.md](./split-large-guard-or-pipe.md)                                 | Restore one access decision/transformation per guard or pipe while preserving fail-closed behavior.                          |
| [full-codebase-cleanup.md](./full-codebase-cleanup.md)                                         | Run a phased, responsibility-based cleanup across governance, enforcement, source, tests, and docs.                          |
| [prepare-agent-mirrors.md](./prepare-agent-mirrors.md)                                         | Synchronize canonical policy and compact agent entrypoints without duplicating rule bodies.                                  |
| [cleanup-security-code-without-weakening.md](./cleanup-security-code-without-weakening.md)     | Simplify auth/permissions/ownership/secret code while preserving every control.                                              |
| [cleanup-validation-code-without-weakening.md](./cleanup-validation-code-without-weakening.md) | Simplify DTO/config/pipe validation without dropping fields, bounds, or error contracts.                                     |

### Test & verify — prove the thing works

| Skill                                                      | Use when you need to…                                                                       |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| [write-unit-tests.md](./write-unit-tests.md)               | Write Vitest 4 + @nestjs/testing unit tests for services, use cases, domain, and guards.    |
| [write-integration-tests.md](./write-integration-tests.md) | Test a real module wiring (repository + DB or adapter) against representative state.        |
| [write-e2e-tests.md](./write-e2e-tests.md)                 | Drive a route end-to-end through the HTTP boundary with `supertest` and a booted test app.  |
| [fix-eslint-typecheck.md](./fix-eslint-typecheck.md)       | Drive `npm run lint` and `npm run typecheck` to zero — by root cause, never by suppression. |
| [final-validation.md](./final-validation.md)               | Run the final diff review, git-safety, and full quality-gate sweep before commit/push.      |

### Review — harden the thing

| Skill                                                | Use when you need to…                                                                       |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| [security-review.md](./security-review.md)           | Audit authn/authz/IDOR/secrets/error-leakage on the changed surface before merge.           |
| [sql-injection-review.md](./sql-injection-review.md) | Verify every query is parameterized and bounded — no string-interpolated SQL.               |
| [performance-review.md](./performance-review.md)     | Catch N+1s, missing indexes, unbounded queries, and pagination gaps.                        |
| [reliability-review.md](./reliability-review.md)     | Verify fail-safe side effects, terminal states, timeouts/retries, and graceful degradation. |
| [observability-review.md](./observability-review.md) | Verify structured logs/metrics on critical paths with zero secret/PII leakage.              |

### Plan & investigate — change safely under pressure

| Skill                                                            | Use when you need to…                                                         |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| [investigate-production-bug.md](./investigate-production-bug.md) | Reproduce → locate → fix a reported defect with a failing test written first. |

> Each skill's **Related** section cross-links the others so you always land on canonical guidance for enums, permissions, errors/i18n, adapters, and the quality gates.

---

## Standard agent workflow

Follow this for **every** task. Do not skip steps; depth scales with the change, the steps do not.

1. **Read the rules.** [/rules/00-non-negotiable-rules.md](../rules/00-non-negotiable-rules.md) → the layer rule for what you're touching ([/rules/README.md](../rules/README.md)) → [/memory/known-pitfalls.md](../memory/known-pitfalls.md).
2. **Open the matching skill** in this folder and follow it top to bottom.
3. **Inspect the real code first.** Find a sibling module that already does the thing (use [/context/codebase-navigation.md](../context/codebase-navigation.md)) and mirror its structure. Cite real paths; never invent contracts.
4. **Run the Simple Code Ladder** ([write-simple-readable-code.md](./write-simple-readable-code.md), rules 43–46): reuse an existing owner before creating anything new; write the boring direct version; no speculative abstraction. Simplicity never cuts validation, guards, errors, adapters, bounds, tests, or docs.
5. **Route declarations and refactors.** Use [refactor-inline-declarations.md](./refactor-inline-declarations.md), [rules/30](../rules/30-declaration-ownership.md), and [rules/28](../rules/28-codebase-refactor-discipline.md) rather than moving code by line count.
6. **Write or adjust tests FIRST** ([write-unit-tests.md](./write-unit-tests.md)). New or changed behavior without a test is incomplete (rule 42).
7. **Make the minimal safe change.** Stay inside the right layer; don't refactor unrelated code into the diff.
8. **Run the quality gates** (below) until every one is green.
9. **Run integration/e2e tests** if you touched a route, the DB, or an adapter ([write-integration-tests.md](./write-integration-tests.md), [write-e2e-tests.md](./write-e2e-tests.md)).
10. **Update docs in the same change** — Swagger decorators on the controller, module docs, the feature folder under [/docs/features/_template/](../docs/features/_template/), and the messageKey in each supported locale.
11. **Log new pitfalls.** If you hit a recurring mistake, append a durable, abstract note to [/memory/known-pitfalls.md](../memory/known-pitfalls.md).
12. **Before commit/push**, run [final-validation.md](./final-validation.md). Never stage blindly, never bypass hooks.

---

## Quality gates

All must be **green** before you are done. Commands come straight from `package.json` (see [/context/stack-and-toolchain.md](../context/stack-and-toolchain.md)).

```bash
npm run lint            # eslint — 0 errors AND 0 warnings (zero tolerance)
npm run typecheck       # tsc --noEmit, TypeScript 7, project-wide
npm run test            # vitest run
npm run test:coverage   # 95% statements/functions/lines; 90% measured branches; real changed branches covered
npm run build           # tsc -p tsconfig.build.json — compiles clean
```

Husky enforces a subset automatically:

- **pre-commit** → `lint-staged` (eslint --fix on staged) + `typecheck` (project-wide).
- **commit-msg** → `commitlint` (Conventional Commits).
- **pre-push** → `test:coverage` + `build`.

Never bypass hooks with `--no-verify`, and never silence a gate with `eslint-disable`, `@ts-ignore`, or `@ts-expect-error`. Fix the root cause. The pre-commit typecheck is project-wide, so a pre-existing error in a file you never touched can block your commit — clean it up or call it out explicitly.

---

## Toolchain

| Concern    | Tool                                                   | Command                                                           | Contract                |
| ---------- | ------------------------------------------------------ | ----------------------------------------------------------------- | ----------------------- |
| Type-check | **TypeScript 7.0.2 native CLI** (`@typescript/native`) | `npm run typecheck` → `tsc --pretty --noEmit --incremental false` | Project-wide, no emit   |
| Build      | **TypeScript 7.0.2 native CLI** (`@typescript/native`) | `npm run build` → `tsc -p tsconfig.build.json`                    | Emits only to `dist/`   |
| Tests      | **Vitest 4** + `@nestjs/testing` + `supertest`         | `npm run test` → `vitest run`                                     | No Jest/ts-jest         |
| Coverage   | Vitest + V8 provider                                   | `npm run test:coverage`                                           | No nyc/c8               |
| Lint       | **ESLint 10** flat config + architecture plugin        | `npm run lint` → `eslint`                                         | 0 errors and 0 warnings |
| Format     | **Prettier 3** (via ESLint)                            | `npm run format`                                                  | No manual reflow        |

The package named `typescript` is the TypeScript 6 compatibility API (`npm:@typescript/typescript6@6.0.2`) for tools that import it; it does not own typecheck or build. This is the official TypeScript 7 side-by-side migration. NestJS runs on **Fastify** by default; `@nestjs/platform-express` is installed so a project can switch platforms.

---

## Non-negotiables you carry into every skill

- No `any`, no `eslint-disable`, no `@ts-ignore`, no `!` non-null assertions, `===`/`!==` only.
- No magic strings and no domain string comparisons — **enums/constants** from `@shared/*` or `model/<feature>.enums.ts`.
- No inline types/interfaces/enums/constants/DTOs/maps in controllers, services, use cases, repositories, guards, interceptors, pipes, or adapters — extract to `model/`, `api/dto/`, `lib/`, `@shared/*`.
- Thin controllers (one delegation/method), services ≤20 lines/method, persistence-only repositories, use cases own transactions + ordered post-commit events. Use cases call services; services never call use cases.
- DTO validation at the HTTP boundary (class-validator primary; Zod pipe alternative) — never validate in the service.
- Every user-facing error is a typed `AppError` with an `errors.<feature>.<key>` messageKey; the global exception filter returns sanitized bodies and leaks nothing.
- Every protected route chains an **auth guard → permissions (RBAC) guard → ownership/tenant check**; identity comes from the verified token, never the client body.
- Typed config via `@nestjs/config` — never `process.env` outside `config/` or `bootstrap/`. Logger adapter from `@core/logger` — never `console.*`.
- Every external library lives behind an `adapters/<vendor>.adapter.ts`.
- No unbounded queries — paginate, cap `limit` at 100.
- Side effects are fail-safe; async workflows reach a terminal state (success/failure/timeout).
- No behavior change without tests **and** docs in the same change.
- Simple Code Ladder on every change (rules 43–46): reuse the existing owner, no speculative abstraction, no clever TypeScript — boring, junior-readable, senior-trustworthy code. Minimal always means minimum **safe** code.
