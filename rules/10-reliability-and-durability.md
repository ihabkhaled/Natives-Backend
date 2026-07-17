# 10 — Reliability & Durability

> The operational playbook for **not losing data and not crashing the process**. It implements the resilience contracts in [/context/architecture-map.md](../context/architecture-map.md) and rules 38–39 of [00-non-negotiable-rules.md](./00-non-negotiable-rules.md). Every remote call has a timeout; every retry is capped, backed off, and jittered; every side effect is idempotent and fail-safe; the HTTP server stays up.

A dropped state transition, a double-charged retry, or a notification throw that aborts a business operation are all production incidents. The whole point of this file is to make writes atomic, side effects fire-and-forget, remote calls bounded, and shutdown clean.

---

## 1. Transactions for every multi-write

Any operation that performs **two or more writes that must all succeed or all fail** runs inside a single transaction. The **application layer owns the boundary** — a use case, never a repository (repositories only persist; see [04-repositories-and-persistence.md](./04-repositories-and-persistence.md)). This is exactly the shape that escalates a service into a use case ([03-application-services-and-use-cases.md](./03-application-services-and-use-cases.md)).

```ts
// DO — use case owns the boundary; rollback on any failure; external I/O AFTER commit
@Injectable()
export class TransferFundsUseCase {
  constructor(
    private readonly uow: UnitOfWork, // ORM-agnostic transaction wrapper (adapter)
    private readonly logger: AppLogger,
  ) {}

  async execute(input: TransferInput): Promise<TransferResult> {
    const result = await this.uow.run(async (tx): Promise<TransferResult> => {
      await this.accounts.debit(input.fromId, input.amount, tx);
      await this.accounts.credit(input.toId, input.amount, tx);
      return this.transfers.record(input, tx);
    });
    this.events.emit(AccountEvent.Transferred, result); // post-commit, fire-and-forget (§7)
    return result;
  }
}
```

```ts
// DON'T — two awaited writes, no transaction; a crash between them corrupts state
await this.accounts.debit(input.fromId, input.amount);
await this.accounts.credit(input.toId, input.amount); // throws → money vanished
```

Rules:

- **The transaction releases its resources in a `finally`** — wrap it once inside the `UnitOfWork` adapter so callers can't leak a connection. A leaked transaction permanently consumes a pool slot.
- **Keep transactions small.** Never wrap remote calls (an email provider, object storage, an SMS gateway) inside the transaction — network latency holds row locks. Do external I/O **after** commit.
- **Re-throw after rollback** so the global exception filter maps the failure to a `messageKey` ([18-error-handling-and-exceptions.md](./18-error-handling-and-exceptions.md)). Never swallow a rollback.

---

## 2. Idempotency for retryable writes, payments & webhooks

Clients retry. Webhooks redeliver. Schedulers re-run. Any endpoint or consumer that **causes a side effect more than once when called twice** needs an idempotency guard.

| Source                    | Dedupe on                                              | Behaviour on replay                                                            |
| ------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------ |
| Retryable write / payment | client-supplied idempotency key (DTO field, validated) | return the stored result, no second effect                                     |
| Inbound webhook           | the provider's **event id** (never a payload hash)     | no-op `200`                                                                    |
| State transition          | current state                                          | re-applying a done transition returns current state — no throw, no double-emit |
| Scheduled job             | a bounded predicate ("only rows still pending")        | a double-run touches nothing new                                               |

- **Scope the idempotency key to the actor** (the verified identity from the token, never the body) so one tenant cannot collide with another ([07-security-authn-authz.md](./07-security-authn-authz.md)).
- Persist `(key → result)` and short-circuit on the second call. Make the persistence layer enforce uniqueness so the dedupe survives concurrent retries.
- Make state transitions idempotent in the **domain** state machine ([06-types-enums-constants.md](./06-types-enums-constants.md) for the enum), not in the controller.

---

## 3. Outbox for critical events

When a state change MUST be paired with an event that downstream consumers depend on, do not "write the row, then publish and hope" — a crash between the two loses the event.

- Write the **domain row and an outbox row in the same transaction** (§1). The outbox row is the durable record of intent.
- A relay/poller publishes un-dispatched rows to handlers and marks them dispatched. This is **at-least-once** delivery; combine with §2 for **effectively-once** processing.
- Key the outbox row by the event id so a re-published event dedupes at the persistence layer.

