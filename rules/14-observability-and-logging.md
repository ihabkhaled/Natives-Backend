# 14 — Observability & Logging

> How a backend in this workspace stays diagnosable in production: the logger adapter only (never `console.*`), structured logs at correct levels, a correlation id flowing through every request, metrics on material failure modes, redaction of secrets/PII, and verifying the log trail after tests and deploys. This file implements the cross-cutting logging contract in [/context/architecture-map.md](../context/architecture-map.md) §5 and rules 28/40 in [00-non-negotiable-rules.md](./00-non-negotiable-rules.md).

Observability is **part of the change**, not an afterthought. A method with no log statements, a critical path with no metric, or a release with no post-deploy log check is incomplete work.

---

## 1. The logger adapter — never `console.*`

All logging goes through the logger adapter exposed by `@core/logger`. It wraps the underlying engine (Nest's `Logger`, pino, or winston are interchangeable EXAMPLES behind the adapter — see [12-library-wrapping-and-adapters.md](./12-library-wrapping-and-adapters.md)) so the rest of the codebase depends on our interface, not the vendor.

```ts
// Do — inject the adapter, log a constant message + structured metadata
@Injectable()
export class OrderService {
  constructor(private readonly logger: AppLogger) {}

  async publish(orderId: string): Promise<void> {
    this.logger.info('order.published', { orderId });
  }
}
```

```ts
// Don't
console.log('order published', order);          // banned: no-console + leaks the whole entity
this.logger.info(`order ${JSON.stringify(order)} published`); // never stringify into the message
```

### Rules

1. **No `console.*`** anywhere in `src/` outside the logger adapter itself. ESLint `no-console` is `error`; the adapter is the single sanctioned sink (rule 28).
2. **The message is a constant string; data goes in the structured metadata object** (second arg). Keeps logs queryable and avoids `restrict-template-expressions` / `no-base-to-string` violations. Use a stable dotted event name (`order.published`, `payment.captured`) so logs group cleanly.
3. **Inject the logger** via constructor DI (`private readonly logger: AppLogger`). The only permitted file-local literal is a `LOG_PREFIX`/context label; every other constant lives in `*.constants.ts` (rule 13).
4. **Never log whole entities, raw bodies, or `unknown`.** Log identifiers (`orderId`, `userId`), not payloads. Narrow `catch` first (see §5).
5. **Level comes from typed config** (`logging.level`), read via `@nestjs/config` — never `process.env.LOG_LEVEL` directly (rule 27, [17-configuration-and-environment.md](./17-configuration-and-environment.md)).

---

## 2. Log levels — pick the right severity

The level **is** the alert signal. Wrong levels either page on-call for nothing or hide real failures.

| Level | Use for | Example |
| --- | --- | --- |
| `error` | Every `catch` before rethrow/fallback; unrecoverable failure (dependency down, write failed) | `order.publish.failed` |
| `warn` | Recoverable/degraded path: retry, fallback, cache miss, rate-limit hit, partial success; **security events** (failed auth, permission denied) | `cache.unavailable.fallback` |
| `info` | Side-effecting success: DB write, outbound call, event published, job completed | `order.published` |
| `debug` | Method entry, non-PII inputs, internal-state inspection (off in production) | `order.findById.entry` |

| Scenario | Correct | Wrong |
| --- | --- | --- |
| Successful mutation | `info` | `error` / `warn` |
| Fallback used / cache miss | `warn` | `error` |
| Dependency down / write failed | `error` | `warn` / `info` |
| Failed login / forbidden | `warn` | `info` |
| Debug input dump | `debug` | `info` |

> **Every `catch` logs at `error` before it rethrows or falls back. There are no empty `catch {}` blocks** — if you truly mean "ignore", log `debug` with the reason. Side-effecting operations log `info`; pure entry inspection logs `debug`.

---

## 3. Correlation ids via an interceptor

A single correlation id must flow through one request so its logs join up across layers and services. Derive it once at the edge and attach it to every log line.

```ts
// core/interceptors/correlation.interceptor.ts
@Injectable()
export class CorrelationInterceptor implements NestInterceptor {
  constructor(private readonly logger: AppLogger) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<RequestWithCorrelation>();
    const correlationId = req.headers[CORRELATION_HEADER] ?? randomUUID();
    req.correlationId = correlationId;
    return this.logger.runWithContext({ correlationId }, () => next.handle());
  }
}
```

### Rules

1. **One scheme, one header.** Read an incoming `x-correlation-id` (or `x-request-id`) header or generate a UUID; never invent a second id. The header name is a constant in `*.constants.ts`.
2. **Never trust the correlation id for authorization** — it is for tracing only. Identity comes from the verified token (rule 33, [07-security-authn-authz.md](./07-security-authn-authz.md)).
3. **Thread it everywhere:** request-scoped context → every app log → audit metadata → outbound calls (forward the header in your HTTP adapter) → events/jobs (carry it in the payload). When a downstream service logs the same id, the trail reconstructs end to end.
4. **Exclude streaming endpoints from auto-logging** to avoid "headers already sent" errors; mark long-lived/SSE responses with a skip decorator so the response interceptor does not touch them.

---

## 4. What to log at each layer

Each layer has a distinct, minimal logging responsibility. Do not duplicate the same event at three layers.

| Layer | Logs | Level | Does NOT log |
| --- | --- | --- | --- |
| Controller | Nothing manual — the logging interceptor records method, path, status, duration | `info` (interceptor) | Bodies, business detail |
| Use case / Service | Each side effect (write, outbound call, event emitted), each branch outcome, each `catch` | `info` / `warn` / `error` | Raw entities, secrets |
| Domain | Pure — generally silent; a rejected invariant may `warn` via the caller | — | I/O of any kind |
| Repository | Entry at `debug`; "not found" at `debug`; never throws silently | `debug` | Business policy, full result sets |
| Adapter | Outbound call start (`debug`), success with status + `durationMs` (`info`), failure with `durationMs` (`error`) | `debug` / `info` / `error` | Vendor secrets, full payloads |

```ts
// Adapter: log timing + outcome, never the payload or credentials
async send(message: OutboundMessage): Promise<DeliveryResult> {
  const startedAt = Date.now();
  this.logger.debug('email.send.start', { to: maskEmail(message.to) });
  try {
    const result = await this.client.deliver(message);
    this.logger.info('email.send.ok', { provider: this.name, durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    this.logger.error('email.send.failed', { provider: this.name, durationMs: Date.now() - startedAt, ...toLogError(error) });
    throw error;
  }
}
```

> **Audit vs. app logs.** Privileged/state-changing actions (status transitions, role/permission changes, ownership/tenant changes, admin overrides) ALSO record an **audit entry** — who did what to which entity — using **enum** actor/action/entity values, never raw strings (rules 8/9). Audit writes are fire-and-forget and non-blocking: a failed audit insert logs a `warn` and never breaks the business flow (rule 38, [10-reliability-and-durability.md](./10-reliability-and-durability.md)). Wire audit through the state-machine transition, not scattered in controllers, and keep audit queries paginated + field-whitelisted (rule 37).

---

## 5. Redaction — never log secrets or PII

Frontend and request input are hostile; entities carry secrets. Redact **before** the value reaches the logger.

**Never log:** passwords, OTPs, JWTs, access/refresh tokens, API keys, client secrets, `authorization`/`cookie` headers, full card data, raw national identifiers, whole request bodies, whole entities, SQL strings, or driver stacks sent to clients.

```ts
// Centralize the redaction set once — do not invent a second, weaker list
export const REDACTED_KEYS = [
  'password', 'newPassword', 'currentPassword', 'confirmPassword',
  'otp', 'token', 'accessToken', 'refreshToken', 'apiKey', 'secret',
  'authorization', 'cookie',
] as const;

export function redact(input: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(input).map(([k, v]) =>
      REDACTED_KEYS.includes(k as RedactedKey) ? [k, '[REDACTED]'] : [k, v],
    ),
  );
}
```

```ts
// Narrow unknown errors before logging (useUnknownInCatchVariables)
export function toLogError(error: unknown): { error: string } {
  return { error: error instanceof Error ? error.message : String(error) };
}
```

### Rules

1. **Configure engine-level redaction too** as defense-in-depth (the adapter sets redaction paths for `*.password`, `*.token`, `*.apiKey`, `*.secret`, `*.authorization`, headers). If a new sensitive field is introduced, extend both the shared set above and the adapter config in the same change.
2. **The exception filter sanitizes outbound errors** — clients get a `messageKey` + safe shape; full detail (and stack) is logged server-side only. Never leak stacks/SQL/secrets across the boundary (rule 36, [18-error-handling-and-exceptions.md](./18-error-handling-and-exceptions.md)).
3. **Mask, don't drop, useful identifiers** — log `maskEmail(to)`, a hashed fingerprint, or the last 4 digits, not the raw value, when an operator needs to correlate.
4. **Bound and sanitize ingested telemetry** (client log batches): cap depth/size/length, strip operator-injection keys, escape any user-controlled regex, reject stale/future timestamps. Never store hostile input raw (rule 37, [08-database-and-injection-safety.md](./08-database-and-injection-safety.md)).

---

## 6. Metrics, dashboards & alerts

Logs explain a single request; metrics tell you whether the system is healthy. Both ship with material changes.

- **Emit a metric for every material failure mode and SLO-relevant path:** request rate/latency/error-rate per route, dependency call latency + failure count, queue depth + dead-letter count, job success/failure/duration, retry/fallback counts, and any business-critical counter (e.g. payments captured/declined).
- **Wrap the metrics client behind an adapter** (`@core/metrics` over StatsD/Prometheus/OTel — interchangeable EXAMPLES); business code calls our interface, not the vendor (rule 32).
- **Dashboards must answer "is this change healthy, degraded, or failing?"** at a glance: error rate, p95/p99 latency, throughput, dependency health, queue/DLQ depth.
- **Alert on the failure modes you can act on:** error-rate or latency breaching SLO, DLQ growing, dependency down, job-failure spike, auth-failure spike. An alert with no runbook and no owner is noise — every alert names an owner and links a runbook ([10-reliability-and-durability.md](./10-reliability-and-durability.md)).
- **Critical changes ship their alerts before release** — observability for a material release risk must exist at GO, not after the first incident.

---

## 7. Verify the log trail — after tests and after deploy

A passing assertion is not proof the system is observable. Confirm the trail.

**After tests** (especially integration/e2e — [/testing/integration-testing-standard.md](../testing/integration-testing-standard.md)):
- The expected `info` lines for each side effect appear, at the **correct level**.
- Every exercised `catch` produced an `error` log (no silent swallow).
- The correlation id is present and identical across the request's log lines.
- No secret/PII/token/stack leaked into any log line (grep the captured output for redacted patterns).
- Redaction is active — sensitive fields show `[REDACTED]`, not raw values.

**After deploy** (smoke window / hypercare — [/testing/quality-gates.md](../testing/quality-gates.md)):
- Tail the service logs and trigger the new path; confirm the expected lines, levels, and correlation id.
- No unhandled exceptions, no dependency/connection errors, no "headers already sent" on streaming routes.
- For mutations: confirm the audit entry and the persisted record exist; for events: confirm published **and** consumed, and the DLQ is empty.
- Dashboards show the change as healthy (error rate, latency, throughput within expected bands).

> Keep evidence with the change: which logs/metrics were checked, on which environment, at which commit. Logs and audit trail are first-class verification targets — a feature is not verified until its observability trail is confirmed.

---

## Checklist

- [ ] Logger adapter injected from `@core/logger`; **no** `console.*`
- [ ] Constant message string + structured metadata object (no interpolated objects/SQL/entities)
- [ ] Correct level per event (catch=`error`, fallback/security=`warn`, side effect=`info`, entry=`debug`)
- [ ] Every `catch` logs at `error` before rethrow; no empty `catch {}`
- [ ] `catch (error: unknown)` narrowed (`toLogError`) before logging
- [ ] Correlation id derived once via interceptor and threaded through logs, audit, outbound calls, events
- [ ] Layer logging respected (controller via interceptor, service/adapter side effects, repository at `debug`)
- [ ] State changes / privileged actions emit a non-blocking audit entry with **enum** values
- [ ] Secrets/PII redacted via the shared set + adapter config; exception filter sanitizes outbound errors
- [ ] Metrics + alerts for material failure modes; dashboards answer healthy/degraded/failing
- [ ] Log trail verified after tests AND after deploy; evidence recorded

## Related

- [00-non-negotiable-rules.md](./00-non-negotiable-rules.md) · [18-error-handling-and-exceptions.md](./18-error-handling-and-exceptions.md) · [07-security-authn-authz.md](./07-security-authn-authz.md) · [10-reliability-and-durability.md](./10-reliability-and-durability.md) · [17-configuration-and-environment.md](./17-configuration-and-environment.md) · [12-library-wrapping-and-adapters.md](./12-library-wrapping-and-adapters.md) · [19-async-events-and-jobs.md](./19-async-events-and-jobs.md) · [15-review-checklist.md](./15-review-checklist.md)
- [/skills/observability-review.md](../skills/observability-review.md) · [/agents/observability-reviewer.md](../agents/observability-reviewer.md) · [/memory/observability-decisions.md](../memory/observability-decisions.md) · [/context/architecture-map.md](../context/architecture-map.md)
