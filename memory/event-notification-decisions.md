# Event & Notification Decisions

> Durable conventions for how domain events flow and how notifications are delivered in a NestJS backend in this workspace. Implements the canon: events fire after commit, handlers are fail-safe, and every delivery channel hides behind an adapter. Authoritative rules: [19-async-events-and-jobs.md](../rules/19-async-events-and-jobs.md), [10-reliability-and-durability.md](../rules/10-reliability-and-durability.md). Related memory: [reliability-patterns.md](./reliability-patterns.md), [library-boundaries.md](./library-boundaries.md).

These are standing decisions, not a feature spec. Where a concrete backend differs, it records the deviation on the **Project records:** lines below.

---

## Decision 1 — In-process event bus first; broker only when you need durability

**Decision.** Start with an **in-process** domain event bus wrapped in `src/core/events/` (a thin adapter over `@nestjs/event-emitter` or an equivalent). Treat the bus as a cross-cutting service injected via DI — never a global singleton imported ad hoc.

**Rationale.** In-process events keep the modular monolith decoupled without operational cost. They are synchronous-dispatch but fail-safe (Decision 4), so a slow handler does not silently extend request latency beyond its own work. Escalate to a real broker (queue/stream) **only** when you need at-least-once delivery, cross-process fan-out, replay, or backpressure — and when you do, it lives behind the same `core/events` interface so call sites do not change.

```ts
// Do — depend on the app-owned interface, not the vendor emitter
@Injectable()
export class OrderService {
  constructor(private readonly events: DomainEventBus) {}
}
```

```ts
// Don't — import the vendor emitter or read it from a global
import { EventEmitter2 } from '@nestjs/event-emitter'; // only allowed inside core/events adapter
```

| Need                                       | Choice                                   |
| ------------------------------------------ | ---------------------------------------- |
| Decouple modules in one process            | In-process bus (`core/events`)           |
| At-least-once / cross-service / replay     | Broker adapter behind the same interface |
| Ordered post-commit side effects in one tx | Use case emits after commit (Decision 3) |

**Project records:** the concrete bus implementation, and the broker (if any) it escalates to.

---

## Decision 2 — Event names are typed constants, payloads are typed contracts

**Decision.** Every event name is an enum member or `as const` value in `model/<feature>.enums.ts` (or `@shared/enums` when cross-module). Every payload is a named type/interface in `model/<feature>.types.ts` or `@shared/types`. No magic-string event names, no inline payload shapes.

**Rationale.** Subscribers and publishers must agree on a single source of truth; string drift is the classic source of "the handler never fired." Naming convention: `<feature>.<past-tense-fact>` — e.g. `order.published`, `invoice.paid`, `account.created`. Past tense because an event is a fact that already happened, not a command.

```ts
// model/order.enums.ts
export enum OrderEvent {
  Published = 'order.published',
  Cancelled = 'order.cancelled',
}
// model/order.types.ts
export interface OrderPublishedPayload {
  readonly orderId: string;
  readonly tenantId: string;
}
```

Aligns with [06-types-enums-constants.md](../rules/06-types-enums-constants.md). **Project records:** the event catalog (names + payloads) for the domain.

---

## Decision 3 — Domain events are emitted after commit, by the use case

**Decision.** State-changing side effects publish **after** the transaction commits. The **use case** owns that boundary: persist inside the transaction, then emit the event(s) in order once the write is durable. A focused **service** may emit a single post-write event, but multi-entity / ordered fan-out escalates to a use case.

**Rationale.** Emitting inside an open transaction risks notifying the world about a change that later rolls back — duplicate emails, phantom records, support tickets. Post-commit emission keeps the observable world consistent with persisted truth.

```ts
// Do — use case: commit, then emit
async execute(input: PublishOrderInput): Promise<OrderView> {
  const order = await this.unitOfWork.run((tx) => this.orderService.publish(input, tx));
  this.events.emit(OrderEvent.Published, this.toPublishedPayload(order));
  return this.mapper.toView(order);
}
```

```ts
// Don't — emit while the transaction may still roll back
await tx.save(order);
this.events.emit(OrderEvent.Published, payload); // premature: write not durable yet
await tx.commit();
```

