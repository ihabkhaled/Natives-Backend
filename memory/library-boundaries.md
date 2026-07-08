# Library Boundaries — The Adapter Map

> Durable decision record: which concerns are wrapped behind an app-owned adapter, why, and where each vendor lives. This implements the Integration layer of [/context/architecture-map.md](../context/architecture-map.md) and rules **32** and **41** of [/rules/00-non-negotiable-rules.md](../rules/00-non-negotiable-rules.md). The _how-to_ is [/rules/12-library-wrapping-and-adapters.md](../rules/12-library-wrapping-and-adapters.md); this file is the _what-is-wrapped-where_ registry every team fills in.

This is a memory note, not a tutorial. It states the standing convention for a NestJS backend in this workspace and reserves clearly-labeled slots — **`Project records:`** — where a concrete project writes its own package → adapter mappings. Keep the policy abstract; keep the inventory specific.

---

## The standing decision

**Every external library that touches product behavior is reached only through an app-owned port.** Business code (controllers, services, use cases, repositories, domain, guards) depends on _your_ interface; the vendor package is a swappable implementation detail hidden inside one adapter. The port outlives the vendor.

We wrap because the boundary buys us five things in one place: typed config, hardening, consistent typed errors, a single test-double surface, and a small swap surface. We do **not** wrap trivial, framework-internal, or zero-behavior libraries — wrapping those manufactures ceremony without leverage. The rest of this file is the decision rule for _which_ is which.

---

## Decision rule: wrap, or use directly?

| Wrap behind an adapter when the library…                                                           | Use directly when the library…                                                                                                           |
| -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Reaches the network or an external service (email, SMS, payments, storage, registry lookups, push) | Is a pure, deterministic, dependency-light utility (date math, id generation, hashing primitive) consumed through a `shared/util` helper |
| Holds secrets, base URLs, or connection config                                                     | Is wired once at the framework edge (`bootstrap/`) and never called from business code                                                   |
| Has its own error/return types you don't want leaking into the domain                              | Is the framework itself (`@nestjs/*`) — it _is_ the platform, not a vendor to abstract                                                   |
| Could plausibly be swapped for a competitor                                                        | Provides only NestJS decorators/utilities with no runtime behavior to centralize                                                         |
| Is an infrastructure client (DB, cache, message broker, search)                                    | —                                                                                                                                        |

> Rule of thumb: if you reach for an SDK, an HTTP client, or a protocol client inside a module's `application/` or `infrastructure/` code, **stop** — put it behind an adapter (module `adapters/` for a feature vendor, `src/core/` if it is cross-cutting infra), wire it through typed config, and record it below.

---

## Where each wrapped concern lives

Two homes, by reach:

- **`src/core/<concern>/`** — foundational, cross-cutting adapters used by everything: logger, error primitives + exception filter, event bus, the shared outbound HTTP client, the database/cache/broker clients. These are imported app-wide.
- **`src/modules/<feature>/adapters/<vendor>.adapter.ts`** — feature-specific vendors (mailer, object storage, payment, SMS, an external registry). Owned by the module that needs them; consumed by that module's use cases/services.

In both cases the **port interface and its types live in `model/` or `@shared/types`** — never inline in the adapter ([/rules/06-types-enums-constants.md](../rules/06-types-enums-constants.md)) — and the adapter is the **sole** importer of the vendor package (ESLint `architecture/no-restricted-layer-imports`).

---

## Concern catalog (wrap these by default)

These are the recurring concerns a backend wraps. Vendors are illustrative **examples only** — any equivalent is interchangeable behind the same port.