See [19-async-events-and-jobs.md](./19-async-events-and-jobs.md) for the event-bus contract and [add-event-handler.md](../skills/add-event-handler.md) to wire a consumer.

---

## 4. Remote calls: timeout + bounded retry + circuit breaker

Every outbound call to an external service goes through its **adapter** ([12-library-wrapping-and-adapters.md](./12-library-wrapping-and-adapters.md)). The adapter — never the caller — owns resilience. Centralizing it there is why resilience is testable and swappable.

| Control              | Rule                                                                                                                                                 |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Timeout**          | Every HTTP/socket call has an explicit per-request timeout. A hung dependency must not hang a request.                                               |
| **Retry**            | Cap attempts; retry **transient** errors only (network, timeout, `429`, `5xx`). **Never retry a `4xx`** — the input is wrong; retrying wastes quota. |
| **Backoff + jitter** | Exponential backoff with full jitter so retries don't synchronize into a thundering herd.                                                            |
| **Circuit breaker**  | After N consecutive failures, open and fail fast (degrade per §5). Half-open after a cooldown to probe recovery.                                     |

```ts
// DON'T — caller does raw I/O: no timeout, no retry, no breaker
const res = await this.httpClient.get(url); // one slow API stalls the request thread

// DO — call the adapter; it owns timeout/retry/breaker + structured logging
const profile = await this.paymentProvider.fetchProfile(customerId);
```

Inside the adapter, give the values names — no inline magic numbers (rule 13):

```ts
// payment.constants.ts
export const PAYMENT_TIMEOUT_MS = 4_000;
export const PAYMENT_MAX_ATTEMPTS = 3;
export const PAYMENT_BACKOFF_BASE_MS = 200;

// payment.adapter.ts — retry transient only, capped, jittered
private async withRetry<T>(call: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await call();
    } catch (error: unknown) {
      if (attempt >= PAYMENT_MAX_ATTEMPTS || !this.isTransient(error)) throw error;
      await this.sleep(this.backoffWithJitter(attempt));
    }
  }
}
```

> **Concurrency note:** `Promise.all|allSettled|any|race` are banned **inside services** by ESLint (`no-restricted-syntax`). Fan-out concurrency belongs in a use case or an adapter — see §8.

---

## 5. Graceful degradation & safe fallbacks

The process serves traffic even when **optional** dependencies are down. Distinguish optional from required, and act accordingly.

- **Optional dependency down** (e.g. a cache) → log and continue; recompute from the system of record. Never `500` because the cache is cold.
- **Required dependency down** → return a typed `AppError` mapped to **`503`**, and report unready (§9). Check readiness before querying — never blindly hit a connection you know is down.
- Isolate each startup dependency in its own `try/catch` and **log-and-continue** for optional ones; only a failure to bind the listener should abort boot.

```ts
// DO — optional dependency failure degrades, never crashes
async getProfile(id: AccountId): Promise<Account> {
  const cached = await this.cache.safeGet(id); // adapter swallows + logs cache errors
  if (cached !== null) return cached;
  const account = await this.loadAccountOrThrow(id); // repo returns null; the service throws (rules/04)
  await this.cache.safeSet(id, account); // best-effort, never throws into the caller
  return account;
}
```

---

## 6. Dead-letter handling

For any queue/consumer:

- A message that fails after its **bounded** retries goes to a **dead-letter queue (DLQ)** — never silently dropped, never infinitely redelivered (a poison message must not block the queue).
- DLQ entries carry the original payload, the failure reason, and a correlation id for replay.
- Consumers are idempotent (§2) so a DLQ replay is safe.
- Payloads are typed in `model/<feature>.types.ts` — no inline payload shapes in the consumer (rule 10). See [19-async-events-and-jobs.md](./19-async-events-and-jobs.md).

---

## 7. Side effects after a transition are fire-and-forget — handlers catch their own errors

This is the single most repeated reliability mistake. A throw from an event handler propagates back through the publisher and **aborts the success path of the operation that emitted it**. Notification dispatch must never crash a business workflow.

