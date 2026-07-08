# 01 — Architecture & Module Boundaries

> The layered architecture and module boundaries every NestJS backend in this workspace obeys. This file implements [`/context/architecture-map.md`](../context/architecture-map.md) and the hard rules in [00-non-negotiable-rules.md](./00-non-negotiable-rules.md) (rules 10–24). If anything here contradicts the architecture map or the non-negotiable rules, those win.

This workspace is **stack-and-domain agnostic**: modular monolith or microservice, REST or GraphQL, any ORM (TypeORM / Prisma / Mongoose / Sequelize), any database. The layering, boundaries, and naming below are the **constant**; the business domain and the chosen libraries are the **variable**.

---

## The layers and the one-way dependency rule

Dependencies point **inward and downward only**. A layer may depend on the layers below it; **never** on the layers above it.

```
HTTP →  Controller   api/<feature>.controller.ts          thin transport, one delegation/method
        Application  application/<action>.use-case.ts      orchestration + transactions
                     <feature>.service.ts                  focused capabilities (≤20 lines/method)
        Domain       domain/ policies, entities, machines  pure business rules + invariants
        Persistence  infrastructure/<feature>.repository.ts data access only (parameterized, bounded)
        Integration  adapters/<vendor>.adapter.ts          wrap every external library
        ───────────────────────────────────────────────────────────────────────────────────────────
        Cross-cutting (importable everywhere): src/core (logger, errors+filter, guards, interceptors,
        pipes, events) and src/shared (enums, constants, types, utils); src/config reads env.
```

| Layer                                                     | Owns                                                                                                                                          | Must NOT                                                                                                     |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **Controller** (`api/<feature>.controller.ts`)            | Parse/shape HTTP, apply guards/pipes/decorators, delegate to **one** application method                                                       | Business logic, branching, transformation; import repositories/infrastructure                                |
| **Use case** (`application/<action>.use-case.ts`)         | Orchestrate **one** business operation across services/policies/repositories/adapters; own the transaction boundary; emit events after commit | Import controllers or API DTOs; parse HTTP; write raw SQL                                                    |
| **Service** (`<feature>.service.ts`)                      | A focused, reusable capability; may inject repositories and adapters                                                                          | Import controllers; exceed ~20 lines/method; do inline concurrency (`Promise.all`); hold inline declarations |
| **Domain** (`domain/`)                                    | Business rules, invariants, calculations, state-machine transitions — pure and testable                                                       | Touch HTTP, persistence, or external SDKs                                                                    |
| **Repository** (`infrastructure/<feature>.repository.ts`) | Data access: find/save/update/delete/query-build, always parameterized, always bounded                                                        | Business policy, transformation; import controllers/services/use-cases/DTOs                                  |
| **Adapter** (`adapters/<vendor>.adapter.ts`)              | Wrap one external library/SDK behind a typed, app-owned interface                                                                             | Leak vendor types into business code                                                                         |
| **Config** (`config/`)                                    | The only place (with `bootstrap/`) that reads `process.env`; validated, typed config                                                          | Be bypassed by ad-hoc `process.env` reads                                                                    |

