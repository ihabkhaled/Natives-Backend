# 19 — Async, Events & Jobs

> The contract for everything that happens **after** the request returns: in-process domain events, fire-and-forget handlers, background jobs and queues, long-running work, and streaming. It implements the event-bus and terminal-state contracts referenced by rules 38–39 of [00-non-negotiable-rules.md](./00-non-negotiable-rules.md) and the durability playbook in [10-reliability-and-durability.md](./10-reliability-and-durability.md). Decoupling is the goal; **losing work, blocking the caller, or spinning a client forever** is the failure mode this file prevents.

Synchronous code returns its outcome to the caller. Asynchronous code does not — so every async path here must be **named, isolated, idempotent, observable, and terminal**. Where rule 10 owns transactions, idempotency, retries, and the outbox, this file owns the event-bus mechanics, the job/queue adapter contract, streaming stop conditions, and end-to-end traceability from trigger to effect.

---

## 1. When to use an event (vs. a direct call)

| Use a **direct call** (use case → service) | Use a **domain event** |
| --- | --- |
| The result is needed to complete the request | The work is a *reaction* the request doesn't wait for |
| One owner, one transaction | One trigger, **many** independent reactions (fan-out) |
| Failure must fail the request | Failure must **not** fail the request |
| Caller and callee are the same module | The reaction lives in another module ([01-architecture-and-module-boundaries.md](./01-architecture-and-module-boundaries.md)) |

Events are the **only** sanctioned way for one module to react to another without importing its internals (rule 24). The publisher knows nothing about its subscribers.

---

## 2. Emit after commit, never inside the transaction

A domain event announces a fact that already happened. Emit it **after** the transaction commits — the row must be durable before any handler reads it. Emitting inside the transaction risks a handler observing state that a later rollback erases.

```ts
// DO — use case commits, THEN emits (post-commit, fire-and-forget)
async execute(input: PublishOrderInput): Promise<OrderResult> {
  const order = await this.uow.run((tx) => this.orders.publish(input, tx));
  this.events.emit(OrderEvent.PUBLISHED, this.mapper.toPublishedEvent(order));
  return this.mapper.toResult(order);
}
```

```ts
// DON'T — emit inside the transaction; a later rollback leaves handlers acting on a ghost
await this.uow.run(async (tx) => {
  const order = await this.orders.publish(input, tx);
  this.events.emit(OrderEvent.PUBLISHED, order); // handler may read uncommitted state
});
```

When the event MUST be paired with the state change (a downstream consumer cannot tolerate a lost event), use the **outbox** — write the domain row and an outbox row in the same transaction and let a relay publish it. See [10-reliability-and-durability.md](./10-reliability-and-durability.md) §3.

---

## 3. The event bus lives in `@core/events`

Wrap the emitter (`EventEmitter2`, or `@nestjs/cqrs` when the project needs commands/queries/sagas) behind an app-owned interface so business code depends on **your** bus, not the vendor — exactly the adapter rule ([12-library-wrapping-and-adapters.md](./12-library-wrapping-and-adapters.md)). Swapping in-process events for a broker (e.g. a message queue) later changes one file.

```ts
// @core/events/event-bus.ts — the only place the emitter library is imported
@Injectable()
export class EventBus {
  constructor(
    private readonly emitter: EventEmitter2,
    private readonly logger: AppLogger,
  ) {}

  emit<T>(event: DomainEventName, payload: T): void {
    this.emitter.emit(event, payload); // synchronous dispatch; handlers isolate themselves (§5)
  }
}
```

- Payloads are **typed** in `model/<feature>.types.ts` — no inline payload shapes anywhere (rule 10). A payload carries identifiers and the facts a handler needs, plus a correlation id (§9); it never carries secrets or full entities.
- Handlers register declaratively with `@OnEvent(OrderEvent.PUBLISHED)` on a provider in the consuming module — **never** by reaching into another module's bus directly.
- Multiple handlers may subscribe to one event. The publisher is unaware of how many.

