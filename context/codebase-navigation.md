# Codebase Navigation — Task Router & "Where Does X Live"

> Your fastest path from a task to the right layer, files, rule, and skill. This implements the canon in [architecture-map.md](./architecture-map.md), [stack-and-toolchain.md](./stack-and-toolchain.md), and [00-non-negotiable-rules.md](../rules/00-non-negotiable-rules.md). When in doubt, those three win.

Use this file as a lookup, not a tutorial. Pick the row that matches your task, open the listed files, read the rule, then follow the skill step by step. The architecture is the constant; your domain and ORM are the variable.

---

## 1. The golden path (every change)

1. **Locate** the module and layer with §3 below — never edit code you have not read.
2. **Read the rule(s)** for the row in §2; they define the boundaries you must respect.
3. **Follow the skill** end to end — it scaffolds the right files in the right layer.
4. **Write/adjust tests first** ([11-testing-and-coverage.md](../rules/11-testing-and-coverage.md)), then implement.
5. **Run the gates** (§4) until all green. Never bypass hooks.

> One module is the unit of work: `src/modules/<feature>/`. Stay inside it; consume other modules only through their `index.ts` or via events.

---

## 2. Task router

Match your task, open the files, read the rule, follow the skill. Paths are relative to `src/modules/<feature>/` unless noted.

### Build features

| Task                                                | Layer & files to open                                                                  | Rule(s)                                                                                             | Skill                                                  |
| --------------------------------------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Scaffold a new feature                              | the whole module tree + `app.module.ts`                                                | [01](../rules/01-architecture-and-module-boundaries.md)                                             | [create-module.md](../skills/create-module.md)         |
| Add an HTTP endpoint                                | `api/<feature>.controller.ts`, then the application method it delegates to             | [02](../rules/02-controllers-and-http-transport.md)                                                 | [create-controller.md](../skills/create-controller.md) |
| Add a single-capability write/read                  | `application/<feature>.service.ts` (≤20 lines/method)                                  | [03](../rules/03-application-services-and-use-cases.md)                                             | [create-service.md](../skills/create-service.md)       |
| Add a multi-entity / transactional flow             | `application/<action>.use-case.ts` (owns the transaction + ordered post-commit events) | [03](../rules/03-application-services-and-use-cases.md), [19](../rules/19-async-events-and-jobs.md) | [create-use-case.md](../skills/create-use-case.md)     |
| Add business rules / invariants / state transitions | `domain/<feature>.policy.ts`, `domain/<feature>.state-machine.ts`                      | [01](../rules/01-architecture-and-module-boundaries.md)                                             | [create-use-case.md](../skills/create-use-case.md)     |

### Data & contracts

| Task                                       | Layer & files to open                                                                        | Rule(s)                                                                                               | Skill                                                                                                              |
| ------------------------------------------ | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Add request validation                     | `api/dto/<action>-<feature>.dto.ts` (class-validator primary; Zod pipe alt)                  | [05](../rules/05-dto-and-validation.md)                                                               | [create-dto-validation.md](../skills/create-dto-validation.md)                                                     |
| Change persistence / add a query           | `infrastructure/<feature>.repository.ts` (parameterized, bounded, max 100)                   | [04](../rules/04-repositories-and-persistence.md), [08](../rules/08-database-and-injection-safety.md) | [create-repository.md](../skills/create-repository.md)                                                             |
| Add/alter a schema, migration, or backfill | `infrastructure/` + migration files (ORM-owned)                                              | [04](../rules/04-repositories-and-persistence.md), [08](../rules/08-database-and-injection-safety.md) | [add-migration-backfill.md](../skills/add-migration-backfill.md), [migration-plan.md](../skills/migration-plan.md) |
| Add a type / enum / constant               | `model/<feature>.types.ts` / `.enums.ts` / `.constants.ts` (or `src/shared` if cross-module) | [06](../rules/06-types-enums-constants.md)                                                            | [decompose-large-file.md](../skills/decompose-large-file.md)                                                       |
| Add a response mapper / formatter          | `lib/<feature>.mappers.ts`, `lib/<feature>.formatters.ts`                                    | [01](../rules/01-architecture-and-module-boundaries.md)                                               | [create-service.md](../skills/create-service.md)                                                                   |

### Security & access

| Task                                     | Layer & files to open                                                            | Rule(s)                                            | Skill                                                                |
| ---------------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------- | -------------------------------------------------------------------- |
| Protect a route / add a permission       | `core/guards/` + `@UseGuards` on the controller (auth + RBAC + ownership/tenant) | [07](../rules/07-security-authn-authz.md)          | [add-guard-and-permission.md](../skills/add-guard-and-permission.md) |
| Review an auth / tenant-isolation change | guards, ownership checks, token-derived identity                                 | [07](../rules/07-security-authn-authz.md)          | [security-review.md](../skills/security-review.md)                   |
| Review query-building safety             | `infrastructure/<feature>.repository.ts`                                         | [08](../rules/08-database-and-injection-safety.md) | [sql-injection-review.md](../skills/sql-injection-review.md)         |

### Integrations & platform

