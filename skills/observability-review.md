# Skill — Observability Review (Logs, Metrics, Tracing — Useful, Never Leaky)

> Audit a change so its critical paths are diagnosable in production — structured logs at correct levels, metrics on material failure modes, a correlation id threaded end to end — with zero secrets or PII leaking into any sink. Implements the canon: [/context/architecture-map.md](../context/architecture-map.md) and rules 28, 36, 38, 40 of [00-non-negotiable-rules.md](../rules/00-non-negotiable-rules.md).

Run this when a change touches logging, error handling, background jobs, events, an external integration, an audit-worthy state transition, or any path you would need to diagnose at 3am. Verdict is binary: the failure trail reconstructs **and** nothing sensitive escaped.

## Rules this skill enforces

| # | Rule |
| --- | --- |
| 28 | Logger adapter from `@core/logger` only — never `console.*`; redact before logging. |
| 36 | Never leak stacks, secrets, tokens, SQL, or internal errors to clients; the exception filter sanitizes outbound. |
| 38 | Side effects (events, audit, notifications) are fail-safe and observable — a logging/audit failure never blocks the flow. |
| 40 | Observability is part of the change — structured logs + metrics on critical paths; no secret/PII leakage. |
| 8, 13 | Message names, levels, header names, redaction keys are constants — no magic strings, no inline literals. |
| 27 | Log level comes from typed config, not `process.env`. |
| 42 | Tests + docs ship with the change; assert the trail first. |

Detail: [/rules/14-observability-and-logging.md](../rules/14-observability-and-logging.md) · [/rules/18-error-handling-and-exceptions.md](../rules/18-error-handling-and-exceptions.md).

## Inspect first

- `@core/logger` — the adapter API (`info`/`warn`/`error`/`debug`, `runWithContext`); confirm it is the only logging sink.
- `@core/metrics` — the metrics adapter wrapping the vendor (StatsD / Prometheus / OTel are interchangeable EXAMPLES).
- The correlation interceptor and the global exception filter — the two cross-cutting seams every request flows through.
- The shared redaction set (`REDACTED_KEYS`) and the adapter-level redaction config — extend both, never fork a weaker list.
- [/memory/observability-decisions.md](../memory/observability-decisions.md) — the conventions and catalogs you must keep current.

---

## Steps

### 1. Tests FIRST — assert the trail, not just the result

Before reviewing code, pin observability into the test suite so a regression fails CI. Capture the logger sink and assert level, event name, structured fields, the correlation id, and — critically — that **no secret leaked**.

```ts
// order.service.spec.ts — observability is a tested contract
it('logs the side effect at info with safe fields only', async () => {
  await service.publish(orderId);
  expect(logger.info).toHaveBeenCalledWith('order.published', {
    orderId,
    correlationId: expect.any(String),
  });
});

it('logs at error on a caught failure and never leaks the secret', async () => {
  repo.save.mockRejectedValueOnce(new Error('db down'));
  await expect(service.publish(orderId)).rejects.toThrow();
  expect(logger.error).toHaveBeenCalledWith('order.publish.failed', expect.any(Object));
  const logged = JSON.stringify(logger.error.mock.calls);
  expect(logged).not.toContain(rawToken);   // no token, password, or body in any log line
});
```

### 2. Confirm the logger adapter is the only sink

No `console.*` anywhere in `src/` outside the adapter (ESLint `no-console` is `error`). The message is a **constant dotted event name**; data goes in the structured metadata object — never interpolate an object, entity, or SQL string into the message.

```ts
// Do — constant message + structured, redacted metadata
this.logger.info('order.published', { orderId, correlationId });
```

```ts
// Don't
console.log('published', order);                         // banned sink + leaks the whole entity
this.logger.info(`order ${JSON.stringify(order)} done`); // interpolated object; unqueryable; leaks
```

### 3. Check levels — the level IS the alert signal

Walk every new log line and verify the severity. A misclassified level either pages on-call for nothing or hides a real failure.