See [03-application-services-and-use-cases.md](../rules/03-application-services-and-use-cases.md) and the request lifecycle in [/context/architecture-map.md](../context/architecture-map.md). Skill: [/skills/create-use-case.md](../skills/create-use-case.md).

---

## Decision 4 — Handlers are fire-and-forget and self-contained

**Decision.** Every event handler wraps its body in try/catch, logs failures via the [`@core/logger`](../rules/14-observability-and-logging.md) adapter, and **never rethrows into the publisher**. A failing handler must not crash the emitter or fail the originating request. Handlers are idempotent where redelivery is possible.

**Rationale.** Events exist to decouple. If a notification provider is down, the order is still published — the delivery just fails in isolation, observably, and can be retried. Coupling request success to side-effect success defeats the entire pattern (rule 38).

```ts
// Do — fail-safe handler with structured logging
@OnEvent(OrderEvent.Published)
async onOrderPublished(payload: OrderPublishedPayload): Promise<void> {
  try {
    await this.notifications.notifyOrderPublished(payload);
  } catch (error) {
    this.logger.error('order.published handler failed', { error, orderId: payload.orderId });
  }
}
```

```ts
// Don't — let a handler throw and take down the publisher / the request
@OnEvent(OrderEvent.Published)
async onOrderPublished(p: OrderPublishedPayload): Promise<void> {
  await this.notifications.notifyOrderPublished(p); // unguarded throw escapes
}
```

**Note on concurrency.** Handlers must not orchestrate concurrency with `Promise.all` inside a service (ESLint-banned, [13-eslint-and-typescript.md](../rules/13-eslint-and-typescript.md)); fan-out across channels belongs in the notification module's use case or a dedicated helper. Skill: [/skills/add-event-handler.md](../skills/add-event-handler.md).

**Subscription-count regression trap.** Adding a new `subscribe`/`@OnEvent` for an event that an integration test asserts on requires bumping the expected subscription count in that test — a very common miss. Recorded in [known-pitfalls.md](./known-pitfalls.md).

---

## Decision 5 — Notifications are a module; delivery channels are adapters

**Decision.** A dedicated `notifications` feature module owns creating in-app notifications and fanning out to external channels. Each external channel (an email provider, an SMS gateway, a push provider, a chat/messaging provider) is reached **only** through an integration adapter (`adapters/<vendor>.adapter.ts`). Business code calls the channel-neutral notification service; it never imports a provider SDK.

**Rationale.** Providers get swapped, rate-limited, and regionally restricted. Wrapping them behind adapters centralizes config, auth, retry, and error mapping, and keeps the swap surface to one file (rule 32). The notification module selects channels by recipient preference; callers express _intent_ ("notify the owner the order was published"), not _transport_.

```
src/modules/notifications/
  notifications.module.ts
  index.ts
  application/notify.use-case.ts        # selects channels, fans out
  application/notification.service.ts   # creates in-app records
  infrastructure/notification.repository.ts
src/modules/<feature>/adapters/         # OR shared core adapters:
  email.adapter.ts   sms.adapter.ts   push.adapter.ts   chat.adapter.ts
```

```ts
// Don't — provider SDK reached from a feature service
import sdk from 'some-email-sdk'; // only legal inside email.adapter.ts
```

See [12-library-wrapping-and-adapters.md](../rules/12-library-wrapping-and-adapters.md) and [16-i18n-and-messaging.md](../rules/16-i18n-and-messaging.md). Skills: [/skills/add-notification.md](../skills/add-notification.md), [/skills/add-library-adapter.md](../skills/add-library-adapter.md).

**Project records:** the channel inventory and the concrete provider behind each adapter.

---

## Decision 6 — Triggers are events, not inline calls

**Decision.** Notifications are triggered by domain events, not by inline calls buried in unrelated services. A service that publishes an order does not also call the email adapter; it emits `order.published`, and a notification handler reacts.

**Rationale.** Inline triggers scatter delivery logic across the codebase, make it impossible to see "what notifies whom," and couple core flows to delivery health. Event-driven triggers keep the notification map in one place and keep core flows fail-safe.

**Exception.** Truly synchronous, user-blocking confirmations (e.g. an OTP the caller must receive to continue) may be invoked directly through the adapter from the owning use case, with a terminal success/failure surfaced to the user — never silent fire-and-forget. Document each such exception.

