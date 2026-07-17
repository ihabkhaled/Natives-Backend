# 03 — Application Services & Use Cases

> The application layer orchestrates. It coordinates repositories, domain rules, `lib/` helpers, and integration adapters to fulfill one operation, then returns a typed result. It never parses HTTP, never holds utility logic, never reads `process.env`. This file implements the canon in [/context/architecture-map.md](../context/architecture-map.md) §3 and the hard rules 19–24, 26–28, 31, 38 in [00-non-negotiable-rules.md](./00-non-negotiable-rules.md). Examples use neutral placeholders (`Order`, `Invoice`, `Account`) purely illustratively.

The application layer has **two shapes**: the **Service** (default) and the **Use case** (exceptional). Pick the smallest one that fits. Both are `@Injectable()`, both use constructor DI, both return typed results and throw `messageKey` errors. They differ only in what they're allowed to own.

---

## Service vs. Use case — the decision matrix

The **Service is the default.** Escalate to a **Use case** only when the exceptional shape genuinely appears.

| Signal                                                            | Service | Use case |
| ----------------------------------------------------------------- | ------- | -------- |
| Single aggregate / one logical write                              | ✅      | —        |
| CRUD, reads, projections                                          | ✅      | —        |
| Thin state-machine delegation (`publish`, `approve`)              | ✅      | —        |
| Single write + fire-and-forget side effect                        | ✅      | —        |
| Owns its transaction internally (one entity)                      | ✅      | possible |
| **Multiple entities** mutated under **one** transaction/invariant | —       | ✅       |
| **Ordered post-commit events**, typically across modules          | —       | ✅       |
| Coordinates several services/policies under one boundary          | —       | ✅       |

**Rule of thumb:** if it is one write, or a delegation, or a read, it is a **Service**. Reach for a **Use case** only when _both_ "multiple entities in one transaction" _and_ "ordered post-commit events" are true. See [01-architecture-and-module-boundaries.md](./01-architecture-and-module-boundaries.md) and the [backend-architect](../agents/backend-architect.md) agent when the call is close.

> **Dependency direction is one-way: use cases call services; services never call use cases.** Violating this creates cycles and hides the transaction owner. The ESLint plugin blocks use cases from importing controllers/API DTOs, services from importing controllers, and services from importing use cases ([13-eslint-and-typescript.md](./13-eslint-and-typescript.md)).

---

## What both layers MAY and MUST NOT do

**MAY:** inject repositories/adapters/domain policies in the constructor; check preconditions the schema can't express (existence, ownership defense-in-depth, current-state legality); delegate business rules to `domain/`; call adapters and `@core` services; return typed entities/DTOs; throw typed `AppError`s with a `messageKey`.

