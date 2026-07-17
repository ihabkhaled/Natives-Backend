# Project Architecture — Standing Decision

> The layered, module-per-feature NestJS architecture is the standing decision. `claude.md` wins globally; within subordinate engineering guidance, the authoritative diagram is [`context/architecture-map.md`](../context/architecture-map.md) and the hard rules are [`rules/00`](../rules/00-non-negotiable-rules.md).

This is a **memory** note: a convention you inherit, not a proposal to re-litigate. It is stack-and-domain agnostic. The constants are the layers, boundaries, and naming; the variables are your business domain and your chosen libraries.

---

## Decision

**Adopt a layered modular-monolith NestJS architecture with one-way dependencies, a fixed module anatomy, and machine-enforced import boundaries.** Build for microservice extraction later without committing to it now.

| Aspect                 | Decision                                                                                                                |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Topology               | Modular monolith: one deployable Nest app, internally split into feature modules with strict boundaries                 |
| Layering               | Controller → Application (use case / service) → Domain → Persistence → Integration; deps point **inward/downward only** |
| Unit of work           | The **feature module** (`src/modules/<feature>/`) — scaffold, review, and test at this granularity                      |
| Cross-cutting          | `src/core` (logger, errors, guards, interceptors, pipes, events) and `src/shared` (enums, constants, types, utils)      |
| Default building block | A **service**; escalate to a **use case** only for multi-entity transactional orchestration                             |
| Enforcement            | Strict TS + ESLint custom `architecture/*` plugin + Husky gates — not convention-by-hope                                |

**IronNest reference records:** one Nest deployable with feature modules `auth`, `users`, and `articles`; cross-cutting authentication/permission contracts and guards live in `src/core/auth`, while JWT/password vendor implementations remain in `src/modules/auth/adapters`.

---

## Why this shape (rationale)

- **Boundaries make change cheap.** When a controller cannot import a repository and a service cannot import a controller, blast radius is bounded by construction. Reviewers reason about one layer at a time. See [`01-architecture-and-module-boundaries.md`](../rules/01-architecture-and-module-boundaries.md).
- **Thin transport ages well.** Logic-free controllers mean HTTP shape (REST/GraphQL/RPC) can change without touching business rules. See [`02-controllers-and-http-transport.md`](../rules/02-controllers-and-http-transport.md).
- **Pure domain is testable.** Policies, invariants, and state machines with no HTTP/DB/SDK imports are fast to test and impossible to break from the outside. See [`03-application-services-and-use-cases.md`](../rules/03-application-services-and-use-cases.md).
- **ORM-agnostic persistence is replaceable.** All data access sits behind a repository, so the ORM (TypeORM / Prisma / Mongoose / Sequelize are interchangeable examples) is an implementation detail, not a dependency of the domain. See [`04-repositories-and-persistence.md`](../rules/04-repositories-and-persistence.md).
- **Adapters contain vendor risk.** Wrapping every external library (an email provider, object storage, an SMS gateway, a payment provider, a cache) means swapping a vendor touches one adapter, not hundreds of imports. See [`12-library-wrapping-and-adapters.md`](../rules/12-library-wrapping-and-adapters.md) and [`library-boundaries.md`](./library-boundaries.md).
- **Microservice-ready, not microservices.** Modules already communicate only through public surfaces and events, so any module can be extracted into its own service later with minimal rework — and we pay none of the distributed-systems tax until we choose to.

---

## The layers (one-way dependency rule)

A layer may depend on layers below it, never above. Full diagram in [`/context/architecture-map.md`](../context/architecture-map.md).

```
Controller   api/<feature>.controller.ts        thin transport, one delegation/method
   ↓
Application  application/<action>.use-case.ts    orchestration + transactions
             application/<feature>.service.ts    focused capabilities (≤20 lines/method)
   ↓
Domain       domain/ policies · entities · state machines   pure rules + invariants
   ↓
Persistence  infrastructure/<feature>.repository.ts          data access only, bounded
   ↓
Integration  adapters/<vendor>.adapter.ts        wrap every external library
```