| Task                                                                                               | Layer & files to open                                                                  | Rule(s)                                                                                        | Skill                                                      |
| -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Add an external integration (email provider, object storage, SMS gateway, payment provider, cache) | `adapters/<vendor>.adapter.ts` (vendor SDK imported **only** here)                     | [12](../rules/12-library-wrapping-and-adapters.md)                                             | [add-library-adapter.md](../skills/add-library-adapter.md) |
| Add a config value                                                                                 | `config/app.config.ts` + `config/env.validation.ts` (only place `process.env` is read) | [17](../rules/17-configuration-and-environment.md)                                             | [add-config-value.md](../skills/add-config-value.md)       |
| Emit / handle a domain event or background job                                                     | `core/events/` + `application/*.use-case.ts` (emit after commit) + a handler           | [19](../rules/19-async-events-and-jobs.md)                                                     | [add-event-handler.md](../skills/add-event-handler.md)     |
| Add a notification (any channel)                                                                   | an adapter + an event handler                                                          | [12](../rules/12-library-wrapping-and-adapters.md), [19](../rules/19-async-events-and-jobs.md) | [add-notification.md](../skills/add-notification.md)       |

### Errors, messaging, observability

| Task                          | Layer & files to open                                                                   | Rule(s)                                            | Skill                                                        |
| ----------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------ |
| Add a typed error             | `model/` or `core/errors/` (`AppError` subclass, `messageKey = errors.<feature>.<key>`) | [18](../rules/18-error-handling-and-exceptions.md) | [create-error.md](../skills/create-error.md)                 |
| Add a user-facing message key | locale resources for each supported locale                                              | [16](../rules/16-i18n-and-messaging.md)            | [add-i18n-message-key.md](../skills/add-i18n-message-key.md) |
| Add logs / metrics / traces   | `@core/logger` adapter + interceptors (never `console.*`)                               | [14](../rules/14-observability-and-logging.md)     | [observability-review.md](../skills/observability-review.md) |

### Quality, fixes, review

| Task                                  | Layer & files to open                                                     | Rule(s)                                                                                                             | Skill                                                                                                                                                                                                                                                    |
| ------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fix a production bug                  | reproduce → find the owning layer → add a failing test → fix              | [10](../rules/10-reliability-and-durability.md), [11](../rules/11-testing-and-coverage.md)                          | [investigate-production-bug.md](../skills/investigate-production-bug.md), [bug-triage-and-retest.md](../testing/bug-triage-and-retest.md)                                                                                                                |
| Decompose a god-file / long method    | the offending layer file → extract to `lib/`, `domain/`, `model/`         | [01](../rules/01-architecture-and-module-boundaries.md), [23](../rules/23-function-service-file-size-discipline.md) | [decompose-large-file.md](../skills/decompose-large-file.md), [split-large-service.md](../skills/split-large-service.md), [split-large-use-case.md](../skills/split-large-use-case.md), [split-large-repository.md](../skills/split-large-repository.md) |
| Simplify overbuilt / clever code      | the offending file → [simple-code-map.md](./simple-code-map.md) routes it | [20](../rules/20-simple-readable-code.md), [21](../rules/21-yagni-and-minimalism.md)                                | [simplify-existing-code.md](../skills/simplify-existing-code.md), [refactor-smart-code-to-boring-code.md](../skills/refactor-smart-code-to-boring-code.md), [remove-unnecessary-code.md](../skills/remove-unnecessary-code.md)                           |
| Review a diff for readability         | the diff, read as the next maintainer                                     | [24](../rules/24-team-readable-code-review.md)                                                                      | [review-for-readable-code.md](../skills/review-for-readable-code.md)                                                                                                                                                                                     |
| Resolve an ESLint / typecheck failure | the flagged file (often a layer-boundary or inline-declaration violation) | [13](../rules/13-eslint-and-typescript.md)                                                                          | [fix-eslint-typecheck.md](../skills/fix-eslint-typecheck.md)                                                                                                                                                                                             |
| Improve performance                   | repository (N+1, pagination), use-case (concurrency), adapter (caching)   | [09](../rules/09-performance-and-scalability.md)                                                                    | [performance-review.md](../skills/performance-review.md)                                                                                                                                                                                                 |
| Harden reliability                    | use-case (idempotency, transactions), event handlers (retries, DLQ)       | [10](../rules/10-reliability-and-durability.md)                                                                     | [reliability-review.md](../skills/reliability-review.md)                                                                                                                                                                                                 |
| Write tests                           | colocated `*.spec.ts` (unit/integration) or `test/*.e2e-spec.ts`          | [11](../rules/11-testing-and-coverage.md)                                                                           | [write-unit-tests.md](../skills/write-unit-tests.md), [write-integration-tests.md](../skills/write-integration-tests.md), [write-e2e-tests.md](../skills/write-e2e-tests.md)                                                                             |
| Final pre-PR validation               | run all gates; walk the checklist                                         | [15](../rules/15-review-checklist.md)                                                                               | [final-validation.md](../skills/final-validation.md)                                                                                                                                                                                                     |

---

## 3. Where does X live (module anatomy map)

