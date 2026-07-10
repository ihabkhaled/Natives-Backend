# Skill: Reliability Review

> Audit a change set for failure-mode robustness — fail-safe integrations, timeouts/retries, transaction boundaries, idempotency, fire-and-forget handlers, and graceful shutdown — and prove it with tests. Implements the canon in [/context/architecture-map.md](../context/architecture-map.md) and the hard rules in [00-non-negotiable-rules.md](../rules/00-non-negotiable-rules.md). **Core principle: no optional-dependency failure may crash the process, and no side-effect failure may block a domain transition.**

## Rules this skill enforces

- **Rule 38** — side effects are fail-safe; retries/timeouts/cancellation are explicit and observable.
- **Rule 39** — long-running/async workflows have terminal states and operator visibility.
- **Rule 32 / 12** — every external library sits behind an adapter; business code never touches the SDK.
- **Rules 26, 36** — failures surface as typed `AppError` with a `messageKey`; the global exception filter sanitizes the body; raw provider/SQL detail never reaches the client.
- **Rule 28** — `@core/logger` only; redact secrets/PII.

Full layer detail: [10-reliability-and-durability.md](../rules/10-reliability-and-durability.md), [19-async-events-and-jobs.md](../rules/19-async-events-and-jobs.md), [12-library-wrapping-and-adapters.md](../rules/12-library-wrapping-and-adapters.md).

---

## Tests FIRST

Before touching code, write the failing-path tests. Reliability bugs hide on the unhappy branch, so prove it exists, then fix it:

1. Mock the adapter to **reject** and assert the caller logs, returns a typed failure, and the domain transition still succeeds.
2. Make an event handler **throw internally** and assert the publisher still resolves and the workflow completes.
3. Invoke a duplicate-able handler **twice** and assert a single row / single side effect (idempotency).

See [write-unit-tests.md](./write-unit-tests.md) and [reliability-engineer.md](../agents/reliability-engineer.md).

---

## Step 1 — Bound every outbound call (timeout)

No outbound call may wait forever. Set a timeout constant in `model/<feature>.constants.ts` and apply it inside the adapter — never in business code.

```ts
// adapters/<vendor>.adapter.ts — DO: bounded, wrapped, never leaks the SDK error
@Injectable()
export class EmailProviderAdapter {
  constructor(
    private readonly client: ProviderClient, // wrapped SDK, injected
    private readonly logger: AppLogger,
  ) {}

  async send(message: EmailMessage): Promise<SendResult> {
    try {
      return await this.client.deliver(message, {
        timeoutMs: EMAIL_TIMEOUT_MS,
      });
    } catch (error: unknown) {
      this.logger.error('email send failed', { to: message.to, error });
      throw new EmailDeliveryError(); // typed AppError, messageKey: errors.email.delivery_failed
    }
  }
}
```

```ts
// DON'T — unbounded network wait, raw SDK in business code, leaked error
const res = await sgClient.send(payload); // no timeout, vendor in the service, leaks on throw
```

## Step 2 — Make retries deliberate and bounded

Retry only **idempotent**, **transient** failures, with a bounded attempt count and backoff, both as constants. Never blind-retry a write that could double-apply.

```ts
async function withRetry<T>(
  op: () => Promise<T>,
  logger: AppLogger,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt += 1) {
    try {
      return await op();
    } catch (error: unknown) {
      lastError = error;
      if (!isTransient(error) || attempt === MAX_RETRY_ATTEMPTS) break;
      logger.warn('retrying transient failure', { attempt });
      await delay(RETRY_BACKOFF_MS * attempt);
    }
  }
  throw lastError;
}
```

## Step 3 — Transaction boundaries (multi-write under one unit of work)

If a use case writes more than one row that must succeed or fail together, wrap it in a single transaction owned by the **use case** (services never own transactions). Release the unit of work in `finally`, and emit side effects **after commit** so a notification failure can never roll back persisted state.

```ts
// application/<action>.use-case.ts — DO
async execute(input: CreateOrderInput): Promise<OrderResult> {
  const result = await this.uow.runInTransaction(async tx => {
    const order = await this.orderRepository.save(tx, input.order);
    const audit = await this.auditRepository.save(tx, buildAuditEntry(order));
    return { order, audit };
  });
  this.events.publish(new OrderCreatedEvent(result.order)); // post-commit, fail-safe
  return toOrderResult(result.order);
}
```

```ts
// DON'T — side effect inside the transaction; a delivery failure rolls back the order
await this.uow.runInTransaction(async tx => {
  const order = await this.orderRepository.save(tx, input.order);
  await this.emailAdapter.send(buildReceipt(order)); // throws → order lost
});
```

Keep read-only queries out of transactions. The ORM/unit-of-work is interchangeable (TypeORM / Prisma / Mongoose / Sequelize are examples) — keep it behind the repository, and always release pooled connections in `finally`.

## Step 4 — Idempotency

Retried or duplicate-delivered requests (registration, verification, webhooks, payment-like flows) must be safe to run twice.

- Guard the **source state** in the domain state machine so a double-fire is a no-op, not corruption — see [03-application-services-and-use-cases.md](../rules/03-application-services-and-use-cases.md).
- Back the guard with a **DB unique constraint**; under concurrency a read-then-write check is not enough. Catch the conflict and map it to a typed `ConflictError`.

