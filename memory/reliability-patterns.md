# Reliability Patterns

> Durable conventions for how a NestJS backend in this workspace survives slow dependencies, partial failures, and restarts. Implements the canon in [/context/architecture-map.md](../context/architecture-map.md) and the hard rules in [/rules/00-non-negotiable-rules.md](../rules/00-non-negotiable-rules.md); enforcement detail lives in [/rules/10-reliability-and-durability.md](../rules/10-reliability-and-durability.md) and [/rules/19-async-events-and-jobs.md](../rules/19-async-events-and-jobs.md).

## Core decision

**A failure in an optional dependency must never take the process down.** Only the HTTP listener failing to bind is fatal. Every other startup step, scheduled tick, side effect, and shutdown disconnect is isolated, logged, and recoverable. Resilience is a first-class property of the change, not a follow-up.

Rationale: a single flaky cache, log sink, or notification provider should degrade a feature, not the whole service. Crashing on a transient error converts a degraded experience into an outage and a thundering-herd restart loop.

> Project records: list the dependencies classified as **critical** (process refuses traffic without them) vs **optional** (degrade gracefully) here.

## Dependency classification

| Class | Examples (illustrative) | Behavior on failure |
| --- | --- | --- |
| Critical | primary database | Startup logs and surfaces health as unhealthy; the readiness probe fails so traffic is withheld. Requests needing it return a typed `AppError` → `503`. |
| Optional | cache, object storage, search index, log sink, SMS/email/push providers | Log once, continue. Features that require it return a typed `503` `AppError`; everything else keeps serving. |

Readiness reflects dependency truth — never report ready while a critical dependency is down. See [/rules/14-observability-and-logging.md](../rules/14-observability-and-logging.md).

## Timeouts

Every outbound call (HTTP, DB query, cache, queue, third-party SDK) has an explicit deadline. No call may hang indefinitely.

- Set timeouts inside the adapter that owns the dependency ([/rules/12-library-wrapping-and-adapters.md](../rules/12-library-wrapping-and-adapters.md)); business code never configures the SDK directly.
- Timeout values are named constants in `*.constants.ts`, never inline literals.
- A timeout surfaces as a typed `AppError`, not a raw vendor error.

```ts
// Do — adapter owns the deadline; value is a named constant
@Injectable()
export class PaymentGatewayAdapter {
  constructor(private readonly http: HttpClientPort) {}

  async charge(input: ChargeInput): Promise<ChargeResult> {
    return this.http.post('/charges', input, {
      timeoutMs: PAYMENT_GATEWAY_TIMEOUT_MS,
    });
  }
}
```

```ts
// Don't — no deadline; a slow provider stalls the request thread
async charge(input: ChargeInput): Promise<ChargeResult> {
  return this.sdk.charges.create(input); // hangs forever on a network stall
}
```

> Project records: per-dependency timeout budgets and the end-to-end request deadline.

## Retries + backoff

Retry only **idempotent**, **transient** failures (timeouts, `503`, connection resets). Never retry on `4xx` validation or business-rule rejections — they will fail identically.

- Bounded attempts, exponential backoff, and **jitter** to avoid synchronized retry storms.
- Retry lives in the adapter, not scattered through services.
- Every retry and final give-up is logged with a correlation id.
- Respect total budget: retries must fit inside the caller's deadline.

```ts
// Conceptual policy — concrete values are named constants
const RETRY_POLICY = {
  maxAttempts: ADAPTER_MAX_RETRY_ATTEMPTS,   // e.g. 3
  baseDelayMs: ADAPTER_RETRY_BASE_DELAY_MS,  // e.g. 200
  factor: ADAPTER_RETRY_BACKOFF_FACTOR,      // e.g. 2
  jitter: true,
} as const;
```

Use cases must not parallelize retried calls inside services — `Promise.all|allSettled|any|race` are banned in services by ESLint. Batch fan-out belongs in a use case or an adapter that owns the concurrency policy. See [/rules/03-application-services-and-use-cases.md](../rules/03-application-services-and-use-cases.md).

> Project records: which integrations are safe to retry, their attempt/backoff numbers, and where retries are deliberately disabled.

## Idempotency

Any operation that can be retried — by a client, a queue redelivery, or our own retry policy — must be **safe to run twice**.

- Mutating endpoints that clients may retry accept an idempotency key (header → DTO → use case); the use case persists the key with the result and replays the stored outcome on a duplicate.
- Event/job handlers dedupe on a stable event/message id so at-least-once delivery does not double-apply effects.
- Prefer naturally idempotent writes (upsert by business key, conditional update by version/state) over blind inserts.
- Idempotency state lives behind the repository ([/rules/04-repositories-and-persistence.md](../rules/04-repositories-and-persistence.md)); guarantees that span entities run inside the use-case transaction.

```ts
// Do — replay the prior result on a duplicate key
async execute(input: CreateOrderInput): Promise<OrderResult> {
  const existing = await this.idempotencyRepo.find(input.idempotencyKey);
  if (existing) return existing.result;
  return this.runInTransaction(input);
}
```

> Project records: idempotency key strategy (header name, TTL, storage), and which operations require it.

## Graceful shutdown