---

## 4. Event names are constants — never magic strings

Every event name is a member of a domain enum / `as const` map in `model/<feature>.enums.ts`, namespaced `<feature>.<action>` in past tense (the event is a fact). Magic-string event names are a rule-8 violation and break refactors silently.

```ts
// model/order.enums.ts
export const OrderEvent = {
  PUBLISHED: 'order.published',
  CANCELLED: 'order.cancelled',
  FULFILLED: 'order.fulfilled',
} as const;
export type OrderEvent = (typeof OrderEvent)[keyof typeof OrderEvent];
```

```ts
// DON'T — magic string; a typo here is a silently-dropped event
this.events.emit('orderPublished', payload);
```

Past-tense names keep producer and consumer decoupled: `order.published` states what happened, not what a subscriber should do.

---

## 5. Handlers are fire-and-forget and catch their own errors

A handler runs **outside** the request that triggered it. A throw from a handler must never propagate back to the publisher or fail the originating operation. Each `handle` wraps its body in `try/catch` and logs failures via the logger adapter — delivery failure is logged, **never** rethrown into the caller. This is the single most repeated reliability mistake (rule 38, [10-reliability-and-durability.md](./10-reliability-and-durability.md) §7).

```ts
// DO — handler owns its failure; a delivery error never aborts "order published"
@Injectable()
export class NotifyOnOrderPublishedHandler {
  constructor(
    private readonly notifier: NotificationService,
    private readonly logger: AppLogger,
  ) {}

  @OnEvent(OrderEvent.PUBLISHED)
  async handle(event: OrderPublishedEvent): Promise<void> {
    try {
      await this.notifier.notifySubscribers(event.orderId);
    } catch (error: unknown) {
      this.logger.error('notify subscribers failed', { orderId: event.orderId, correlationId: event.correlationId, error });
    }
  }
}
```

```ts
// DON'T — an unhandled throw aborts the publisher's success path
@OnEvent(OrderEvent.PUBLISHED)
async handle(event: OrderPublishedEvent): Promise<void> {
  await this.notifier.notifySubscribers(event.orderId); // throws → transition fails
}
```

A handler is a thin transport into the application layer: validate prerequisite state, delegate to a service/use case, catch. Heavy work belongs in a service, not the handler body. If a handler fans out to many recipients, contain partial failures with `Promise.allSettled` in a use case/adapter (never a service — banned by ESLint), per [10-reliability-and-durability.md](./10-reliability-and-durability.md) §8.

> **Test contract:** adding a new subscriber changes the registered-handler count. Assert it — `expect(emitter.listenerCount(OrderEvent.PUBLISHED)).toBe(N)` — so a silently-unregistered handler fails CI ([11-testing-and-coverage.md](./11-testing-and-coverage.md)). Forgetting to bump this is a very common miss.

---

## 6. Background jobs & queues go through an adapter

Anything deferred, scheduled, or retried out-of-band is a **job**: a queue worker (e.g. a Redis-backed queue), a cron task, or a relay. The queue library is wrapped behind an adapter so the rest of the app enqueues against your interface, not the vendor SDK.

```ts
// @core/jobs/job-queue.ts — the queue library is imported ONLY here
@Injectable()
export class JobQueue {
  enqueue<T>(name: JobName, payload: T, options: JobOptions): Promise<JobHandle> { /* ... */ }
}
```

Every job MUST define, in named constants (no inline magic numbers, rule 13):

| Control | Rule |
| --- | --- |
| **Idempotency** | A job runs **at-least-once**; design the handler to be safe on replay — dedupe on a stable key (the entity id, the trigger event id) so a re-run touches nothing new ([10-reliability-and-durability.md](./10-reliability-and-durability.md) §2). |
| **Bounded retry** | Cap attempts; retry **transient** failures only, with exponential backoff + jitter. Never retry a permanent/`4xx`-class failure — route it straight to the DLQ. |
| **Dead-letter** | After retries are exhausted, the job goes to a **DLQ** with its payload, failure reason, and correlation id — never silently dropped, never infinitely redelivered (a poison message must not block the queue). |
| **Timeout** | Each job has a max runtime; a hung job must not occupy a worker forever. |
| **Terminal state** | Every job ends in **completed**, **failed**, or **timed-out** — persisted and observable (§7). |