These responsibilities are **mechanically enforced** by the ESLint architecture plugin (see [Import boundaries](#import-boundaries-eslint-enforced)).

---

## Canonical source tree

```
src/
├── main.ts                      # entrypoint → bootstrap()
├── app.module.ts                # root module: imports config, core, feature modules
├── bootstrap/                   # app assembly (process.env allowed here)
├── config/                      # @nestjs/config + validated schema (process.env allowed here)
├── core/                        # cross-cutting infra (importable everywhere)
│   ├── logger/  errors/  guards/  interceptors/  pipes/  events/
├── shared/                      # dependency-light building blocks
│   ├── enums/  constants/  types/  utils/        # shared/ imports only shared/
└── modules/
    └── <feature>/               # one bounded feature (see Module anatomy)
```

**Path aliases** (kept in sync across `tsconfig.json` + `vitest.config.mts`): `@/*` `@app/*` `@config/*` `@core/*` `@modules/*` `@shared/*`. Always use aliases — never deep relative paths like `../../../`.

---

## Module anatomy (the unit you scaffold)

Every feature module mirrors the layers. It imports `@shared`, `@core`, `@config`, adapters, and its **own** internals — never another module's internals.

```
src/modules/<feature>/
├── <feature>.module.ts          # wires controllers + providers; declares exports
├── index.ts                     # public surface barrel (what other modules may import)
├── api/
│   ├── <feature>.controller.ts  # thin transport: one delegation per method
│   └── dto/                     # create/update/response DTOs (class-validator; Zod alt: rules/05)
├── application/
│   ├── <action>.use-case.ts     # orchestration + transactions (multi-step / multi-entity)
│   └── <feature>.service.ts     # focused capability (CRUD, reads, single-write flows)
├── domain/
│   ├── <feature>.policy.ts      # business rules / guards
│   ├── <feature>.state-machine.ts  # guarded transitions (if stateful)
│   └── <feature>.entity.ts      # domain/persistence model
├── infrastructure/
│   └── <feature>.repository.ts  # persistence only
├── model/                       # NO inline declarations in layer files — they live here
│   ├── <feature>.types.ts  <feature>.enums.ts  <feature>.constants.ts
└── lib/
    └── <feature>.mappers.ts  <feature>.formatters.ts  <feature>.helpers.ts
```

### Service vs. Use case — when to escalate

- **Default = Service.** A focused capability fulfilling one use case: CRUD, reads/projections, a thin state-machine delegation, single-write + fail-safe side effect. A service **may** inject repositories and adapters; it owns its own single-aggregate transaction internally when needed.
- **Escalate to a Use case** only for the exceptional shape: one operation that mutates **multiple entities under one transaction/invariant** AND coordinates **ordered post-commit events** (typically across modules). The use case owns the transaction boundary and delegates focused pieces to services/policies/mappers/repositories.
- **One-way:** use cases call services; **services never call use cases**. This keeps the dependency direction acyclic.

Do **not** reach for a use case for CRUD, thin delegations, read projections, or single-write + fire-and-forget — those stay services. Full detail: [03-application-services-and-use-cases.md](./03-application-services-and-use-cases.md).

---

## NestJS building blocks → where they live

| NestJS concept          | Home                                                                                          |
| ----------------------- | --------------------------------------------------------------------------------------------- |
| `@Controller`           | `api/<feature>.controller.ts` (thin; `@UseGuards`, custom param decorators only)              |
| `@Injectable` provider  | `application/<feature>.service.ts` or `<action>.use-case.ts`                                  |
| Guard (`CanActivate`)   | `core/guards/` (auth, permissions/RBAC, ownership/tenant)                                     |
| Interceptor / Pipe      | `core/interceptors/` · global `ValidationPipe` in `bootstrap/`, custom pipes in `core/pipes/` |
| Exception filter        | `core/errors/` (sanitizes errors → safe `{ messageKey }`)                                     |
| Custom decorator        | `core/decorators/` or module `lib/` (e.g. `@CurrentUser()`, `@RequirePermissions()`)          |
| Module                  | `<feature>.module.ts`, `app.module.ts`                                                        |
| Repository / ORM client | `infrastructure/<feature>.repository.ts` (vendor imported only here, or in an adapter)        |

---

## Import boundaries (ESLint-enforced)

Other modules are consumed **only through their `index.ts` public surface**, or via events. `shared/` imports only `shared/`. The custom plugin (`architecture/no-restricted-layer-imports`) makes these mechanical, not aspirational.

| Source         | MAY import                                                                            | MUST NOT import                        |
| -------------- | ------------------------------------------------------------------------------------- | -------------------------------------- |
| `config/`      | leaf — nothing app-level                                                              | modules, core, shared                  |
| `core/`        | `shared/`, `config/`                                                                  | feature-module internals               |
| `shared/`      | only `shared/` (+ `config` for typed config)                                          | `modules/`, `core/` services, adapters |
| adapters       | `shared/`, `core/`, `config/`                                                         | feature-module internals               |
| `modules/<A>/` | `shared/`, `core/`, adapters, **own** internals, `modules/<B>` **via its `index.ts`** | another module's internal files        |

The plugin also enforces, by path:

- controllers cannot import repositories/infrastructure;
- use cases cannot import controllers or API DTOs;
- services cannot import controllers;
- repositories cannot import controllers, services, use cases, or API DTOs;
- API DTOs cannot import services, repositories, or infrastructure;
- vendor libraries (HTTP clients, loggers, ORMs, brokers) are importable **only inside their adapter directories**;
- `process.env` is readable **only in** `config/`, `bootstrap/`, `*.config.ts`, `*.providers.ts`.

Companion `no-restricted-syntax` rules ban inline `const`/`enum`/`interface`/`type` in controllers/services/repositories and ban `Promise.all|allSettled|any|race` inside services; `max-lines-per-function: 20` applies to `*.service.ts`.

```ts
// Don't — deep cross-module internal import (breaks the boundary; ESLint error)
import { invoiceRepository } from '@modules/billing/infrastructure/invoice.repository';

// Do — depend on the shared kernel or the module's public surface
import { InvoiceStatus } from '@shared/enums';
import { BillingService } from '@modules/billing'; // resolves to billing/index.ts
```

---

## Public surface — `index.ts`

Each module exposes a **deliberate** public API barrel. Export only what other modules legitimately need (the module class, public services/use-cases, public types); keep everything else internal.

```ts
// src/modules/billing/index.ts
export { BillingModule } from './billing.module';
export { BillingService } from './application/billing.service';
export type { Invoice } from './model/billing.types';
// internals (repository, DTOs, policies, mappers) are intentionally NOT exported
```

- **Do** add an `index.ts` when you create a module.
- **Don't** retrofit a barrel that creates an import cycle — that violates the no-circular-dependency rule. If two modules need each other's data, the shared piece belongs in `@shared`, or they communicate via the event bus.
- **Don't** deep-import another module's internal files under any circumstance.

### Barrel discipline (avoid load-time cycles)

- A `<feature>.types.ts` must **not** re-export from a `<feature>.constants.ts` or a service that imports it. Constants may import types; types must not import constants. Consumers import each directly.
- Keep barrels thin — re-export, don't compute. A barrel that runs logic on import is a cycle waiting to crash at module load.
- Prefer `export type { ... }` for type-only re-exports (`isolatedModules` + `consistent-type-imports`).

---

## DI wiring

NestJS resolves dependencies through the module graph. Wire providers explicitly; inject via the constructor with `private readonly`; depend on the layer below, never above.

```ts
// Don't — controller reaching into persistence; untyped field injection
@Controller('orders')
export class OrderController {
  repo!: OrderRepository; // non-null assertion + skips a layer
}
```

```ts
// Do — thin controller delegates to one application method; constructor DI
@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Get(':id')
  getOrder(@Param('id') id: string): Promise<OrderResponseDto> {
    return this.orderService.getById(id);
  }
}

// <feature>.module.ts — the wiring point and the public surface
@Module({
  controllers: [OrderController],
  providers: [OrderService, PlaceOrderUseCase, OrderRepository],
  exports: [OrderService], // only what other modules may consume
})
export class OrderModule {}
```

- Register every provider in its `<feature>.module.ts`; `app.module.ts` imports config, `core`, and feature modules.
- Cross-cutting providers (logger, exception filter, guards, event bus) come from `@core` and are wired once (often globally) — never re-instantiated per module.
- Use cases receive their collaborator services/repositories/adapters by constructor injection; they call services, never the reverse.

---

## Request lifecycle (end to end)

```
HTTP request
  → Guard(s)         auth → permissions(RBAC) → ownership/tenant      (core/guards)
  → Pipe             ValidationPipe transforms + validates the DTO     (bootstrap)
  → Controller       one delegation → application method               (api/<feature>.controller.ts)
  → Use case/Service orchestrate domain + repository (+ transaction)   (application/*)
  → Repository       parameterized, bounded persistence                (infrastructure/*)
  → (post-commit)    emit domain event → fail-safe handlers            (core/events)
  ← Interceptor      shape response / log                              (core/interceptors)
  ← Exception filter on throw: typed AppError → safe { messageKey }    (core/errors)
```

Identity always comes from the **verified token**, never the client body (see [07-security-authn-authz.md](./07-security-authn-authz.md)).

---

## How to add a module

1. Scaffold `src/modules/<feature>/` with `api/ application/ domain/ infrastructure/ model/ lib/`, plus `<feature>.module.ts` and `index.ts`. ([create-module.md](../skills/create-module.md))
2. Put all enums in `@shared/enums` (each with a `*_VALUES` array) or `model/<feature>.enums.ts` — never inline. ([06-types-enums-constants.md](./06-types-enums-constants.md))
3. Add request/response DTOs in `api/dto/` with class-validator decorators (Zod via pipe is the alternative). ([05-dto-and-validation.md](./05-dto-and-validation.md))
4. Implement persistence in `infrastructure/<feature>.repository.ts` — parameterized, bounded (hard list cap 100), ORM behind the repository. ([04-repositories-and-persistence.md](./04-repositories-and-persistence.md))
5. Implement a **service** for focused capabilities; escalate to a **use case** only for the multi-entity transactional + ordered-events shape. ([03-application-services-and-use-cases.md](./03-application-services-and-use-cases.md))
6. Add the controller — one delegation per method. ([02-controllers-and-http-transport.md](./02-controllers-and-http-transport.md))
7. Chain auth + permissions + ownership guards on every protected route; register permissions in the central catalog. ([07-security-authn-authz.md](./07-security-authn-authz.md))
8. Wrap any new external library behind an adapter. ([12-library-wrapping-and-adapters.md](./12-library-wrapping-and-adapters.md))
9. Add a `messageKey` (`errors.<feature>.<key>`) for every error scenario with a translation per supported locale. ([16-i18n-and-messaging.md](./16-i18n-and-messaging.md))
10. Export the public surface from `index.ts`; register the module in `app.module.ts`.
11. Write/adjust tests **first** (unit + integration), meet the coverage floor, then run the quality gates. ([11-testing-and-coverage.md](./11-testing-and-coverage.md))

---

## Checklist

- [ ] Dependencies point inward/downward only — no layer imports a layer above it
- [ ] Controller is thin (one delegation per method); no business logic in transport
- [ ] Service ≤ ~20 lines/method, no inline concurrency; use case only for multi-entity transaction + ordered post-commit events
- [ ] Domain logic is pure (`domain/`); repository only persists (parameterized, bounded)
- [ ] No inline types/enums/constants/DTOs in controllers/services/repositories/use-cases — they live in `model/`, `@shared`, `api/dto/`, `lib/`
- [ ] Cross-module access only via `index.ts` (or events); `shared/` imports only `shared/`; no import cycles
- [ ] Every provider wired in `<feature>.module.ts`; constructor DI with `private readonly`; module registered in `app.module.ts`
- [ ] Public surface in `index.ts` exports only what other modules need
- [ ] External libraries behind adapters; `process.env` only in `config/`/`bootstrap/`
- [ ] `npm run lint` / `typecheck` / `test` / `test:coverage` / `build` green