Cross-cutting (`src/core`, `src/shared`) is importable everywhere; it imports no feature module.

---

## Module anatomy (the standing template)

Every feature mirrors the layers. A module imports `@shared`, `@core`, `@config`, adapters, and its **own** internals — never another module's internals. Consume another module through its `index.ts` or via events.

```
src/modules/<feature>/
├── <feature>.module.ts          # wires providers; declares the public surface
├── index.ts                     # public API barrel — the ONLY cross-module entrypoint
├── api/
│   ├── <feature>.controller.ts  # thin transport
│   └── dto/                     # request/response DTOs (validation lives here)
├── application/
│   ├── <action>.use-case.ts     # multi-entity transactional orchestration
│   └── <feature>.service.ts     # focused capability (CRUD, reads, single-write)
├── domain/                      # policies · entities · state machines (pure)
├── infrastructure/
│   └── <feature>.repository.ts  # persistence only
├── adapters/
│   └── <vendor>.adapter.ts      # sole vendor importer behind an app-owned port
├── model/
│   ├── <feature>.types.ts
│   ├── <feature>.interfaces.ts # only when an established port/interface split earns it
│   ├── <feature>.enums.ts
│   └── <feature>.constants.ts
└── lib/                         # mappers · formatters · helpers
```

Create folders by responsibility as needed — not every module needs every folder. Catch-all files (`utils.ts`, `helpers.ts`, `types.ts` at module root) are banned; use descriptive names in the proper directory. Anonymous request/result/config/permission contracts do not stay in implementation signatures, and DTOs use declarations rather than `!`. See [`30-declaration-ownership.md`](../rules/30-declaration-ownership.md).

> **Project records:** `<any feature that legitimately deviates from this template, and the documented reason>`. Deviations are allowed but must be written down, never silent.

---

## Service vs. use case — the escalation rule

- **Default to a service.** A focused capability fulfilling one use case: CRUD, reads/projections, a thin state-machine delegation, single-write with fail-safe side effects. A service may inject repositories and adapters.
- **Escalate to a use case** only for the exceptional shape: one operation that mutates **multiple entities under a single transaction/invariant** AND coordinates **ordered post-commit events** across modules. The use case owns the transaction boundary.
- **One-way call rule:** use cases call services; **services never call use cases.**

```ts
// Don't — a controller doing work, importing persistence directly
@Post()
async create(@Body() body: CreateAccountDto): Promise<AccountResponseDto> {
  const exists = await this.repository.findByEmail(body.email); // ❌ controller logic + repo import
  if (exists) throw new ConflictException();                    // ❌ branching in transport
  return this.repository.save(body);
}
```

```ts
// Do — controller delegates once; the service owns the focused capability
@Post()
create(@Body() dto: CreateAccountDto): Promise<AccountResponseDto> {
  return this.accountService.create(dto); // ✅ exactly one delegation
}
```

See [`03-application-services-and-use-cases.md`](../rules/03-application-services-and-use-cases.md), skills [`create-service.md`](../skills/create-service.md) and [`create-use-case.md`](../skills/create-use-case.md).

---

## Cross-cutting layout (`src/core`, `src/shared`, `config`, `bootstrap`)

