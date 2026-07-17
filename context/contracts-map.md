# Contracts Map — Where Each Contract Lives

> A routing-only companion, in the same spirit as [simple-code-map.md](./simple-code-map.md): this repo has real contracts (HTTP DTOs, event names/payloads, persistence shapes, configuration, adapter ports), but each is owned by a different existing rule or memory file rather than a single `contracts/` folder. This file points you at the owner; it does not restate any contract body. When in doubt, the linked rule wins.

There is deliberately **no `contracts/` directory**. Consolidating these into one folder would create a second source of truth beside the owners below — the exact parallel-duplicate the workspace's own [rules/22](../rules/22-reuse-before-creating.md) forbids.

---

## 1. Where each contract kind is owned

| Contract kind                    | Canonical owner                                                                                                                                   | Notes                                                                                  |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| HTTP request/response (DTOs)     | [05-dto-and-validation.md](../rules/05-dto-and-validation.md)                                                                                     | Declared + bounded in `api/dto/*.dto.ts`; class-validator is the enforcement point     |
| Typed errors + `messageKey`      | [18-error-handling-and-exceptions.md](../rules/18-error-handling-and-exceptions.md)                                                               | `AppError` subclasses + `errors.<feature>.<key>` keys in `model/*.constants.ts`        |
| Domain event names + payloads    | [event-notification-decisions.md](../memory/event-notification-decisions.md), [19-async-events-and-jobs.md](../rules/19-async-events-and-jobs.md) | **No event bus exists in `src/` today** — this is the pattern to use when one is added |
| Persistence / data shapes        | [database-decisions.md](../memory/database-decisions.md), [04-repositories-and-persistence.md](../rules/04-repositories-and-persistence.md)       | Repository method signatures are the swap surface; the ORM stays behind them           |
| Configuration + environment      | [17-configuration-and-environment.md](../rules/17-configuration-and-environment.md)                                                               | `.env.example` is the documented config contract; validated at startup                 |
| External-library / adapter ports | [library-boundaries.md](../memory/library-boundaries.md), [12-library-wrapping-and-adapters.md](../rules/12-library-wrapping-and-adapters.md)     | The app-owned port is the contract; the vendor SDK is the swappable implementation     |
| OpenAPI / API documentation      | `src/core/openapi/` + `src/bootstrap/configure-swagger.ts`                                                                                        | Built in-memory at runtime; no OpenAPI JSON is written to disk today                   |

## 2. Compatibility discipline

Every contract change is a first-class event, not an incidental side effect ([09-impact-analysis](../docs/features/_template/09-impact-analysis.md) tracks it per-request). Backward compatibility is the default; a breaking change is explicitly justified and staged. The per-request owners for that judgment are `docs/features/<slug>/08-architecture-review.md` (## Contract changes) and `02-business-development.md` (## Contract / SLA impact).

## 3. When you are looking for a machine-readable contract inventory

The [`.ai/manifests/`](../.ai/manifests/) compiled layer (built by `npm run knowledge:build`, see [tools/knowledge](../tools/knowledge)) records the source-file/module/dependency inventory an AI agent can query, but it deliberately does **not** synthesize an API/event/data contract catalog — those subsystems either live behind the owners above or (for events) do not exist in code yet. Adding a contract manifest is a documented future extension, not a v1 gap (see `docs/features/knowledge-acceleration-plane/06-technical-refinement.md`).

**Related:** [simple-code-map.md](./simple-code-map.md) · [declaration-ownership-map.md](./declaration-ownership-map.md) · [/rules/05-dto-and-validation.md](../rules/05-dto-and-validation.md) · [/rules/12-library-wrapping-and-adapters.md](../rules/12-library-wrapping-and-adapters.md) · [/rules/17-configuration-and-environment.md](../rules/17-configuration-and-environment.md) · [/memory/database-decisions.md](../memory/database-decisions.md) · [/memory/event-notification-decisions.md](../memory/event-notification-decisions.md) · [/memory/library-boundaries.md](../memory/library-boundaries.md)