```ts
// domain/<feature>.state-machine.ts — DO: transition validates current state
if (order.status !== OrderStatus.Draft) {
  return order; // already published → idempotent no-op
}
return { ...order, status: OrderStatus.Published };
```

## Step 5 — Fire-and-forget side effects (the #1 recurring bug)

A throw inside an event handler propagates back into the publisher and blocks the domain transition. **Every** notification/broadcast handler catches its own errors and logs — it must never re-throw into the workflow.

```ts
// DO — handler self-contains its failure
this.events.subscribe(
  OrderEvent.Published,
  async (event: OrderPublishedEvent) => {
    try {
      await this.broadcastService.notifyOfPublishedOrder(event.order);
    } catch (error: unknown) {
      this.logger.error('order broadcast failed', {
        orderId: event.order.id,
        error,
      });
    }
  },
);

// DON'T — unhandled throw blocks the publish path
this.events.subscribe(
  OrderEvent.Published,
  async (event: OrderPublishedEvent) => {
    await this.broadcastService.notifyOfPublishedOrder(event.order); // throws → blocks workflow
  },
);
```

- No floating promises: `await` it or explicitly `void` it (`no-floating-promises` is `error`).
- Adding any `subscribe(...)` requires updating the handler-registration test (subscription count + per-event assertions). See [add-event-handler.md](./add-event-handler.md).

## Step 6 — Optional dependencies never crash startup

Isolate cache/broker/optional-store initialization in its own try/catch in `bootstrap/`. Only the HTTP listener failing is fatal. Degraded-mode startup beats a crash loop.

```ts
// bootstrap/ — DO
try {
  await cacheAdapter.connect();
} catch (error: unknown) {
  logger.error('cache unavailable — starting in degraded mode', { error });
}
await app.listen(config.http.port); // only this failure should stop the process
```

## Step 7 — Terminal states for long-running work

Async/long-running workflows must reach a terminal state — success, failure, **or timeout** — with operator visibility. No endless "loading", no silent fire-and-forget. Define stop conditions and a cancellation path; emit a final state event either way. See [19-async-events-and-jobs.md](../rules/19-async-events-and-jobs.md).

## Step 8 — Graceful shutdown, no server-crashing throws

- Enable Nest shutdown hooks; on `SIGTERM` drain in-flight requests, then close each dependency through a `safeDisconnect`-style try/catch so one failing disconnect doesn't abort the rest.
- `uncaughtException` / `unhandledRejection` handlers **log, then exit cleanly** — they never swallow silently and never tear down mid-request.
- No `process.exit(1)` anywhere except a fatal bootstrap failure.

```ts
async function safeDisconnect(
  name: string,
  close: () => Promise<void>,
): Promise<void> {
  try {
    await close();
  } catch (error: unknown) {
    logger.error('disconnect failed', { name, error }); // continue shutting down the rest
  }
}
```

---

## Quality gate (all green before "done")

```bash
npm run lint            # 0 errors AND 0 warnings
npm run typecheck       # tsc --noEmit (TypeScript 7), project-wide
npm run test            # vitest
npm run test:coverage   # touched-module floor 95%, critical paths near 100%
npm run build           # compiles clean
```

Never bypass Husky hooks with `--no-verify`. A green build is not proof of correctness — walk the [review checklist](../rules/15-review-checklist.md).

## Pitfalls

- **Side effect inside the transaction.** A notification/event failure rolls back committed work. Emit after commit.
- **Unhandled throw in an event handler.** Propagates into the publisher and blocks the transition. Self-catch every handler.
- **Unbounded outbound call.** No timeout → a slow dependency exhausts the request pool. Bound every adapter call.
- **Blind retry of a non-idempotent write.** Doubles the side effect. Retry only idempotent, transient failures.
- **Optional dependency crashing bootstrap.** Init in its own try/catch; only `app.listen()` is fatal.
- **Read-then-write idempotency under concurrency.** Race creates duplicates. Back the guard with a unique constraint and catch the conflict.
- **Leaked provider/SQL error to the client.** Wrap in a typed `AppError`; the exception filter sanitizes (rule 36).
- **Floating promise.** Looks fire-and-forget but is unobserved. `await` or `void` it; add the try/catch.
- **Stray `process.exit`.** Kills in-flight requests. Reserve it for fatal bootstrap only.

## Related

[10-reliability-and-durability.md](../rules/10-reliability-and-durability.md) · [19-async-events-and-jobs.md](../rules/19-async-events-and-jobs.md) · [12-library-wrapping-and-adapters.md](../rules/12-library-wrapping-and-adapters.md) · [add-event-handler.md](./add-event-handler.md) · [add-library-adapter.md](./add-library-adapter.md) · [performance-review.md](./performance-review.md) · [observability-review.md](./observability-review.md) · [security-review.md](./security-review.md) · [write-unit-tests.md](./write-unit-tests.md) · [final-validation.md](./final-validation.md) · [reliability-engineer.md](../agents/reliability-engineer.md) · [reliability-patterns.md](../memory/reliability-patterns.md)