| Location                          | Owns                                                                                                                    | Records to keep                                                                       |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `config/`                         | Typed config via `@nestjs/config` + startup validation. **One of two places** `process.env` may be read.                | [`17-configuration-and-environment.md`](../rules/17-configuration-and-environment.md) |
| `bootstrap/`                      | App assembly: pipes, filters, OpenAPI, listen. The other place `process.env` is allowed.                                | —                                                                                     |
| `core/logger/`                    | Logger adapter. Never `console.*`.                                                                                      | [`14-observability-and-logging.md`](../rules/14-observability-and-logging.md)         |
| `core/errors/`                    | Typed `AppError` hierarchy + global exception filter; `messageKey` of form `errors.<feature>.<key>`.                    | [`18-error-handling-and-exceptions.md`](../rules/18-error-handling-and-exceptions.md) |
| `core/auth/`                      | Identity/token contracts, auth + permission guards/decorators; ownership remains application/domain/repository defense. | [`07-security-authn-authz.md`](../rules/07-security-authn-authz.md)                   |
| `core/events/`                    | Event bus / emitter wrapper for post-commit, fail-safe handlers.                                                        | [`19-async-events-and-jobs.md`](../rules/19-async-events-and-jobs.md)                 |
| `shared/enums/`                   | All domain enums, barrel-exported, each with a `*_VALUES` array.                                                        | [`06-types-enums-constants.md`](../rules/06-types-enums-constants.md)                 |
| `shared/{constants,types,utils}/` | Dependency-light building blocks. `shared/` imports only `shared/`.                                                     | —                                                                                     |

Path aliases (kept in sync across `tsconfig` and the Vitest config): `@/*`, `@app/*`, `@config/*`, `@core/*`, `@modules/*`, `@shared/*`.

---

## Import boundaries (mechanically enforced)

The custom ESLint `architecture/*` plugin enforces what review would otherwise miss:

- **`controller-no-logic`** — a controller method is exactly one delegating `return`; no branching/transformation.
- **`no-restricted-layer-imports`** —
  - controllers cannot import repositories/infrastructure;
  - use cases cannot import controllers or API DTOs;
  - services cannot import controllers;
  - repositories cannot import controllers, services, use cases, or API DTOs;
  - API DTOs cannot import services, repositories, or infrastructure;
  - vendor libraries (HTTP clients, loggers, ORMs, brokers) only inside adapter directories;
  - `process.env` only in `config/` and `bootstrap/`.
- **`no-restricted-syntax`** — no inline `const`/`enum`/`interface`/`type` in controllers/services/repositories; no `Promise.all|allSettled|any|race` inside services.
- **`max-lines-per-function: 20`** on `*.service.ts`.

To adapt naming for a project, change the layer/suffix mapping in the architecture config — never hardcode names in rule implementations. See [`13-eslint-and-typescript.md`](../rules/13-eslint-and-typescript.md).

> **Project records:** `<any approved boundary exception, with the linked decision file>`. Exceptions exist only in writing, never as silent disables — rule 4 forbids `eslint-disable`.

---

## What is fixed vs. what each project decides

| Fixed (the standing decision)                                  | Each project decides (record it)                 |
| -------------------------------------------------------------- | ------------------------------------------------ |
| Layer order + one-way deps                                     | Business domain and module list                  |
| Module anatomy + naming                                        | ORM/database (behind the repository)             |
| Service-default / use-case-escalation                          | External vendors (behind adapters)               |
| `messageKey` error convention                                  | Supported locales (one key per supported locale) |
| Auth + RBAC + ownership chain on protected routes              | Concrete permission/role catalog                 |
| Repository pagination cap (max 100)                            | Page sizes within the cap                        |
| Test stack (Vitest + `@nestjs/testing` + supertest), 95% floor | Per-module critical-path targets                 |

Companion records: [`backend-stack.md`](./backend-stack.md), [`database-decisions.md`](./database-decisions.md), [`security-decisions.md`](./security-decisions.md), [`library-boundaries.md`](./library-boundaries.md), [`testing-strategy.md`](./testing-strategy.md), [`known-pitfalls.md`](./known-pitfalls.md).

---

## When to revisit this decision

Reopen — with a written ADR under [`/docs/sdlc/`](../docs/sdlc/) — only if one of these is true:

- a module must become an independently deployed service (extract along its existing public surface; the layering survives intact);
- a transport other than HTTP becomes primary (the layering survives; only the transport layer changes);
- the modular-monolith topology itself stops fitting the scale or org structure.

Anything short of that is implemented **within** this architecture, not against it. Adding a feature, swapping an ORM, or replacing a vendor never requires reopening this note — they are routine moves the boundaries were designed to absorb.