Keyed to `src/modules/<feature>/` and the cross-cutting roots. This is the canonical tree from [architecture-map.md](./architecture-map.md) §3 — open the exact file, not its neighbors.

### Inside a feature module

| Looking for...                           | Location                                                                 |
| ---------------------------------------- | ------------------------------------------------------------------------ |
| HTTP endpoints                           | `api/<feature>.controller.ts`                                            |
| Request / response DTOs                  | `api/dto/<action>-<feature>.dto.ts`, `api/dto/<feature>-response.dto.ts` |
| Single-capability business logic         | `application/<feature>.service.ts`                                       |
| Multi-step / transactional orchestration | `application/<action>.use-case.ts`                                       |
| Business rules, invariants, calculations | `domain/<feature>.policy.ts`                                             |
| Guarded state transitions                | `domain/<feature>.state-machine.ts`                                      |
| Domain / persistence model               | `domain/<feature>.entity.ts`                                             |
| Data access (queries, writes)            | `infrastructure/<feature>.repository.ts`                                 |
| Module-local types                       | `model/<feature>.types.ts`                                               |
| Module-local enums                       | `model/<feature>.enums.ts`                                               |
| Module-local constants                   | `model/<feature>.constants.ts`                                           |
| Entity → response shaping                | `lib/<feature>.mappers.ts`                                               |
| Display formatting                       | `lib/<feature>.formatters.ts`                                            |
| Pure module helpers                      | `lib/<feature>.helpers.ts`                                               |
| Wiring + provider registration           | `<feature>.module.ts`                                                    |
| What other modules may import            | `index.ts` (public surface only)                                         |
| Tests                                    | colocated `*.spec.ts`; HTTP flows in `test/*.e2e-spec.ts`                |

### Cross-cutting (`src/core`, `src/shared`, roots)

| Looking for...                                                  | Location                                                                                    |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Logger adapter (never `console.*`)                              | `src/core/logger/`                                                                          |
| Typed `AppError` hierarchy + exception filter                   | `src/core/errors/`                                                                          |
| Auth / permissions / ownership guards                           | `src/core/guards/`                                                                          |
| Interceptors (logging, timeout, response shaping)               | `src/core/interceptors/`                                                                    |
| Custom pipes (e.g. Zod validation pipe)                         | `src/core/pipes/`                                                                           |
| Custom param decorators (`@CurrentUser`, `@RequirePermissions`) | `src/core/decorators/`                                                                      |
| Event bus / emitter wrapper                                     | `src/core/events/`                                                                          |
| Outbound HTTP adapter                                           | `src/core/http/` or an adapter dir                                                          |
| External vendor SDK wrappers                                    | `adapters/<vendor>.adapter.ts`                                                              |
| Cross-module enums / constants / types / utils                  | `src/shared/enums                                                                           | constants | types | utils/` |
| Typed config + startup validation                               | `src/config/app.config.ts`, `src/config/env.validation.ts`                                  |
| App assembly, pipes/filters wiring                              | `src/bootstrap/`                                                                            |
| Entrypoint                                                      | `src/main.ts`                                                                               |
| Root module (imports config, core, features)                    | `src/app.module.ts`                                                                         |
| Path aliases                                                    | `tsconfig.json` + `vitest.config.mts` (`@/* @app/* @config/* @core/* @modules/* @shared/*`) |

### Quick decision rules

- **Endpoint behaving wrong?** It is never in the controller (thin, one delegation) — look in the service/use-case it calls.
- **Need `process.env`?** Stop. It is only legal in `config/` and `bootstrap/`; everywhere else inject typed config.
- **Importing a vendor SDK?** Only inside `adapters/`. Business code depends on your interface, not the vendor.
- **Service method growing past 20 lines or doing `Promise.all`?** That is a use-case, not a service — escalate ([create-use-case.md](../skills/create-use-case.md)).
- **Writing an inline `interface`/`enum`/`type`/`const` in a layer file?** Move it to `model/` or `src/shared` — ESLint blocks it.
- **Reaching into another module's internals?** Use its `index.ts` or an event instead.

---

## 4. Quality gates (run before "done")

```bash
npm run lint            # 0 errors AND 0 warnings
npm run typecheck       # tsgo --noEmit, project-wide
npm run test            # vitest
npm run test:coverage   # coverage floor 95% (critical paths near 100%)
npm run build           # compiles clean
```

Husky enforces a subset automatically: **pre-commit** runs lint-staged + typecheck, **commit-msg** runs commitlint (Conventional Commits), **pre-push** runs test:coverage + build. Never bypass with `--no-verify`. A green build is necessary, not sufficient — prove behavior with tests and walk the [review checklist](../rules/15-review-checklist.md).

---

**Related:** [architecture-map.md](./architecture-map.md) · [stack-and-toolchain.md](./stack-and-toolchain.md) · [reference-patterns.md](./reference-patterns.md) · [glossary.md](./glossary.md) · [/skills/README.md](../skills/README.md) · [/rules/README.md](../rules/README.md) · [/memory/known-pitfalls.md](../memory/known-pitfalls.md) · [/memory/ai-context-map.md](../memory/ai-context-map.md)
