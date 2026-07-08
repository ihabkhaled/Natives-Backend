# Skill: Create an application Use case

> Add a use case (`application/<action>.use-case.ts`) for the exceptional shape: **multiple entities mutated under one transaction** AND **ordered post-commit events**. It implements the application-layer canon in [03-application-services-and-use-cases.md](../rules/03-application-services-and-use-cases.md) and the architecture map in [/context/architecture-map.md](../context/architecture-map.md). Use cases call services; services never call use cases.

A use case owns **one** business operation and **one** transaction boundary. It hoists reads/decisions before the transaction, mutates several aggregates atomically inside it, and fires ordered side effects (events, notifications, audit) **after** commit — fire-and-forget. Everything focused gets delegated back to services, policies, and repositories. A use case is named by the operation (`AcceptQuoteUseCase`, `PublishOrderUseCase`), never by an entity.

---

## Use a Use case ONLY when BOTH hold

1. The operation writes to **more than one entity/aggregate**, and those writes must commit or roll back **together** — a partial write leaves the system inconsistent.
2. It coordinates **ordered post-commit events** (typically across modules) that must not run if the transaction rolls back.

**Stay a Service** ([create-service.md](./create-service.md)) for: CRUD, reads/projections, a thin state-machine delegation (`publish`, `approve`), a single-entity write + one fire-and-forget side effect, or validation that belongs in a DTO. Escalating those is ceremony — see the decision matrix in [03-application-services-and-use-cases.md](../rules/03-application-services-and-use-cases.md). When the call is close, consult [backend-architect.md](../agents/backend-architect.md).

---

## Rules this skill enforces

- **One operation, one transaction boundary** owned here — opened via the `UnitOfWork` adapter, never hand-rolled (rules 22, 31; [10-reliability-and-durability.md](../rules/10-reliability-and-durability.md)).
- **Reads before, writes inside, events after.** Never read-only work inside a transaction; never an external provider call inside it; never emit before commit ([19-async-events-and-jobs.md](../rules/19-async-events-and-jobs.md) §2).
- **One-way dependency:** use cases call services; services never call use cases. The use case **may not** import controllers or API DTOs (ESLint `architecture/no-restricted-layer-imports`).
- **Zero inline declarations** — no inline types/interfaces/enums/constants/payload-shapes in the use-case file ([06-types-enums-constants.md](../rules/06-types-enums-constants.md)).
- **Typed result** on `execute`; every failure is a typed `AppError` with a `messageKey` of form `errors.<feature>.<key>` ([18-error-handling-and-exceptions.md](../rules/18-error-handling-and-exceptions.md)).
- **Side effects fire-and-forget after commit**, each with its own `try/catch`; a delivery failure never rolls back or breaks the operation (rule 38).
- **No `process.env`, no `console.*`, no vendor SDK** in the file — typed config, the logger adapter, and adapters only.

---

## Files to inspect first

1. [03-application-services-and-use-cases.md](../rules/03-application-services-and-use-cases.md) — the decision matrix + the leak-safe transaction shape.
2. The service method(s) you are promoting and their tests — you will keep these green.
3. The repositories that participate — they must accept the transactional handle (`tx`) the `UnitOfWork` passes.
4. The `UnitOfWork` adapter and the `EventBus` in `@core` — you consume them, never re-implement them.

---

## Step 1 — Define the input, result, and event payload types in `model/`

No inline shapes in the use-case file. Put the contract where it belongs.

```ts
// model/order.types.ts
export interface AcceptQuoteInput {
  readonly orderId: string;
  readonly quoteId: string;
  readonly actorId: string; // identity from the verified token — never the client body
}

export interface AwardResult {
  readonly order: Order;
  readonly quote: Quote;
}
```

Event names are constants, payloads are typed (rules 8, 10). See [add-event-handler.md](./add-event-handler.md).

```ts
// model/order.enums.ts
export const OrderEvent = {
  AWARDED: 'order.awarded',
  QUOTE_REJECTED: 'order.quote-rejected',
} as const;
export type OrderEvent = (typeof OrderEvent)[keyof typeof OrderEvent];
```

