# Observability Decisions

> Durable, abstract record of how a NestJS backend in this workspace stays diagnosable: the logger adapter, structured logs, correlation ids, redaction, and metrics. This is the _why_ and _what-we-chose_; the enforced _how_ lives in [/rules/14-observability-and-logging.md](../rules/14-observability-and-logging.md) and the cross-cutting contract in [/context/architecture-map.md](../context/architecture-map.md) §5.

These are standing conventions, not suggestions. Each decision includes its rationale. Where a concrete backend must pin a vendor, level, header, or field, a **Project records:** line marks the spot — fill it in for your project; never hardcode it into the rules.

---

## Decision 1 — One logger adapter; never `console.*`

**Decision.** All logging flows through a single adapter exposed by `@core/logger`. Layer code injects it via constructor DI (`private readonly logger: AppLogger`) and never imports a logging library directly. `console.*` is banned in `src/` (ESLint `no-console: error`); the adapter is the only sanctioned sink.

**Rationale.** The engine (Nest `Logger`, pino, winston are interchangeable EXAMPLES) is a swappable detail behind our interface — see [/rules/12-library-wrapping-and-adapters.md](../rules/12-library-wrapping-and-adapters.md). Centralizing the sink gives us one place to configure levels, redaction, and transports, and one place to test. `console.*` bypasses redaction and structure and is unsearchable in production.

```ts
// Do — inject the adapter; constant message + structured metadata
@Injectable()
export class InvoiceService {
  constructor(private readonly logger: AppLogger) {}

  async finalize(invoiceId: string): Promise<void> {
    this.logger.info('invoice.finalized', { invoiceId });
  }
}
```

```ts
// Don't — banned sink, leaks the whole entity, unstructured
console.log('invoice finalized', invoice);
this.logger.info(`invoice ${JSON.stringify(invoice)} finalized`);
```

> **Project records:** which engine the adapter wraps, the transport/sink (stdout, file, collector), and the adapter's module path if it differs from `@core/logger`.

---

## Decision 2 — Structured logs: constant message, data in metadata

**Decision.** The first argument is a **stable dotted event name** (`invoice.finalized`, `payment.captured`); all variable data goes in the second argument, a structured metadata object. We never interpolate objects, entities, or SQL into the message string.

**Rationale.** Stable event names group cleanly and make logs queryable across deploys; structured fields are filterable and aggregatable. Interpolation produces unsearchable strings and trips `restrict-template-expressions` / `no-base-to-string`. Log **identifiers** (`invoiceId`, `userId`), not payloads or whole entities.

| Layer              | Logs                                                                                        | Level                      |
| ------------------ | ------------------------------------------------------------------------------------------- | -------------------------- |
| Controller         | nothing manual — the logging interceptor records method/path/status/duration                | `info`                     |
| Use case / Service | each side effect, branch outcome, and `catch`                                               | `info` / `warn` / `error`  |
| Domain             | pure, generally silent                                                                      | —                          |
| Repository         | entry / not-found                                                                           | `debug`                    |
| Adapter            | outbound start (`debug`), success + `durationMs` (`info`), failure + `durationMs` (`error`) | `debug` / `info` / `error` |

**Level is the alert signal:** `error` in every `catch` before rethrow/fallback; `warn` for degraded paths, fallbacks, and **security events** (failed auth, permission denied); `info` for side-effecting success; `debug` for entry/inspection (off in production). No empty `catch {}` — if you truly ignore, log `debug` with the reason.

> **Project records:** the production log level, the event-name namespaces in use, and any business-critical events that must always be present (e.g. mutation success, money movement).

---

## Decision 3 — Audit trail is separate from app logs

**Decision.** Privileged, state-changing actions (status transitions, role/permission changes, ownership/tenant changes, admin overrides) ALSO write an **audit entry** — who did what to which entity — using **enum** actor/action/entity values, never raw strings. Audit writes are wired through the state-machine transition, not scattered in controllers, and are fire-and-forget: a failed audit insert logs `warn` and never blocks the business flow.

**Rationale.** App logs answer "what happened"; the audit trail answers "who is accountable" and is a compliance and forensics artifact with a different retention and query profile. Enum values keep it stable and reviewable (rules 8/9). Non-blocking writes honor the fail-safe side-effect rule — see [/memory/reliability-patterns.md](./reliability-patterns.md) and [/rules/10-reliability-and-durability.md](../rules/10-reliability-and-durability.md). Audit queries stay paginated and field-whitelisted.

> **Project records:** which actions are auditable, where audit entries are stored, and their retention period.

---

## Decision 4 — One correlation id, threaded everywhere

**Decision.** A single correlation id is derived once at the edge by an interceptor — read from the incoming trace header or generated as a UUID — and threaded through every log line, audit entry, outbound call (forwarded by the HTTP adapter), and event/job payload. One scheme, one header name (a constant), never a second id.