DLQ depth and job latency are **monitored signals**, not afterthoughts — surface them per [14-observability-and-logging.md](./14-observability-and-logging.md). A DLQ that nobody watches is a silent outage.

---

## 7. Long-running work must reach a terminal state

A job triggered by an event (not an HTTP request) cannot return an error to a caller. If it fails silently, a polling or streaming client spins forever (rule 39). Drive every long-running workflow to a **terminal state** and make the client's stop condition observable.

```ts
// DO — success and failure are both persisted; the client's stop condition is always satisfied
async run(payload: ReportJobPayload): Promise<void> {
  try {
    const result = await this.generator.build(payload);
    await this.results.complete(payload.jobId, result);   // terminal: COMPLETED
    this.events.emit(ReportEvent.READY, { jobId: payload.jobId, correlationId: payload.correlationId });
  } catch (error: unknown) {
    this.logger.error('report job failed', { jobId: payload.jobId, correlationId: payload.correlationId, error });
    await this.results.markFailed(payload.jobId, this.toReason(error)); // terminal: FAILED
    this.events.emit(ReportEvent.FAILED, { jobId: payload.jobId, correlationId: payload.correlationId });
  }
}
```

```ts
// DON'T — error swallowed, no terminal state; the client polls forever
try {
  await this.generator.build(payload);
} catch {
  this.logger.error('job failed'); // no record, no signal → endless loading
}
```

- Persisting the terminal record and emitting the signal are **independent** concerns — when you do both, isolate each in its own `try/catch` so a failed signal never skips the durable record (the pattern in [10-reliability-and-durability.md](./10-reliability-and-durability.md) §7).
- A status carried by clients is an enum in `model/` (`PENDING | RUNNING | COMPLETED | FAILED | TIMED_OUT`) — never raw strings (rules 8, 12).
- A job that exceeds its timeout transitions to `TIMED_OUT` and is itself a terminal state — not a hang.

---

## 8. Streaming & SSE have explicit stop conditions

Server-Sent Events, WebSocket pushes, and chunked/token streams are long-lived connections. Every stream MUST define when it ends — otherwise the connection (and any client buffer) leaks.

- **Terminal frame:** always send an explicit `done` / `error` event before closing. A client must never infer completion from silence.
- **Idle + total timeout:** close the stream if no chunk arrives within an idle window, and cap total duration. Both are named constants.
- **Cancellation:** when the client disconnects, abort the upstream work (cancel the underlying call, release the cursor) — don't keep producing into a dead socket.
- **Backpressure:** bound any in-memory buffer; if the consumer can't keep up, slow or fail with a terminal error, never grow unbounded.
- **Errors become a terminal frame:** a mid-stream failure emits a typed error event (carrying a `messageKey`, not a stack — [18-error-handling-and-exceptions.md](./18-error-handling-and-exceptions.md)) and closes; it never silently stops.

```ts
// DON'T — no terminal frame, no idle timeout: a stalled upstream hangs the client forever
for await (const chunk of upstream) subject.next(chunk);

// DO — terminal frame on every exit path; idle + total caps bound the stream
try {
  for await (const chunk of this.withIdleTimeout(upstream, STREAM_IDLE_TIMEOUT_MS)) {
    subject.next({ type: StreamEvent.CHUNK, data: chunk });
  }
  subject.next({ type: StreamEvent.DONE });
} catch (error: unknown) {
  this.logger.error('stream failed', { correlationId, error });
  subject.next({ type: StreamEvent.ERROR, messageKey: this.toMessageKey(error) });
} finally {
  subject.complete(); // socket is always closed
}
```