The event bus already isolates handlers (each `handle()` runs under its own `try/catch`). **But** any handler that fans out to a notification or broadcast adapter MUST _additionally_ wrap that call so one recipient's failure never surfaces as a transition failure:

```ts
// DO — the handler swallows its own side-effect failure
async handle(event: OrderPublishedEvent): Promise<void> {
  try {
    await this.notifier.notifySubscribers(event.orderId);
  } catch (error: unknown) {
    this.logger.error('notify subscribers failed', { orderId: event.orderId, error });
  }
}
```

```ts
// DON'T — an unhandled throw aborts the "order published" success path
async handle(event: OrderPublishedEvent): Promise<void> {
  await this.notifier.notifySubscribers(event.orderId); // throws → transition fails
}
```

**Background jobs** (triggered by an event, not an HTTP request) can't return an error to a caller — if they fail silently, a polling client spins forever. Apply the durable-error pattern: emit an immediate signal **and** persist a terminal error record, each in its **own** `try/catch` so one failing path can't skip the other.

```ts
// DO — terminal failure is recorded so the client's stop condition is satisfied
async runInBackground(payload: JobPayload): Promise<void> {
  try {
    const result = await this.provider.execute(payload);
    await this.results.complete(payload.jobId, result);
  } catch (error: unknown) {
    this.logger.error('background job failed', { jobId: payload.jobId, error });
    try {
      this.realtime.emitFailure(payload.jobId); // immediate signal — independent
    } catch (emitError: unknown) {
      this.logger.warn('failed to emit failure signal', { jobId: payload.jobId, error: emitError });
    }
    try {
      await this.results.markFailed(payload.jobId, String(error)); // durable terminal state
    } catch (persistError: unknown) {
      this.logger.error('failed to persist failure', { jobId: payload.jobId, error: persistError });
    }
  }
}
```

```ts
// DON'T — error swallowed with no terminal state; the client polls forever
try {
  await this.provider.execute(payload);
} catch {
  this.logger.error('job failed'); // no signal, no record → endless loading
}
```

Every long-running/async workflow must reach a **terminal state** — success, failure, or timeout — with operator visibility (rule 39, [19-async-events-and-jobs.md](./19-async-events-and-jobs.md)).

---

## 8. Contained fan-out failures