## Step 2 — Scaffold the use case with constructor DI

`@Injectable()`, `private readonly` deps, no `new`, no service locator. Inject the `UnitOfWork` adapter, the `EventBus`, the focused services/policies it coordinates, and the logger adapter.

```ts
@Injectable()
export class AcceptQuoteUseCase {
  constructor(
    private readonly uow: UnitOfWork, // adapter over the ORM transaction primitive
    private readonly events: EventBus, // @core/events
    private readonly orderPolicy: OrderPolicy, // domain decisions
    private readonly logger: AppLogger, // @core/logger
  ) {}
}
```

Register it as a provider in `<feature>.module.ts`; expose it through the module's `index.ts` only if another module needs it.

## Step 3 — `execute`: reads BEFORE, transaction, events AFTER

`execute` reads like a recipe: load + decide → commit the multi-entity write → publish events → return a typed result. Keep it short; push each phase into a private helper so the orchestration stays legible.

```ts
async execute(input: AcceptQuoteInput): Promise<Order> {
  const order = await this.loadAwardableOrder(input);  // reads + policy, BEFORE the tx
  const result = await this.commitAward(order, input); // multi-entity transaction
  this.publishAwardEvents(result);                     // post-commit, fire-and-forget
  return result.order;
}
```

```ts
private async loadAwardableOrder(input: AcceptQuoteInput): Promise<Order> {
  const order = await this.orderService.findByIdOrThrow(input.orderId);   // service, not repo
  this.orderPolicy.assertAwardable(order, input.actorId);                  // domain throws messageKey
  return order;
}
```

Preconditions the schema cannot express (existence, ownership/tenant defense-in-depth, current-state legality) are checked here, against the verified `actorId` — never a client-supplied id ([07-security-authn-authz.md](../rules/07-security-authn-authz.md)).

## Step 4 — Own the transaction through the `UnitOfWork` adapter

Wrap every must-commit-together mutation in **one** `runInTransaction`. The adapter owns the leak-safe lifecycle (connect/start inside `try`, release in `finally`, rollback guarded) so business code never hand-rolls it. Keep the transaction minimal — writes only, no reads, no provider calls.

```ts
private async commitAward(order: Order, input: AcceptQuoteInput): Promise<AwardResult> {
  return this.uow.runInTransaction(async (tx) => {
    const quote = await this.quoteRepo.markAccepted(input.quoteId, tx);
    await this.quoteRepo.rejectCompeting(order.id, input.quoteId, tx);
    const awarded = await this.orderRepo.transition(order, OrderAction.AWARD, tx);
    await this.invitationRepo.resolve(order.id, tx);
    return { order: awarded, quote };
  });
}
```

Repositories accept the `tx` handle so every write joins the same unit of work. If `tx` is omitted they use the default connection, so existing single-write callers are unaffected ([04-repositories-and-persistence.md](../rules/04-repositories-and-persistence.md)).

> **Never** call an external provider (an email provider, an SMS gateway, a payment provider) inside the transaction — it holds the connection and can fail the commit. **Never** wrap read-only work in a transaction.

## Step 5 — Emit ordered events AFTER commit, fire-and-forget

The row must be durable before any handler reads it. Emit only after `runInTransaction` returns; the publisher knows nothing about its subscribers. Emit in the order downstream effects depend on; each handler isolates its own failure ([19-async-events-and-jobs.md](../rules/19-async-events-and-jobs.md) §5).

```ts
private publishAwardEvents(result: AwardResult): void {
  this.events.emit(OrderEvent.AWARDED, toAwardedEvent(result.order));        // mapper in lib/
  this.events.emit(OrderEvent.QUOTE_REJECTED, toRejectedEvent(result.quote));
}
```

If a side effect is invoked directly (not through the bus), wrap it so a delivery failure never breaks the operation:

```ts
try {
  await this.notifier.notifyAwardedParty(result.order.id);
} catch (error: unknown) {
  this.logger.error('award notification failed', {
    orderId: result.order.id,
    error: toErrorMessage(error),
  });
}
```