On `SIGTERM`/`SIGINT`, stop accepting new work, let in-flight requests drain, then release resources in reverse dependency order. Use Nest lifecycle hooks — never ad-hoc `process.on` handlers in feature code.

- Enable shutdown hooks in bootstrap (`app.enableShutdownHooks()`).
- Implement `OnModuleDestroy` / `beforeApplicationShutdown` on resources that hold connections, intervals, or buffers.
- Each disconnect is wrapped so one failure cannot abort the rest — log and continue.
- Clear all scheduled intervals/timers on shutdown so the process can exit cleanly.

```ts
// Do — isolated disconnect; one failure never blocks the others
@Injectable()
export class CacheAdapter implements OnModuleDestroy {
  constructor(private readonly logger: AppLogger) {}

  async onModuleDestroy(): Promise<void> {
    try {
      await this.client.quit();
      this.logger.info('cache disconnected');
    } catch (error) {
      this.logger.warn('cache disconnect failed', { error });
    }
  }
}
```

Set the platform termination grace period longer than the in-flight drain budget so the orchestrator does not `SIGKILL` mid-drain.

> Project records: drain timeout, shutdown order, and the platform grace period.

## Fire-and-forget safety

Side effects that are not part of the caller's success contract (notifications, broadcasts, audit writes, cache warming) **must catch their own errors**. A delivery failure can never block, fail, or roll back the primary workflow.

- Emit a domain event from the use case **after** the transaction commits; subscribed handlers do the side effect ([/rules/19-async-events-and-jobs.md](../rules/19-async-events-and-jobs.md)).
- Every handler wraps its work in try/catch and logs failures via the logger adapter — never `console.*`.
- A throw inside a handler must not propagate into the publisher and corrupt the committed state-transition's success path.
- No truly detached promises: every async operation is awaited, joined, or handed to an event handler that owns its own error path. Floating promises stay banned at the lint level — handlers are a safety net, not a license.

```ts
// Do — handler owns its failure; the workflow already succeeded
@Injectable()
export class OrderConfirmedNotificationHandler {
  constructor(
    private readonly notifications: NotificationAdapter,
    private readonly logger: AppLogger,
  ) {}

  @OnEvent(DomainEvent.ORDER_CONFIRMED)
  async handle(event: OrderConfirmedEvent): Promise<void> {
    try {
      await this.notifications.send(event.payload);
    } catch (error) {
      this.logger.error('order confirmation notification failed', {
        orderId: event.payload.orderId,
        error,
      });
    }
  }
}
```

```ts
// Don't — unhandled rejection can fault the committed transaction's caller
@OnEvent(DomainEvent.ORDER_CONFIRMED)
handle(event: OrderConfirmedEvent): void {
  void this.notifications.send(event.payload); // throw escapes, error is lost
}
```

> Project records: which events exist, their handlers, and the test that asserts the subscriber count.

## Scheduled / background work

In-process schedules (e.g. expiry sweeps, session cleanup) are non-critical and self-healing.

- Use `@nestjs/schedule` (`@Cron`/`@Interval`) — never raw `setInterval` in feature code.
- Each tick wraps its own work in try/catch; one failed run logs and the schedule continues.
- Skip a tick cleanly when a required dependency is not ready instead of throwing.
- Intervals/cron jobs are registered by a module and torn down on shutdown.
- For multi-instance deployments, guard schedules with a distributed lock or run them as a single dedicated worker so the same sweep does not run N times.

> Project records: each scheduled job, its cadence (as a named constant), and its single-runner/locking strategy.

## Long-running & async workflows

No endless loading and no silent fire-and-forget. Every async workflow has terminal states — **success, failure, timeout, cancellation** — and operator visibility into which state it reached.

- Persist workflow status transitions; expose them so a client polling or a streaming consumer can stop.
- Queue consumers define max attempts and a dead-letter (or equivalent) destination; poison messages are isolated, never reprocessed forever.
- If an async failure affects the user outcome, the user must eventually receive a terminal failure state.

See [/rules/19-async-events-and-jobs.md](../rules/19-async-events-and-jobs.md).

## Anti-patterns to reject in review

- Outbound calls with no timeout.
- Retrying non-idempotent writes, or retrying `4xx` business rejections.
- Retry without bounded attempts, backoff, or jitter.
- Swallowing an error and returning a fake success (silent failure).
- A side-effect handler that can throw into the primary transaction.
- `process.exit()` as error handling instead of degrading the affected feature.
- Schedules that crash the process on a single failed tick, or run N times across N instances.
- Reporting readiness while a critical dependency is down.

## Related

[/rules/10-reliability-and-durability.md](../rules/10-reliability-and-durability.md) · [/rules/19-async-events-and-jobs.md](../rules/19-async-events-and-jobs.md) · [/rules/12-library-wrapping-and-adapters.md](../rules/12-library-wrapping-and-adapters.md) · [/skills/reliability-review.md](../skills/reliability-review.md) · [/skills/add-event-handler.md](../skills/add-event-handler.md) · [/memory/event-notification-decisions.md](./event-notification-decisions.md) · [/memory/library-boundaries.md](./library-boundaries.md) · [/memory/known-pitfalls.md](./known-pitfalls.md)
