# Architecture Map — The Canonical NestJS Layered Architecture

> This is the **single source of truth** for how a backend in this workspace is structured. Every rule in [`/rules`](../rules/README.md), every skill in [`/skills`](../skills/README.md), every reviewer in [`/agents`](../agents/README.md), and the ESLint architecture plugin in [`/eslint`](../eslint/architecture.config.mjs) agree with this document. If anything contradicts it, this file and [`/rules/00-non-negotiable-rules.md`](../rules/00-non-negotiable-rules.md) win.

This workspace is **stack-and-domain agnostic**: it works for any NestJS backend — modular monolith or microservice, REST or GraphQL, any ORM (TypeORM / Prisma / Mongoose / Sequelize), any database. The layering, boundaries, and naming below are the constant; the business domain and the chosen libraries are the variable.

---

## 1. The layers (and the one-way dependency rule)

Dependencies point **inward and downward only**. A layer may depend on the layers below it, never on the layers above it.

```
        ┌─────────────────────────────────────────────────────────┐
HTTP →  │ Transport        controllers (api/*.controller.ts)        │  thin, no logic
        ├─────────────────────────────────────────────────────────┤
        │ Application      use cases (application/*.use-case.ts)     │  orchestration + transactions
        │                  services  (*.service.ts)                 │  focused capabilities (≤20 lines/method)
        ├─────────────────────────────────────────────────────────┤
        │ Domain           policies, entities, state machines       │  pure business rules + invariants
        ├─────────────────────────────────────────────────────────┤
        │ Persistence      repositories (infrastructure/*.repository.ts) │ data access only
        ├─────────────────────────────────────────────────────────┤
        │ Integration      adapters (adapters/*.adapter.ts)         │  wrap every external library
        └─────────────────────────────────────────────────────────┘
   Cross-cutting (available to all): config, logger, errors+filters, guards, interceptors, pipes, event bus → src/core, src/shared
```

### Layer responsibilities (one line each)

| Layer                                             | Owns                                                                                                                                                 | Must NOT                                                                                                                   |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **Controller** (`api/*.controller.ts`)            | Parse/shape HTTP, apply guards/pipes/decorators, delegate to **one** application method                                                              | Contain business logic, branching, transformation, or import repositories/infrastructure                                   |
| **Use case** (`application/*.use-case.ts`)        | Orchestrate **one** business operation across services/repositories/policies/adapters; own the transaction boundary; emit domain events after commit | Import controllers or API DTOs; parse HTTP                                                                                 |
| **Service** (`*.service.ts`)                      | A focused, reusable application/domain capability; may use repositories and adapters                                                                 | Import controllers; exceed ~20 lines/method; do inline concurrency orchestration (`Promise.all`); hold inline types/consts |
| **Domain** (`domain/`)                            | Business rules, invariants, calculations, state-machine transitions — pure and testable                                                              | Touch HTTP, persistence, or external SDKs                                                                                  |
| **Repository** (`infrastructure/*.repository.ts`) | Data access: query/insert/update/delete, always parameterized, always bounded                                                                        | Hold business policy, transformation, or import controllers/services/use-cases/DTOs                                        |
| **Adapter** (`adapters/*.adapter.ts`)             | Wrap a single external library/SDK behind a typed, app-owned interface                                                                               | Leak vendor types into business code                                                                                       |
| **Config** (`config/`)                            | The **only** place (with `bootstrap/`) that reads `process.env`; validated, typed config                                                             | Be bypassed by ad-hoc `process.env` reads                                                                                  |

These responsibilities are **enforced by ESLint** via the custom `architecture/*` rules (see §6).

---

## 2. Canonical source tree

```
src/
├── main.ts                          # entrypoint → bootstrap()
├── app.module.ts                    # root module: imports config, core, feature modules
├── bootstrap/                       # app assembly (process.env allowed here)
│   ├── bootstrap.ts                 # createApp → configure pipes/filters/swagger → listen
│   ├── swagger.ts                   # OpenAPI document
│   └── *.constants.ts               # bootstrap constants (ports, body limits)
├── config/                          # @nestjs/config + validated schema (process.env allowed here)
│   ├── app.config.ts                # typed config namespaces
│   └── env.validation.ts            # startup validation (fail-fast)
├── core/                            # cross-cutting infrastructure (importable everywhere)
│   ├── logger/                      # logger adapter (wraps pino/winston/Nest Logger)
│   ├── errors/                      # typed AppError hierarchy + global exception filter
│   ├── guards/                      # auth guard, permissions guard, ownership guard
│   ├── interceptors/                # logging, timeout, transform-response
│   ├── pipes/                       # e.g. a Zod validation pipe (optional)
│   ├── http/ or adapters/           # shared outbound HTTP adapter
│   └── events/                      # event bus / EventEmitter wrapper
├── shared/                          # shared, dependency-light building blocks
│   ├── enums/                       # domain enums (+ a *_VALUES array each), barrel index.ts
│   ├── constants/                   # shared constants / config maps
│   ├── types/                       # shared types & contracts
│   └── utils/                       # pure helpers (shared/ imports only shared/)
└── modules/
    └── <feature>/                   # one bounded feature (see §3)
```