When an event **must not be lost** if a downstream consumer is unavailable, use the outbox — write the domain row and an outbox row in the same transaction and let a relay publish it ([10-reliability-and-durability.md](../rules/10-reliability-and-durability.md)). Record the new event and its consumers in [/memory/event-notification-decisions.md](../memory/event-notification-decisions.md) (rule 41).

## Step 6 — Wire the controller and retire the promoted code

Point the controller at the use case with **one** delegation (`architecture/controller-no-logic`). Use cases call services; services never call use cases. Remove the now-dead service method and any single-use helpers it left behind.

```ts
// api/order.controller.ts — thin transport only
@Post(':id/award')
acceptQuote(@Param('id') id: string, @Body() dto: AcceptQuoteDto, @CurrentUser() user: AuthUser): Promise<OrderResponseDto> {
  return this.acceptQuoteUseCase.execute(toAcceptQuoteInput(id, dto, user));
}
```

---

## Tests FIRST

Write the tests before moving code; the **only** intended behavior change is the new atomicity.

- **Characterization tests** pin the current flow first: every precondition path, each thrown error type **and** `messageKey`, and the emitted-event set/order — so a regression fails loudly.
- **Unit test the use case** ([write-unit-tests.md](./write-unit-tests.md)): mock the `UnitOfWork`, `EventBus`, services, and policy. Assert reads happen before the transaction, every mutation runs inside it, events emit **after** commit in the correct order, and each failure branch throws the right `AppError` + `messageKey`.
- **Integration rollback test** ([write-integration-tests.md](./write-integration-tests.md)): force a mid-transaction failure and assert **no** entity persisted and **no** event emitted.
- **Handler-count test:** a new subscriber bumps the registered-handler count — assert it ([19-async-events-and-jobs.md](../rules/19-async-events-and-jobs.md) §5).
- Keep the migrated service/controller tests green. Touched-module coverage floor is **95%** (critical paths near 100% — [coverage-policy.md](../testing/coverage-policy.md)).

## Quality gates

```bash
npm run lint
npm run typecheck
npm run test
npm run test:coverage
npm run build
```

All green, zero warnings. Never bypass Husky hooks with `--no-verify`.

## Pitfalls

- **Escalating a single-entity or read operation** — that is a service. A use case with one write and no cross-module events is over-engineering.
- **A service importing a use case** — wrong dependency direction; it creates cycles and hides the transaction owner.
- **Reads or provider calls inside the transaction** — hoist reads before; fire provider calls after commit. Both hold the connection and can fail the commit.
- **Emitting events before commit** — a later rollback leaves handlers acting on a ghost. Emit only after `runInTransaction` returns.
- **A handler throwing back into the use case** — it must catch and log its own failure; a delivery error must never roll back the work.
- **Hand-rolling the transaction** instead of using the `UnitOfWork` adapter — connect/start must be inside `try`, release in `finally`, rollback guarded; the adapter already does this. The leak and masked-error traps are catalogued in [known-pitfalls.md](../memory/known-pitfalls.md).
- **Inline payload/input/result shapes** in the use-case file — extract to `model/` (rules 10–16).
- **Assigning `undefined` to an optional field** trips `exactOptionalPropertyTypes` — conditionally spread `...(x === undefined ? {} : { x })`.

## Related

[create-service.md](./create-service.md) · [create-repository.md](./create-repository.md) · [create-controller.md](./create-controller.md) · [add-event-handler.md](./add-event-handler.md) · [add-notification.md](./add-notification.md) · [decompose-large-file.md](./decompose-large-file.md) · [write-unit-tests.md](./write-unit-tests.md) · [write-integration-tests.md](./write-integration-tests.md) · [03-application-services-and-use-cases.md](../rules/03-application-services-and-use-cases.md) · [10-reliability-and-durability.md](../rules/10-reliability-and-durability.md) · [19-async-events-and-jobs.md](../rules/19-async-events-and-jobs.md) · [index](./README.md)