A single failed delivery (one recipient's email bounces, one push send `500`s) must not abort the batch:

- Use `Promise.allSettled` for fan-out — **never** `Promise.all`, where one rejection drops every other result. (This lives in a use case or adapter, not a service — §4.)
- Wrap each call's failure in **structured** logging (`logger.error('...', { error, context })`) and surface an aggregate outcome (succeeded / failed counts), not a single throw.
- Never let one delivery failure propagate as an unhandled exception.

```ts
// DO — fan out, settle, report partials (in a use case)
const outcomes = await Promise.allSettled(
  recipients.map(r => this.notifier.send(r)),
);
const failed = outcomes.filter(
  (o): o is PromiseRejectedResult => o.status === 'rejected',
);
if (failed.length > 0)
  this.logger.warn('partial delivery', {
    failed: failed.length,
    total: recipients.length,
  });
```

---

## 9. Health & readiness endpoints

- **`GET /health` (liveness)** — no dependency I/O. It answers as long as the process can serve a request. Orchestrators use it to decide whether to restart the pod.
- **`GET /health/ready` (readiness)** — probes the dependencies the app **hard-requires** and returns `200 ready` when all are healthy or `503 degraded` otherwise. Orchestrators use it to gate traffic.

When you add a dependency the app hard-requires, add it to the readiness probe and return `503` when it's down — **never report `ready` while a required dependency is failing**. Optional dependencies (a cache, a log sink) stay out of readiness; their absence degrades, not fails (§5).

---

## 10. Graceful shutdown & process resilience

Enable Nest's shutdown hooks and tear down every long-lived resource cleanly.

```ts
// bootstrap.ts — wire shutdown hooks once
const app = await NestFactory.create(AppModule);
app.enableShutdownHooks(); // dispatches OnModuleDestroy on SIGTERM / SIGINT
```

```ts
// any provider holding a long-lived resource releases it deterministically
@Injectable()
export class JobScheduler implements OnModuleDestroy {
  async onModuleDestroy(): Promise<void> {
    await this.safeStop('scheduler', () => this.scheduler.stop());
  }

  private async safeStop(
    name: string,
    stop: () => Promise<void>,
  ): Promise<void> {
    try {
      await stop();
      this.logger.info(`${name} stopped`);
    } catch (error: unknown) {
      this.logger.warn(`failed to stop ${name}`, { error }); // swallow so one stuck client can't block the rest
    }
  }
}
```

Shutdown sequence:

1. Stop accepting new work (intervals/timers cleared, consumers paused) so nothing starts mid-shutdown.
2. Drain in-flight work, then disconnect each dependency, **swallowing and logging** individual failures so one stuck client can't block the others.
3. Let the process exit normally.

**Never crash the server on a stray error.** Global `uncaughtException` / `unhandledRejection` handlers **log but do not exit** — one bad request must not take down every other in-flight request. Any new long-lived resource (timer, socket, pool, consumer) MUST be released in `onModuleDestroy`.

---

## 11. Startup configuration checks

- Configuration is validated **once at startup** by the typed config schema (`@nestjs/config`, [17-configuration-and-environment.md](./17-configuration-and-environment.md)). Required values **fail fast** — a misconfigured deploy must not boot half-working; optional values have defaults.
- **Never read `process.env` outside `config/` and `bootstrap/`** (rule 27, ESLint-enforced). Inject typed config instead.
- Gate production-only hardening (e.g. transport TLS for remote dependencies) on the validated environment value, not an ad-hoc env read.

---

## 12. Migration safety, rollback, backup/restore

See [migration-plan.md](../skills/migration-plan.md) and [add-migration-backfill.md](../skills/add-migration-backfill.md) for the full procedure; the durability rules:

- **Forward and backward** — every migration implements `up()` and a real `down()`. An empty/throwing `down()` is unrollback-able and is rejected in review.
- **Expand → migrate → contract** for breaking changes: add the new shape (expand), backfill + dual-write, switch reads, then drop the old shape in a _later_ migration. Never rename/drop a live column in one deploy — it breaks in-flight requests.
- **Additive first** — prefer nullable-add + backfill over `NOT NULL`-with-default on a large table (avoids long locks). Add indexes concurrently where the DB supports it.
- **Backup before destructive migrations** and confirm restore works. Treat restore as the real rollback when a `down()` cannot recover dropped data.
- **Backfills** are chunked, resumable, observable, rate-aware, and safe to pause/retry; they report rows touched and whether rerun is safe.

---

## Reliability checklist (before "done")

- [ ] Every multi-write is in one transaction owned by a use case; resources release in `finally`.
- [ ] External I/O happens **after** commit, never inside the transaction.
- [ ] Retryable writes / payments / webhooks are idempotent (key scoped to the verified actor; webhooks dedupe on event id).
- [ ] Critical events are written with their state change (outbox), not after.
- [ ] Every remote call has a timeout + capped retry (transient only) + backoff-with-jitter + breaker — **inside the adapter**.
- [ ] Optional-dependency failures degrade gracefully; required ones return `503` and report unready.
- [ ] Every event handler and background job wraps its side effect in `try/catch`; background jobs persist a terminal state.
- [ ] Fan-out uses `Promise.allSettled` (in a use case/adapter, never a service) and reports partial failures.
- [ ] `/health` (no I/O) and `/health/ready` (required deps) reflect real state.
- [ ] `enableShutdownHooks()` is on; every long-lived resource releases in `onModuleDestroy`; `uncaughtException`/`unhandledRejection` log but never exit.
- [ ] New migrations have a real `down()`, are additive/expand-first, and are backed up before destructive steps.
- [ ] Gates green: `npm run lint` · `npm run typecheck` · `npm run test` · `npm run test:coverage` · `npm run build`.

**Related:** [00-non-negotiable-rules.md](./00-non-negotiable-rules.md) · [03-application-services-and-use-cases.md](./03-application-services-and-use-cases.md) · [12-library-wrapping-and-adapters.md](./12-library-wrapping-and-adapters.md) · [19-async-events-and-jobs.md](./19-async-events-and-jobs.md) · [14-observability-and-logging.md](./14-observability-and-logging.md) · [reliability-review.md](../skills/reliability-review.md) · [/memory/reliability-patterns.md](../memory/reliability-patterns.md)