| Level | Use for |
| --- | --- |
| `error` | Every `catch` before rethrow/fallback; unrecoverable failure (dependency down, write failed) |
| `warn` | Recoverable/degraded path (retry, fallback, cache miss, rate-limit) and security events (failed auth, forbidden) |
| `info` | Side-effecting success (write committed, outbound call, event published, job completed) |
| `debug` | Method/repository entry, non-PII inputs (off in production) |

Every `catch` logs at `error` before it rethrows or falls back. There are **no empty `catch {}`** blocks; if you truly mean "ignore", log `debug` with the reason. Narrow `unknown` first — `catch (error: unknown)` then `toLogError(error)`.

### 4. Verify the correlation id threads end to end

One scheme, one header (read incoming `x-correlation-id`/`x-request-id` or mint a UUID at the edge), derived once in the interceptor and carried through every layer, outbound call, event, and job.

```ts
// core/interceptors/correlation.interceptor.ts — derive once, attach to context
const correlationId = req.headers[CORRELATION_HEADER] ?? randomUUID();
return this.logger.runWithContext({ correlationId }, () => next.handle());
```

Confirm: the same id appears on every log line of one request; outbound adapters forward the header; event/job payloads carry it. The id is for tracing only — **never** use it for authorization (identity comes from the verified token).

### 5. Verify layer-appropriate logging (no duplication)

Each layer logs its own minimal responsibility once — do not record the same event at three layers.

| Layer | Logs | Does NOT log |
| --- | --- | --- |
| Controller | Nothing manual — the interceptor records method/path/status/duration | Bodies, business detail |
| Service / Use case | Each side effect and branch outcome; each `catch` | Raw entities, secrets |
| Domain | Pure — generally silent | I/O of any kind |
| Repository | Entry + "not found" at `debug` | Business policy, full result sets |
| Adapter | Call start (`debug`), success with `durationMs` (`info`), failure with `durationMs` (`error`) | Vendor secrets, full payloads |

```ts
// Adapter — log timing + outcome, never the payload or credentials
const startedAt = Date.now();
try {
  const result = await this.client.deliver(message);
  this.logger.info('email.send.ok', { provider: this.name, durationMs: Date.now() - startedAt });
  return result;
} catch (error: unknown) {
  this.logger.error('email.send.failed', { provider: this.name, durationMs: Date.now() - startedAt, ...toLogError(error) });
  throw error;
}
```

### 6. Redaction — the leak hunt

Grep the diff and the captured test output for sensitive values. **Never log:** passwords, OTPs, JWTs, access/refresh tokens, API keys, client secrets, `authorization`/`cookie` headers, full card/identifier data, whole request bodies, whole entities, SQL strings, or driver stacks.

```ts
// Redact before the value reaches the logger — one shared set, extended in both places
export const REDACTED_KEYS = [
  'password', 'newPassword', 'otp', 'token', 'accessToken', 'refreshToken',
  'apiKey', 'secret', 'authorization', 'cookie',
] as const;
```

Mask, don't drop, useful identifiers (`maskEmail(to)`, last-4 digits, a hashed fingerprint) so operators can still correlate. If a new sensitive field appears, extend the shared set **and** the adapter-level redaction config in the same change.

### 7. Confirm the exception filter sanitizes the boundary

Clients receive a `messageKey` + safe shape; full detail and the stack are logged server-side only. Verify no path returns a raw error, SQL, or stack to the client (rule 36, [/rules/18-error-handling-and-exceptions.md](../rules/18-error-handling-and-exceptions.md)).

### 8. Check metrics, audit, and fail-safe side effects

- **Metrics** ship for every material failure mode and SLO-relevant path (route rate/latency/error-rate, dependency latency + failure count, queue/DLQ depth, job success/failure/duration, retry/fallback counts) via `@core/metrics` — never the vendor SDK directly.
- **Audit:** privileged/state-changing actions (status transitions, role/ownership/tenant changes, admin overrides) record an audit entry with **enum** actor/action/entity values, wired through the state-machine transition.
- **Fail-safe:** the audit write and any fire-and-forget handler catch their own errors — a failed audit insert logs a `warn` and never breaks the business flow (rule 38).
- **Alerts:** critical changes ship their alerts before release; every alert names an owner and links a runbook ([/rules/10-reliability-and-durability.md](../rules/10-reliability-and-durability.md)).