| Concern                    | Home                                          | Port (you own)                                     | Example vendors (swappable)                          | Adapter owns                                                                          |
| -------------------------- | --------------------------------------------- | -------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Logging                    | `core/logger/`                                | `AppLogger` (`info`/`warn`/`error`/`debug`)        | any logger (pino, winston, Nest `Logger`)            | level config, structured fields, PII/secret redaction                                 |
| Outbound HTTP              | `core/http/`                                  | `HttpClientPort.request<T>(req)`                   | any HTTP client (fetch, axios, undici)               | base URL, timeout, bounded retry+backoff, auth header, response typing, error mapping |
| Database client            | `infrastructure/*.repository.ts` (or `core/`) | repository methods                                 | any ORM (TypeORM / Prisma / Mongoose / Sequelize)    | parameterized + bounded queries; ORM kept behind the repository                       |
| Cache                      | `core/cache/`                                 | `CachePort.get`/`set`/`del`                        | any cache client                                     | key prefixing, default TTL, serialize/deserialize, fail-open reads                    |
| Event bus / broker         | `core/events/`                                | `EventBus.publish`/`subscribe`                     | EventEmitter, an in-process bus, or a message broker | topic naming, delivery semantics, fail-safe handler isolation                         |
| Mailer                     | module `adapters/`                            | `MailerPort.send(input)`                           | an email provider                                    | template selection, HTML escaping, owned input, provider swap                         |
| SMS                        | module `adapters/`                            | `SmsPort.send(input)`                              | an SMS gateway                                       | sender id config, payload mapping, error mapping                                      |
| Object storage             | module `adapters/`                            | `ObjectStoragePort.put`/`get`/`delete`/`signedUrl` | a blob/object store                                  | bucket config, content-type/size allow-list, signed-URL TTL, key namespacing          |
| Payment                    | module `adapters/`                            | `PaymentPort.charge`/`refund`                      | a payment provider                                   | idempotency keys, owned result types, error mapping                                   |
| External lookup / registry | module `adapters/`                            | `<Domain>LookupPort.fetch(...)`                    | a third-party data API                               | base URL, auth, response typing, caching policy                                       |
| Token signing              | module `adapters/` (e.g. auth)                | `TokenPort.sign`/`verify`                          | any JWT/crypto library                               | algorithm + key config, expiry, claim shaping; library imported nowhere else          |
| Antivirus / content scan   | module `adapters/`                            | `ContentScanPort.scan(stream)`                     | a scanning daemon over its protocol                  | connection config, stream limits, health surfacing                                    |

### Foundational vs. feature adapters

Loggers, the exception filter, the event bus, and config are **foundational** — every other adapter depends on them, so they live in `src/core`. Feature vendors (mailer, storage, payment, SMS) live in the **owning module's** `adapters/`. An adapter may import `@shared`, `@core`, and `@config` only — never another module's internals.

---

## Used directly (do NOT wrap) — and why

Not everything earns a port. These are wired at the framework edge or consumed as pure helpers; wrapping them adds indirection with no swap, config, or error-mapping payoff.

| Used directly                                                                        | Where                               | Why no adapter                                                             |
| ------------------------------------------------------------------------------------ | ----------------------------------- | -------------------------------------------------------------------------- |
| `@nestjs/*` platform packages                                                        | everywhere by design                | NestJS _is_ the platform, not a vendor to abstract                         |
| Security/transport hardening (helmet-style headers, CORS, compression, body parsing) | `bootstrap/`                        | bootstrap wiring; no business-code call sites                              |
| Rate limiting / throttling                                                           | global guard/interceptor in `core/` | already a Nest construct at the edge; configured once                      |
| File-upload parsing (`multer`-style)                                                 | a pipe/interceptor in `core/`       | edge concern; the _scanner_ behind it is wrapped, the parser need not be   |
| API docs generation (OpenAPI/Swagger)                                                | `bootstrap/swagger.ts`              | dev/ops tooling, not runtime product behavior                              |
| Pure utilities (uuid, date math, hashing primitive)                                  | `@shared/utils/*`                   | deterministic, no config/secrets/network — a `shared` helper is sufficient |

> Boundary nuance: a password-hashing or token library used **only inside one auth service/adapter** is an acceptable service-level wrapper — the rule is "import it in exactly one place," not "create a separate `adapters/` file for everything." If it crosses module boundaries or needs swapping, promote it to a port.

---

## Feature flags & graceful absence