**MUST NOT:** touch HTTP request/response objects (that's the controller — [02-controllers-and-http-transport.md](./02-controllers-and-http-transport.md)); define inline types/interfaces/enums/constants/DTOs/config-maps or anonymous parameter/result shapes ([06-types-enums-constants.md](./06-types-enums-constants.md), [30-declaration-ownership.md](./30-declaration-ownership.md)); do inline mapping/formatting/string-building (extract to `lib/`); re-implement validation that belongs in the DTO ([05-dto-and-validation.md](./05-dto-and-validation.md)); read `process.env` (use `@config`); compare domain strings (use enum members); instantiate or inject vendor SDK services directly (depend on an app-owned port — [12-library-wrapping-and-adapters.md](./12-library-wrapping-and-adapters.md)); let a side-effect failure crash the workflow.

### DTOs and model types — the boundary

Services and use cases should use **model types** (`model/*.types.ts`) for their input contracts whenever possible. The controller is responsible for HTTP shaping; the application layer should not be tightly coupled to the API request shape. Response DTOs are acceptable as a return contract when the service delegates to a mapper in `lib/`, but the service should not import API DTOs purely to receive input. Use cases must never import API DTOs — this is mechanically enforced by the `architecture/no-dto-import-in-domain-or-use-case` rule.

---

## @Injectable + constructor DI

Providers are classes with NestJS DI. Dependencies are `private readonly` constructor parameters — no field assignment, no `new`, no service locator.

```ts
// Do — DI, typed, focused
@Injectable()
export class OrderService {
  constructor(
    private readonly orderRepo: OrderRepository,
    private readonly orderPolicy: OrderPolicy,
    private readonly logger: AppLogger,
  ) {}
}
```

```ts
// Don't — manual construction, untyped deps, vendor client inlined
@Injectable()
export class OrderService {
  private repo = new SomeOrmClient(); // vendor leak; not injectable; untestable
}
```

---

## The standard method shape

Every application method follows the same recipe: **guard preconditions → delegate → return a typed result.** No branching maze, no inline transformation.

```ts
@Injectable()
export class OrderService {
  constructor(
    private readonly orderRepo: OrderRepository,
    private readonly logger: AppLogger,
  ) {}

  async publishOrder(orderId: string, actorId: string): Promise<Order> {
    const order = await this.loadOrderOrThrow(orderId); // precondition: exists (repo returns null; the service throws)
    assertOwnership(order.ownerId, actorId); // precondition: ownership (lib/)
    const published = await transitionOrder(
      order,
      OrderAction.Publish,
      actorId,
    ); // domain decides
    this.logger.info(`${LOG_PREFIX} publishOrder ok`, { orderId, actorId });
    return published;
  }
}
```

`assertOwnership` throws a typed `ForbiddenError` and lives in `lib/`. `transitionOrder` is the domain state machine — it transitions, audits, and emits. The service only _coordinates_.

---

## Method-size budget (≤ 20 lines — ESLint-enforced)

`max-lines-per-function: 20` runs on every `*.service.ts`. When a method grows past it, the extra lines are **not orchestration** — extract them and the method shrinks naturally.

| Bloat in the method                    | Extract to                                   |
| -------------------------------------- | -------------------------------------------- |
| Data shaping / mapping                 | `lib/<feature>.mappers.ts`                   |
| String building / formatting           | `lib/<feature>.formatters.ts`                |
| Multi-step business rules / invariants | `domain/<feature>.policy.ts` / state machine |
| Reusable computation                   | `lib/<feature>.helpers.ts`                   |
| Inline anonymous fn > 2–3 lines        | a named function in `lib/`                   |

```ts
// Don't — formatting + mapping bloat the method
const label = `${order.number} — ${order.title.slice(0, 20).toUpperCase()}`;
const rows = orders.map(o => ({
  id: o.id,
  when: new Date(o.createdAt).toISOString(),
}));

// Do — delegate, method stays a recipe
const label = formatOrderLabel(order); // lib/order.formatters.ts
const rows = toOrderListRows(orders); // lib/order.mappers.ts
```

See [decompose-large-file.md](../skills/decompose-large-file.md) and [28-codebase-refactor-discipline.md](./28-codebase-refactor-discipline.md) for the responsibility-sliced workflow. A pass-through service is retained only when it is the documented public/DI boundary for a private repository or several focused collaborators; otherwise remove it.

---

## Transactions are owned by Use cases

A multi-entity, must-commit-together operation belongs in a **Use case**, which opens and owns the transaction. Hoist reads and decisions _before_ the boundary; keep the transaction small; fire side effects _after_ commit.

**Leak-safe shape — copy exactly.** Put `connect()` **and** the transaction start **inside** the `try`, release in `finally`, and guard rollback so it never throws over the original error.

```ts
@Injectable()
export class AcceptQuoteUseCase {
  constructor(
    private readonly uow: UnitOfWork, // adapter over the ORM's transaction primitive
    private readonly events: DomainEventBus,
    private readonly logger: AppLogger,
  ) {}

  async execute(input: AcceptQuoteInput): Promise<Order> {
    const order = await this.loadAwardableOrder(input.orderId, input.actorId); // reads BEFORE tx
    const result = await this.commitAward(order, input); // multi-entity tx
    await this.publishAwardEvents(result); // AFTER commit
    return result.order;
  }
}
```

```ts
// commitAward — the boundary itself (extracted helper keeps execute() ≤ 20 lines)
private async commitAward(order: Order, input: AcceptQuoteInput): Promise<AwardResult> {
  return this.uow.runInTransaction(async tx => {
    const quote = await tx.quotes.markAccepted(input.quoteId);
    await tx.quotes.rejectCompeting(order.id, input.quoteId);
    const awarded = await tx.orders.transition(order, OrderAction.Award);
    await tx.invitations.resolve(order.id);
    return { order: awarded, quote };
  });
}
```

The `UnitOfWork` adapter encapsulates the connect/start/commit/rollback/release lifecycle so business code never hand-rolls it. Its rules: connect and start _inside_ `try`, release in `finally`, rollback guarded by an `isActive` check. See [10-reliability-and-durability.md](./10-reliability-and-durability.md), [04-repositories-and-persistence.md](./04-repositories-and-persistence.md), and the [create-use-case](../skills/create-use-case.md) skill. The transaction-leak and masked-error traps are catalogued in [known-pitfalls.md](../memory/known-pitfalls.md).

> **Never wrap read-only work in a transaction.** Reads and decisions go _before_ the `try`; events and notifications go _after_ commit, never inside it.

---

## No inline concurrency in services

`Promise.all | allSettled | any | race` are **banned inside `*.service.ts`** by `no-restricted-syntax`. Concurrent orchestration is a use-case concern (it usually implies coordinating multiple collaborators or a transaction). When a service needs fan-out, extract it to a named `lib/` helper or escalate to a use case.

```ts
// Don't — inline concurrency in a service (ESLint error + hidden orchestration)
@Injectable()
export class NotifyService {
  async notifyAll(ids: string[]): Promise<void> {
    await Promise.all(ids.map(id => this.adapter.send(id))); // banned here
  }
}
```

```ts
// Do — name the fan-out in lib/, call the helper from the service
// lib/notify.helpers.ts
export function dispatchAll(
  send: (id: string) => Promise<void>,
  ids: readonly string[],
): Promise<readonly PromiseSettledResult<void>[]> {
  return Promise.allSettled(ids.map(send));
}

// notify.service.ts
async notifyAll(ids: readonly string[]): Promise<void> {
  const results = await dispatchAll(id => this.adapter.send(id), ids);
  logSettledFailures(results, this.logger); // surface failures, don't swallow
}
```

Independent calls run concurrently; never `await` in a loop when calls are independent. See [09-performance-and-scalability.md](./09-performance-and-scalability.md) and [19-async-events-and-jobs.md](./19-async-events-and-jobs.md).

---

## Facade decomposition of a large service

When a service file grows past a few hundred lines, split it into **focused sub-services behind a thin facade** — the same pattern as controller→handler decomposition, one layer down.

- The original class becomes a **facade**: it injects the sub-services as `private readonly` deps and each public method delegates in **one line**, preserving the exact name/signature/return type. The provider token stays the same, so consumers (controllers, use cases, other modules via `index.ts`) are untouched.
- Sub-services live as `application/<feature>-<concern>.service.ts`, grouped by cohesion (e.g. `account-lifecycle.service.ts`, `account-credentials.service.ts`). Each is `@Injectable()` and registered in the module; each keeps the same import boundary as the original.
- **Don't duplicate shared private helpers.** A _pure_ helper becomes an exported function in `lib/<feature>.helpers.ts`. A _stateful_ helper (uses repos/adapters) moves into ONE collaborator service that the others **inject** — never leave a dangling `this.x` that no longer resolves.
- Method bodies move **verbatim** (pure structural refactor); existing tests cover the sub-services through the facade, so coverage holds.

```ts
@Injectable()
export class AccountService {
  constructor(
    private readonly lifecycle: AccountLifecycleService,
    private readonly credentials: AccountCredentialsService,
  ) {}

  register(input: RegisterInput): Promise<Account> {
    return this.lifecycle.register(input); // one-line delegation; signature preserved
  }
  rotateKey(accountId: string): Promise<void> {
    return this.credentials.rotateKey(accountId);
  }
}
```

**Shrinking an oversized _method_:** extract whole `return`/`throw`-terminated branches or sequential phases into `private` helpers on the same class, leaving the public method a thin orchestrator. Preserve control flow exactly — a `return` inside an extracted helper must still exit the public method (`return await this.handlePhase(...)`). Thread every read variable as a parameter; keep `await` ordering identical. Full workflow: [decompose-large-file.md](../skills/decompose-large-file.md) and the [backend-refactor-agent](../agents/backend-refactor-agent.md).

---

## Typed results + `messageKey` errors

Return **entities or response DTOs**, never `any` or loosely-typed objects (rule 3). Every public method declares an explicit return type. Every failure throws a typed `AppError` subclass carrying a `messageKey` of the form `errors.<feature>.<key>` — the global exception filter maps it to status + sanitized body ([18-error-handling-and-exceptions.md](./18-error-handling-and-exceptions.md)).

| Error                  | Status | Use when                                             |
| ---------------------- | ------ | ---------------------------------------------------- |
| `ValidationError`      | 400    | Input/state precondition fails beyond DTO validation |
| `UnauthorizedError`    | 401    | No / invalid identity                                |
| `ForbiddenError`       | 403    | Identity present, not allowed (ownership/permission) |
| `NotFoundError`        | 404    | Resource doesn't exist                               |
| `ConflictError`        | 409    | Duplicate / conflicting state                        |
| `StateTransitionError` | 400    | Illegal state-machine transition                     |
| `IntegrationError`     | 502    | External provider failed                             |

```ts
throw new NotFoundError('Order', 'errors.order.notFound');
throw new ConflictError(
  'Duplicate identifier',
  'errors.account.duplicateIdentifier',
);
throw new StateTransitionError(
  order.status,
  OrderAction.Publish,
  'errors.order.invalidTransition',
);
```

Each new `messageKey` needs a matching entry in **each supported locale** ([16-i18n-and-messaging.md](./16-i18n-and-messaging.md), [add-i18n-message-key.md](../skills/add-i18n-message-key.md)).

---

## Fail-safe side effects

Side effects (events, notifications, audit) are **fire-and-forget after the work succeeds**. A delivery failure must never block or roll back the workflow — each handler catches its own errors and logs them.

```ts
// Do — best-effort, isolated failure
try {
  await this.notifier.notifyAwardedSupplier(order);
} catch (error: unknown) {
  this.logger.error('award notification failed', {
    orderId: order.id,
    error: toErrorMessage(error),
  });
}
```

In use cases, side effects fire **only after `commit`**, so handlers never observe rolled-back state. Long-running async work needs terminal states (success/failure/timeout) and operator visibility — no silent fire-and-forget for workflows the user is waiting on ([19-async-events-and-jobs.md](./19-async-events-and-jobs.md), [10-reliability-and-durability.md](./10-reliability-and-durability.md)). Audit writes are non-blocking by design — never make a feature depend on an audit write succeeding.

---

## State changes flow through the domain

Don't reimplement transition logic in the application layer. A state change calls the domain state machine, which validates the transition, records the audit entry, and emits the event. The service/use case only guards the precondition and delegates ([01-architecture-and-module-boundaries.md](./01-architecture-and-module-boundaries.md)).

---

## Type-system traps that bite the application layer

- **`exactOptionalPropertyTypes`:** never assign `undefined` to an optional field — conditionally spread: `...(x === undefined ? {} : { x })`.
- **Enum-typed schemas vs. value arrays:** validate with the enum-typed tuple; use the `*_VALUES` array everywhere else ([06-types-enums-constants.md](./06-types-enums-constants.md)).
- **`no-unnecessary-condition`:** trust narrowing — drop redundant `!= null` guards the compiler already proved.
- **No non-null `!`:** use guards, `??`, or `?.` (rule 7).

---

## Checklist

- [ ] Right shape chosen — Service by default; Use case only for multi-entity-tx **and** ordered post-commit events
- [ ] One-way dependency: use cases call services; services never call use cases
- [ ] `@Injectable()` with `private readonly` constructor DI; no `new`, no service locator
- [ ] Every method: guard preconditions → delegate → return a typed result
- [ ] Each method ≤ 20 lines; shaping/formatting/mapping/rules extracted to `lib/` / `domain/`
- [ ] No HTTP objects; no inline types/enums/consts/DTOs; enums from `@shared/enums`
- [ ] `@config` not `process.env`; logger adapter not `console.*`; SDKs only via adapters
- [ ] Transactions owned by use cases; connect/start inside `try`, release in `finally`, rollback guarded; reads before, events after commit
- [ ] No `Promise.all/allSettled/any/race` inside services — fan-out lives in `lib/` or a use case
- [ ] Large service decomposed behind a thin facade; bodies moved verbatim; no dangling `this.x`
- [ ] Every failure is a typed `AppError` with a `messageKey`; new keys added for each supported locale
- [ ] Side effects fire-and-forget with their own try/catch; async workflows have terminal states
- [ ] Tests written/updated first ([11-testing-and-coverage.md](./11-testing-and-coverage.md)); `lint` / `typecheck` / `test` / `test:coverage` / `build` green