### 9. Verify the trail — after tests AND after deploy

A green assertion is not proof of observability. After integration/e2e runs: the expected `info` lines appear at the correct level, every exercised `catch` produced an `error` log, the correlation id is identical across the request, and no secret/PII shows raw (sensitive fields read `[REDACTED]`). After deploy: tail logs, trigger the new path, confirm lines/levels/correlation id, no unhandled exceptions or "headers already sent", audit + persisted record exist for mutations, and dashboards show the change healthy. Keep evidence with the change — which logs/metrics, which environment, which commit.

### 10. Update the conventions

Record any new event name, redaction key, metric, or alert in [/memory/observability-decisions.md](../memory/observability-decisions.md). An undocumented metric or alert is incomplete work.

---

## Tests FIRST

Write step 1 before reviewing or changing code. Assert the success path emits the right `info` line, the failure path emits `error` with no leaked secret, and the correlation id is present. Critical paths approach 100% coverage; the touched-module floor is 95%.

## Quality gates (all must pass)

```bash
npm run lint          # 0 errors AND 0 warnings — no console.*, no magic strings, no inline declarations
npm run typecheck     # tsgo --noEmit — narrowed catch, no any, no non-null assertion
npm run test          # level + event-name + correlation-id + no-leak assertions
npm run test:coverage # touched-module floor 95%; critical paths near 100%
npm run build         # compiles clean
```

Never bypass Husky with `--no-verify`.

## Pitfalls

- **`console.*` anywhere in `src/`** — banned sink; route everything through `@core/logger` (rule 28).
- **Interpolating an object/entity/SQL into the message** — unqueryable and the top leak vector. Constant message, structured metadata.
- **Logging whole entities or raw bodies** — log identifiers, not payloads. Redact before the value reaches the logger.
- **Wrong level** — `error` for a recoverable fallback pages on-call for nothing; `warn`/`info` for a real failure hides the outage. The level is the alert.
- **Empty `catch {}` or a `catch` that does not log** — a silent swallow is invisible in production; every `catch` logs `error` before rethrow/fallback.
- **Unnarrowed `catch`** — logging a raw `unknown` trips `restrict-template-expressions`/`no-base-to-string`; narrow with `toLogError` first.
- **Correlation id missing in events/jobs/outbound calls** — the trail breaks at the async boundary. Thread it through payloads and forward the header.
- **Using the correlation id for authz** — it is client-supplied and trace-only; identity comes from the verified token (rule 33).
- **Audit write that can throw** — a failed audit insert must not break the business flow; it is fail-safe and logs a `warn` (rule 38).
- **Stack/SQL/secret reaching the client** — the exception filter must sanitize; full detail is server-side only (rule 36).
- **Forking a second, weaker redaction list** — extend the shared set and the adapter config together; one source of truth.
- **No metric/alert on a new failure mode** — observability for a material release risk must exist at GO, not after the first incident (rule 40).
- **Vendor metrics/logging SDK imported in business code** — wrap it behind `@core/metrics` / `@core/logger`; business code calls our interface (rule 32).

## Related

[/rules/14-observability-and-logging.md](../rules/14-observability-and-logging.md) · [/rules/18-error-handling-and-exceptions.md](../rules/18-error-handling-and-exceptions.md) · [/rules/10-reliability-and-durability.md](../rules/10-reliability-and-durability.md) · [/rules/12-library-wrapping-and-adapters.md](../rules/12-library-wrapping-and-adapters.md) · [/skills/reliability-review.md](./reliability-review.md) · [/skills/security-review.md](./security-review.md) · [/skills/add-event-handler.md](./add-event-handler.md) · [/agents/observability-reviewer.md](../agents/observability-reviewer.md) · [/memory/observability-decisions.md](../memory/observability-decisions.md)