> **Aliases** (kept in sync across `tsconfig.json` + `vitest.config.mts`): `@/*`, `@app/*`, `@config/*`, `@core/*`, `@modules/*`, `@shared/*`.

---

## 3. Module anatomy (the unit you scaffold)

Every feature module mirrors the layers. A module imports `@shared`, `@core`, `@config`, adapters, and its **own** internals — never another module's internals (consume another module through its `index.ts` public surface or via events).

```
src/modules/<feature>/
├── <feature>.module.ts              # wires controllers + providers; declares the public surface
├── index.ts                         # public API barrel (what other modules may import)
├── api/
│   ├── <feature>.controller.ts      # thin transport: one delegation per method
│   └── dto/
│       ├── create-<feature>.dto.ts  # request DTO — class-validator decorators (Zod alt: rules/05)
│       ├── update-<feature>.dto.ts
│       └── <feature>-response.dto.ts
├── application/
│   ├── <action>.use-case.ts         # orchestration + transactions (multi-step / multi-entity)
│   └── <feature>.service.ts         # focused capability (CRUD, reads, single-write flows)
├── domain/
│   ├── <feature>.policy.ts          # business rules / guards
│   ├── <feature>.state-machine.ts   # guarded transitions (if stateful)
│   └── <feature>.entity.ts          # domain/persistence model
├── infrastructure/
│   └── <feature>.repository.ts      # persistence only
├── model/                           # NO inline declarations live in layer files — they live here
│   ├── <feature>.types.ts
│   ├── <feature>.enums.ts
│   └── <feature>.constants.ts
└── lib/
    ├── <feature>.mappers.ts         # entity → response shaping
    ├── <feature>.formatters.ts
    └── <feature>.helpers.ts
```

### Service vs. Use case — when to escalate

- **Default = Service.** A focused capability that fulfills one use case: CRUD, reads/projections, a thin state-machine delegation, single-write + fire-and-forget side effects. A service **may** inject and call repositories and adapters.
- **Escalate to a Use case** only for the exceptional shape: a single operation that mutates **multiple entities under one transaction/invariant** AND coordinates **ordered post-commit events** across modules. The use case owns the transaction boundary and delegates focused pieces back to services/policies/repositories. **Use cases call services; services never call use cases** (one-way).

---

## 4. NestJS building blocks → where they live

| NestJS concept         | Home                                                                   | Notes                                                   |
| ---------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------- |
| `@Controller`          | `api/*.controller.ts`                                                  | Thin; `@UseGuards`, `@UsePipes`, custom decorators only |
| `@Injectable` provider | `application/*.service.ts` or `*.use-case.ts`                          | Constructor DI; `private readonly` deps                 |
| Guard (`CanActivate`)  | `core/guards/`                                                         | Auth, permissions (RBAC), ownership/tenant              |
| Interceptor            | `core/interceptors/`                                                   | Logging, timeout, response shaping                      |
| Pipe                   | global `ValidationPipe` in `bootstrap/`; custom pipes in `core/pipes/` | DTO validation                                          |
| Exception filter       | `core/errors/`                                                         | Global filter sanitizes errors → safe `{ messageKey }`  |
| Custom decorator       | `core/decorators/` or module `lib/`                                    | e.g. `@CurrentUser()`, `@RequirePermissions()`          |
| Module                 | `<feature>.module.ts`, `app.module.ts`                                 | Dependency wiring + public surface                      |
| Config                 | `config/`                                                              | `ConfigModule.forRoot` + validated schema               |
| Repository / ORM       | `infrastructure/*.repository.ts`                                       | ORM client imported ONLY here (or an adapter)           |

---

## 5. Cross-cutting contracts (the non-negotiable conventions)