**Rationale.** A request touches many layers and may fan out to other services; a shared id reconstructs the full trail end to end. The id is for **tracing only** — never use it for authorization; identity comes from the verified token (see [/memory/security-decisions.md](./security-decisions.md) and [/rules/07-security-authn-authz.md](../rules/07-security-authn-authz.md)). Streaming/SSE routes are excluded from the response interceptor to avoid "headers already sent".

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

> **Project records:** the canonical header name (e.g. `x-correlation-id` / `x-request-id`) and whether ids are propagated to downstream services and message queues.

---

## Decision 5 — Redact secrets and PII before they reach the logger

**Decision.** A single shared redaction set is the source of truth; the adapter also configures engine-level redaction paths as defense-in-depth. We **never** log passwords, OTPs, tokens (access/refresh/JWT), API keys, client secrets, `authorization`/`cookie` headers, full card data, raw national identifiers, whole request bodies, whole entities, SQL strings, or driver stacks. Useful identifiers are **masked, not dropped** (mask the address, hash a fingerprint, keep the last 4 digits).

**Rationale.** Request input is hostile and entities carry secrets; a leaked log line is a breach with the same blast radius as a leaked response. Two layers (shared set + engine config) mean a missed call site is still caught. When a new sensitive field appears, extend **both** in the same change.

```ts
// Centralize once — do not invent a second, weaker list
export const REDACTED_KEYS = [
  'password',
  'newPassword',
  'currentPassword',
  'confirmPassword',
  'otp',
  'token',
  'accessToken',
  'refreshToken',
  'apiKey',
  'secret',
  'authorization',
  'cookie',
] as const;
```

The global exception filter sanitizes outbound errors — clients receive a `messageKey` + safe shape; full detail and stacks are logged server-side only (see [/rules/18-error-handling-and-exceptions.md](../rules/18-error-handling-and-exceptions.md)). Ingested telemetry (client log batches) is bounded and sanitized: cap depth/size/length, strip operator-injection keys, escape user-controlled regex, reject stale/future timestamps.

> **Project records:** the project-specific sensitive fields beyond the shared set (domain identifiers, regulated data classes) and the masking strategy for each.

---

## Decision 6 — Metrics behind an adapter; alerts ship with the change

**Decision.** Logs explain one request; metrics tell us whether the system is healthy — both ship with material changes. The metrics client is wrapped behind `@core/metrics`; business code calls our interface, not the vendor. We emit a metric for every material failure mode and SLO-relevant path: request rate/latency/error-rate per route, dependency latency + failure count, queue depth + dead-letter count, job success/failure/duration, retry/fallback counts, and business-critical counters. Every alert names an owner and links a runbook; critical changes ship their alerts **before** release.

**Rationale.** An alert with no owner and no runbook is noise; observability for a material release risk must exist at GO, not after the first incident. Wrapping the client keeps the vendor (StatsD / Prometheus / OTel are interchangeable EXAMPLES) swappable and consistently configured (rule 32). Dashboards must answer "is this change healthy, degraded, or failing?" at a glance.

> **Project records:** the metrics backend and adapter path, the defined SLIs/SLOs, the dashboard locations, and the alert-to-runbook map. If metrics/tracing are not yet implemented, record that gap here and document any new strategy **before** adding a dependency (rule 41).

---

## Decision 7 — The log/metric trail is a verification target

**Decision.** A passing assertion is not proof the system is observable. After tests (especially integration/e2e) we confirm the expected `info` lines exist at the correct level, every exercised `catch` produced an `error` log, the correlation id is present and identical across a request, and no secret/PII/stack leaked (grep the captured output). After deploy we tail logs on the new path, confirm levels and correlation id, verify audit + persisted record for mutations and published-and-consumed for events, and confirm dashboards show the change as healthy.

**Rationale.** Silent swallows, wrong levels, and missing redaction only surface under real failure — which is the worst time to discover them. Verifying the trail closes the loop between "the test passed" and "we can diagnose this in production". Keep the evidence with the change: which logs/metrics were checked, on which environment, at which commit.

> **Project records:** where verification evidence is stored and the hypercare log/metric checks run after each release.

---

## Cross-links

- Enforced rules: [/rules/14-observability-and-logging.md](../rules/14-observability-and-logging.md) · [/rules/18-error-handling-and-exceptions.md](../rules/18-error-handling-and-exceptions.md) · [/rules/10-reliability-and-durability.md](../rules/10-reliability-and-durability.md) · [/rules/17-configuration-and-environment.md](../rules/17-configuration-and-environment.md) · [/rules/12-library-wrapping-and-adapters.md](../rules/12-library-wrapping-and-adapters.md)
- Sibling memory: [/memory/reliability-patterns.md](./reliability-patterns.md) · [/memory/security-decisions.md](./security-decisions.md) · [/memory/library-boundaries.md](./library-boundaries.md) · [/memory/known-pitfalls.md](./known-pitfalls.md)
- Skills & agents: [/skills/observability-review.md](../skills/observability-review.md) · [/agents/observability-reviewer.md](../agents/observability-reviewer.md)
- Architecture: [/context/architecture-map.md](../context/architecture-map.md)