External adapters are commonly **optional**: enabled only when a feature flag is on _and_ its credentials are present. Read both from typed config ([/rules/17-configuration-and-environment.md](../rules/17-configuration-and-environment.md)); never from `process.env`. When an integration is disabled, the port still resolves to a **no-op or fail-safe implementation** so callers need no branching and side effects stay fail-safe ([/rules/10-reliability-and-durability.md](../rules/10-reliability-and-durability.md)). Surface readiness of critical adapters (DB, cache, scanner) on the health/readiness probe ([/rules/14-observability-and-logging.md](../rules/14-observability-and-logging.md)).

---

## Adapter registry — `Project records:`

Each project maintains its concrete inventory here. One row per wrapped vendor; keep it current as the change ships (rule 41).

**`Project records:`** the package → adapter map, e.g.

| Concern       | Adapter file                                     | Port (token)  | Vendor + version      | Config keys  | Flag              |
| ------------- | ------------------------------------------------ | ------------- | --------------------- | ------------ | ----------------- |
| _e.g. Mailer_ | `modules/<feature>/adapters/<vendor>.adapter.ts` | `MAILER_PORT` | `<package>@<version>` | `<MAILER_*>` | `<ENABLE_MAILER>` |
| _…_           | _…_                                              | _…_           | _…_                   | _…_          | _…_               |

**`Project records:`** the "used directly, intentionally not wrapped" list (with the one-line reason each is exempt).

**`Project records:`** any vendor currently imported outside an `adapters/` directory as **debt** — with the owner and the planned wrap. A direct vendor import in business code is a lint error, so this list should be empty or time-boxed.

**`Project records:`** the enforcement list in [`/eslint/architecture.config.mjs`](../eslint/architecture.config.mjs). Every wrapped package must appear there so the boundary is mechanical from day one.

---

## Per-adapter documentation contract

Wrapping is only half the boundary; an adapter is **not done** until this file (or the module doc) records, for each entry:

- **Concern owned** — the capability it provides (e.g. "outbound transactional email").
- **Vendor wrapped** — package name + version and the config keys it consumes.
- **Public port** — the interface + methods; the only surface callers use.
- **Failure behavior** — which `AppError`/`messageKey` it throws ([/rules/18-error-handling-and-exceptions.md](../rules/18-error-handling-and-exceptions.md)); retry/timeout/breaker policy; degradation when disabled.
- **Security notes** — what is redacted, TLS expectations, allow-lists, timing-safe comparisons ([/rules/07-security-authn-authz.md](../rules/07-security-authn-authz.md)).
- **Swap notes** — what changing the vendor would touch (ideally only this adapter + config).

---

## Why this is durable (rationale)

- **The vendor is the variable; the port is the constant.** Markets, pricing, and SDKs change; our interface does not. Swaps stay surgical.
- **One choke point for safety.** Config, redaction, timeouts, retries, and error mapping live once — not scattered across call sites where one is always forgotten.
- **Tests stay fast and honest.** Callers mock the port token; only the adapter's own tests touch the SDK. No network in the suite ([/testing/unit-testing-standard.md](../testing/unit-testing-standard.md)).
- **The map prevents drift.** A registry that says where every vendor lives is what stops the 41st ad-hoc `import` from sneaking into a service. If a wrapper exists but no one can tell when to use it, the documentation — not the code — is the defect.

---

**Related:** [/rules/12-library-wrapping-and-adapters.md](../rules/12-library-wrapping-and-adapters.md) · [/rules/00-non-negotiable-rules.md](../rules/00-non-negotiable-rules.md) · [/rules/17-configuration-and-environment.md](../rules/17-configuration-and-environment.md) · [/rules/18-error-handling-and-exceptions.md](../rules/18-error-handling-and-exceptions.md) · [/skills/add-library-adapter.md](../skills/add-library-adapter.md) · [/memory/backend-stack.md](./backend-stack.md) · [/memory/known-pitfalls.md](./known-pitfalls.md) · [/context/architecture-map.md](../context/architecture-map.md)