- **Errors:** every user-facing failure is a typed `AppError` subclass carrying a `messageKey` of the form `errors.<feature>.<key>`. A global exception filter maps it to an HTTP status + sanitized body. No stack traces / SQL / secrets leak to clients. (rules/18)
- **Config:** read configuration through the typed config layer (`@nestjs/config`), never `process.env` outside `config/` and `bootstrap/`. (rules/17)
- **Logging:** use the logger adapter (`@core/logger`), never `console.*`. Redact secrets/PII. (rules/14)
- **Validation:** at the HTTP boundary via DTOs (class-validator primary; Zod via a pipe is the documented alternative). (rules/05)
- **Domain values:** enums / `as const`, never magic strings; compare against enum members. (rules/06)
- **Zero inline declarations:** no inline types/interfaces/enums/constants/DTOs/config-maps in controllers/services/repositories/use-cases/guards/interceptors/adapters — extract to `model/`, `shared/`, `dto/`, `lib/`. (rules/06)
- **External libraries:** wrapped behind an adapter; business code depends on your interface, not the vendor. (rules/12)
- **Security:** every protected route chains an auth guard + a permissions guard + an ownership/tenant check; identity comes from the verified token, never the client body. (rules/07)
- **Persistence:** parameterized queries only; every list endpoint is paginated with a hard max limit. (rules/08, rules/09)
- **Tests + docs:** no behavior change ships without updated tests and docs. (rules/11, rules/00)

---

## 6. How the architecture is enforced (ESLint)

The custom plugin in [`/eslint/architecture-plugin`](../eslint/architecture-plugin.mjs) and config in [`/eslint/architecture.config.mjs`](../eslint/architecture.config.mjs) mechanically enforce this map:

- **`architecture/controller-no-logic`** — a controller method must be exactly one `return` of a direct delegation/identifier/member/literal. No branching or logic.
- **`architecture/no-restricted-layer-imports`** — path-based import boundaries:
  - controllers cannot import repositories or infrastructure;
  - use cases cannot import controllers or API DTOs;
  - services cannot import controllers;
  - repositories cannot import controllers, services, use cases, or API DTOs;
  - API DTOs cannot import services, repositories, or infrastructure;
  - external libraries (HTTP clients, loggers, ORMs, brokers) can only be imported inside their adapter directories;
  - `process.env` can only be read in `config/`, `bootstrap/`, `*.config.ts`, `*.providers.ts`.
- **`architecture/no-inline-layer-declarations`** — implementation-layer files (controllers, services, use cases, repositories, adapters, guards, interceptors, pipes) contain only the class/function that belongs to that layer. No module-level `const`/`enum`/`interface`/`type`/helper functions (only a file-local `LOG_PREFIX` is allowed).
- **`architecture/no-dto-import-in-domain-or-use-case`** — domain and use-case logic depends on `model/*.types.ts` and `@shared/types`, not on API request/response DTOs.
- **`architecture/no-use-case-import-in-service`** — dependency direction is one-way: use cases call services, never the reverse.
- **`architecture/no-cross-module-internal-imports`** — private implementation layers of one module (`api/`, `application/`, `domain/`, `infrastructure/`) cannot be imported directly from another module. Use the owning module's `model/` layer or public barrel/index.
- **`no-restricted-syntax`** — no `Promise.all|allSettled|any|race` inside services or adapters; module-level declaration coverage is now owned by the dedicated `architecture/no-inline-layer-declarations` rule.
- **`max-lines-per-function: 20`** on `*.service.ts` — services stay orchestration-thin.

To adapt conventions for a project, change `moduleSuffix`/`layer` in [`architecture.config.mjs`](../eslint/architecture.config.mjs) — never hardcode names in the rule implementations.

---

## 7. Request lifecycle (end to end)

```
HTTP request
  → Guard(s)         auth → permissions(RBAC) → ownership/tenant      (core/guards)
  → Pipe             ValidationPipe transforms+validates the DTO       (bootstrap)
  → Controller       one delegation → application method               (api/*.controller.ts)
  → Use case/Service orchestrate domain + repository (+ transaction)   (application/*)
  → Repository       parameterized, bounded persistence                (infrastructure/*)
  → (post-commit)    emit domain event → fire-and-forget handlers      (core/events)
  ← Interceptor      shape response / log                              (core/interceptors)
  ← Exception filter on throw: typed AppError → safe { messageKey }    (core/errors)
```

See [`reference-patterns.md`](./reference-patterns.md) for copy-ready code for each layer.