---

## 9. Traceability from trigger to effect

You must be able to follow one business action across every async hop it spawns. Without a correlation id, a failed downstream effect is undebuggable.

- A **correlation id** is created at the request boundary (an interceptor, [14-observability-and-logging.md](./14-observability-and-logging.md)) and travels in every event payload, job payload, and DLQ entry as a typed field.
- Every handler and job logs `{ correlationId, event/job name, key ids }` on entry and on failure (structured, via the logger adapter — never `console.*`, rule 28).
- The chain is recoverable end-to-end: *request → emitted event → handler → enqueued job → terminal state*. Causal sequencing (event B is published only after event A's handler commits) keeps ordering meaningful without a global ordering guarantee.
- Document each feature's events and their consumers in [/memory/event-notification-decisions.md](../memory/event-notification-decisions.md) (the catalog) — a new event without a documented trigger/consumer is incomplete (rule 41).

---

## 10. What async code must never do

- **Never** `await` a fire-and-forget handler in the request path — that re-couples the caller to the side effect's latency and failure.
- **Never** leave a floating promise (`@typescript-eslint/no-floating-promises` is `error`). Detach deliberately through the bus/queue, or `await` it — never `void someAsync()` and hope.
- **Never** swallow a job/handler error without a log **and** a terminal state.
- **Never** retry without a cap, a backoff, and a transient-vs-permanent decision.
- **Never** open a stream or start a poll without a defined stop condition.
- **Never** emit secrets, tokens, or full entities in an event payload — identifiers and facts only (rules 5, 28).
- **Never** use `Promise.all|allSettled|any|race` inside a service (ESLint-banned) — fan-out lives in a use case or adapter ([03-application-services-and-use-cases.md](./03-application-services-and-use-cases.md)).

---

## Async / events / jobs checklist (before "done")

- [ ] Events emitted **after** commit (or via the outbox when the event must not be lost).
- [ ] Event names are constants in `model/`, past-tense `<feature>.<action>` — no magic strings.
- [ ] Payloads typed in `model/`, carry a correlation id, carry **no** secrets or full entities.
- [ ] The emitter/queue library is wrapped in `@core/events` / `@core/jobs` — never imported in business code.
- [ ] Every handler wraps its body in `try/catch` and logs; a delivery failure never aborts the publisher.
- [ ] New subscriber → the registered-handler-count test is updated.
- [ ] Jobs are idempotent, retry transient-only with capped backoff + jitter, dead-letter on exhaustion, and time out.
- [ ] Every long-running workflow reaches a persisted terminal state (completed / failed / timed-out) with operator visibility.
- [ ] Streams send a terminal frame on every exit path; idle + total timeouts and cancellation are wired.
- [ ] Trigger → effect is traceable by correlation id; the event/consumer catalog is updated.
- [ ] No floating promises; no `Promise.all*` in services; DLQ depth and job latency are monitored.
- [ ] Tests written/updated first; gates green: `npm run lint` · `npm run typecheck` · `npm run test` · `npm run test:coverage` · `npm run build`.

**Related:** [00-non-negotiable-rules.md](./00-non-negotiable-rules.md) · [10-reliability-and-durability.md](./10-reliability-and-durability.md) · [03-application-services-and-use-cases.md](./03-application-services-and-use-cases.md) · [01-architecture-and-module-boundaries.md](./01-architecture-and-module-boundaries.md) · [12-library-wrapping-and-adapters.md](./12-library-wrapping-and-adapters.md) · [14-observability-and-logging.md](./14-observability-and-logging.md) · [18-error-handling-and-exceptions.md](./18-error-handling-and-exceptions.md) · [add-event-handler.md](../skills/add-event-handler.md) · [reliability-review.md](../skills/reliability-review.md) · [/memory/event-notification-decisions.md](../memory/event-notification-decisions.md)