---

## Decision 7 — Targeted fan-out respects scope and opt-in

**Decision.** When an event fans out to many recipients, the handler resolves the eligible audience explicitly and honors recipient scoping and opt-in:

- **Scope/tenant.** Only recipients within the resource's tenant/ownership boundary are notified (defense-in-depth, rule 35) — derived server-side, never from the client.
- **Invite/restriction semantics.** A restricted or invite-only resource notifies **only** the explicitly included recipients, never the whole population. (Broadcasting a restricted resource to everyone is a recurring, high-severity regression — keep a test for it.)
- **Opt-in preferences.** Recipients subscribe to categories/channels; the fan-out filters by stored preferences before delivery.

**Rationale.** Over-notification is both a privacy/scoping incident and a trust-eroding spam problem. The audience query is business logic — it lives in the notification module's domain/policy and lib helpers, fully tested. Recorded in [reliability-patterns.md](./reliability-patterns.md) and [known-pitfalls.md](./known-pitfalls.md).

**Project records:** the audience-resolution rules and the opt-in/category model for the domain.

---

## Decision 8 — Scheduled and async work has terminal states and observability

**Decision.** Recurring jobs (cleanup, expiration sweeps, retry drains) are registered through the framework scheduler at bootstrap and wrapped so each run is logged, bounded, and idempotent. Any async delivery that affects a user outcome must reach a terminal state (success / failure / timeout) and surface failure — no endless retries, no silent drops.

**Rationale.** Long-running and background work that lacks terminal states and operator visibility becomes invisible failure. Schedulers and retry drains are operational surfaces and need the same logging/metrics discipline as request paths (rules 38–39).

See [10-reliability-and-durability.md](../rules/10-reliability-and-durability.md), [19-async-events-and-jobs.md](../rules/19-async-events-and-jobs.md), and [14-observability-and-logging.md](../rules/14-observability-and-logging.md). **Project records:** the scheduled jobs, their cadence, and their owners.

---

## At a glance

| Concern     | Standing decision                                                                                      |
| ----------- | ------------------------------------------------------------------------------------------------------ |
| Bus         | In-process `core/events` adapter; broker behind same interface only when durability/fan-out demands it |
| Event names | Past-tense enums in `model/` / `@shared/enums`; payloads are named types                               |
| Emission    | After commit, owned by the use case                                                                    |
| Handlers    | Fail-safe try/catch + logger; idempotent; never crash the publisher                                    |
| Triggers    | Domain events, not inline calls (sync OTP-style exceptions documented)                                 |
| Delivery    | `notifications` module → channel **adapters** only; intent not transport                               |
| Fan-out     | Scope/tenant + invite semantics + opt-in, resolved server-side                                         |
| Async/jobs  | Terminal states, idempotency, structured logs                                                          |

---

## Checklist before shipping event/notification work

- [ ] Event name is a past-tense enum/const; payload is a named type — no magic strings, no inline shapes
- [ ] Emission happens **after** commit; multi-entity fan-out lives in a use case
- [ ] Every handler is fire-and-forget: try/catch + `@core/logger`, never rethrows, idempotent where redelivery is possible
- [ ] No provider SDK outside its adapter; callers express intent through the notification service
- [ ] Trigger is an event (or a documented synchronous exception with a terminal state)
- [ ] Fan-out filters by tenant/ownership, invite/restriction semantics, and opt-in preferences
- [ ] Subscription-count assertions in integration tests updated when a handler is added
- [ ] Scheduled/async work has terminal states, idempotency, and observability
- [ ] Tests and docs updated in the same change

**Related:** [19-async-events-and-jobs.md](../rules/19-async-events-and-jobs.md) · [10-reliability-and-durability.md](../rules/10-reliability-and-durability.md) · [12-library-wrapping-and-adapters.md](../rules/12-library-wrapping-and-adapters.md) · [reliability-patterns.md](./reliability-patterns.md) · [library-boundaries.md](./library-boundaries.md) · [known-pitfalls.md](./known-pitfalls.md) · [/skills/add-event-handler.md](../skills/add-event-handler.md) · [/skills/add-notification.md](../skills/add-notification.md)
