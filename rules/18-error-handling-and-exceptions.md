# 18 — Error Handling And Exceptions

> Every failure is a **typed `AppError`** carrying a `messageKey`, raised in the layer that detects it and translated **once** at the edge by a global exception filter into a sanitized HTTP body. Full detail is logged server-side; clients never see stacks, SQL, secrets, or vendor internals. This implements the canon in [`00-non-negotiable-rules.md`](./00-non-negotiable-rules.md) (rules 26, 36) and [`/context/architecture-map.md`](../context/architecture-map.md).

## The model in one line

**Throw typed → catch once → log full → return sanitized.** Layers throw `AppError` subclasses; the global filter is the *only* place that produces an HTTP error response.

---

## The `AppError` hierarchy

Defined once in `@core/errors/` (`app-error.ts`). Every subclass is a real domain concept with a fixed HTTP status and a `messageKey` of the form `errors.<feature>.<key>` (see [16-i18n-and-messaging.md](./16-i18n-and-messaging.md)). Never `throw new Error('...')` for a user-facing failure.

| Class | HTTP | Throw when |
| --- | --- | --- |
| `ValidationError` | 400 | A precondition the DTO can't express fails (cross-field, stateful, computed) |
| `UnauthorizedError` | 401 | No identity, or the token is missing/invalid/expired |
| `ForbiddenError` | 403 | Identity present but not allowed — failed RBAC, ownership, or tenant check |
| `NotFoundError` | 404 | A referenced resource does not exist (or is invisible to this caller) |
| `ConflictError` | 409 | Duplicate / unique-constraint / concurrent-edit conflict |
| `StateTransitionError` | 422 | An illegal state-machine move (carries `from`, `attempted`, `allowed[]`) |
| `IntegrationError` | 502 | A wrapped external provider failed (carries the vendor + safe cause) |

```ts
// @core/errors/app-error.ts — the base. NEVER inline a subclass elsewhere (rule 12).
export abstract class AppError extends Error {
  abstract readonly status: number;
  protected constructor(
    message: string,                       // developer-facing, logged, never returned raw
    readonly messageKey: string,           // errors.<feature>.<key> — what the client localizes
    readonly details?: Readonly<ErrorDetails>, // safe, structured, e.g. field violations
    readonly cause?: unknown,              // original error — logged, never serialized to client
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class NotFoundError extends AppError {
  readonly status = 404;
}

export class StateTransitionError extends AppError {
  readonly status = 422;
  constructor(
    message: string,
    messageKey: string,
    readonly from: string,
    readonly attempted: string,
    readonly allowed: readonly string[],
  ) {
    super(message, messageKey, { from, attempted, allowed });
  }
}
```

`ErrorDetails`, `ErrorResponseBody`, and the `messageKey` catalog live in [06-types-enums-constants.md](./06-types-enums-constants.md) territory — `@core/errors/error.types.ts` and `@shared/constants`. No inline shapes (rules 10–16).

---

## When to throw which

Pick by **meaning**, not by convenience. The status follows from the class; you never set a status by hand outside the filter.

```ts
// Do — semantic, typed, carries a messageKey
throw new NotFoundError('Order not found', 'errors.order.notFound');
throw new ForbiddenError('Caller does not own this order', 'errors.order.notOwner');
throw new ConflictError('Phone already registered', 'errors.account.duplicatePhone');
throw new StateTransitionError(
  'Cannot publish a closed order',
  'errors.order.invalidTransition',
  current.status, OrderAction.Publish, allowedActions,
);
```

```ts
// Don't — untyped, leaks intent, unmappable, no messageKey
throw new Error('order not found');                 // ❌ becomes a raw 500
throw new HttpException('forbidden', 403);          // ❌ bypasses the catalog (see mapping rules)
return { error: 'duplicate' };                      // ❌ errors are thrown, never returned
```

Decision shortcuts:

- Can the DTO express it? → it's not an error here; let the `ValidationPipe` reject it ([05-dto-and-validation.md](./05-dto-and-validation.md)).
- Does it exist but the caller can't have it? → `ForbiddenError` (never `NotFoundError` to hide existence *unless* leaking existence is itself a risk — then `NotFoundError` is the deliberate choice; document it).
- Is it a legal value but an illegal *moment*? → `StateTransitionError`, from the domain state machine, not the service.
- Did an outbound call fail inside an adapter? → `IntegrationError`, raised by the adapter ([12-library-wrapping-and-adapters.md](./12-library-wrapping-and-adapters.md)), never the raw SDK error.

### Where each layer throws

| Layer | Throws | Never |
| --- | --- | --- |
| Controller | nothing — lets it bubble | `try/catch`, building error bodies |
| Use case / Service | `ValidationError`, `ForbiddenError`, `NotFoundError`, `ConflictError` (preconditions, ownership) | swallowing errors; setting HTTP status |
| Domain | `StateTransitionError`, `ValidationError` (invariants) | touching HTTP or persistence |
| Repository | nothing for "not found" — **return `null`/`[]`**; let the service decide | translating DB errors itself (it bubbles to the filter) |
| Adapter | `IntegrationError` wrapping the safe cause | leaking vendor error objects upward |

---

## The global exception filter (translate once)

One `@Catch()` filter registered in `bootstrap/` is the **single** place that turns a thrown value into an HTTP response. Controllers carry no `try/catch` for transport concerns ([02-controllers-and-http-transport.md](./02-controllers-and-http-transport.md)).

```ts
// @core/errors/global-exception.filter.ts
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: AppLogger) {} // @core/logger — never console.* (rule 28)

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<FastifyReply>(); // platform-agnostic; adapt to your HTTP driver
    const { status, body, logLevel } = mapToResponse(exception); // pure, in error.mapper.ts

    this.logFull(exception, status, logLevel); // full detail SERVER-SIDE only
    if (res.sent) return;                      // streaming/SSE: headers already sent → emit data event upstream
    res.status(status).send(body);             // sanitized body to the client
  }

  private logFull(exception: unknown, status: number, level: LogLevel): void {
    const cause = exception instanceof AppError ? exception.cause : exception;
    this.logger[level]('request_failed', {
      status,
      name: exception instanceof Error ? exception.name : 'Unknown',
      messageKey: exception instanceof AppError ? exception.messageKey : undefined,
      message: exception instanceof Error ? exception.message : String(exception),
      stack: exception instanceof Error ? exception.stack : undefined, // logged, never returned
      cause,
    });
  }
}
```

### What the client gets (sanitized contract)

A stable, machine-readable shape — defined in `@core/errors/error.types.ts`, returned for **every** error.

```jsonc
{
  "statusCode": 404,
  "messageKey": "errors.order.notFound",   // client localizes this per supported locale
  "message": "Order not found",            // safe default text; clients should prefer messageKey
  "details": null,                          // structured, safe extras only (e.g. field violations)
  "correlationId": "c1a2…",                // ties the client report to the server log line
  "timestamp": "2026-06-28T10:00:00.000Z"
}
```

For DTO validation failures the filter normalizes the pipe's output into the same shape with a `details` array:

```jsonc
{
  "statusCode": 400,
  "messageKey": "errors.validation.failed",
  "details": [
    { "field": "email", "messageKey": "errors.validation.email" },
    { "field": "limit", "messageKey": "errors.validation.maxValue" }
  ],
  "correlationId": "c1a2…",
  "timestamp": "2026-06-28T10:00:00.000Z"
}
```

---

## Mapping: `AppError` ⇄ Nest `HttpException`

`mapToResponse` is a pure function (unit-tested in isolation) that resolves any thrown value to `{ status, body, logLevel }`:

```ts
// @core/errors/error.mapper.ts
export function mapToResponse(exception: unknown): MappedError {
  if (exception instanceof AppError) {
    return { status: exception.status, body: toBody(exception), logLevel: levelFor(exception.status) };
  }
  if (exception instanceof HttpException) {            // framework / guard / pipe origin
    return { status: exception.getStatus(), body: fromHttpException(exception), logLevel: 'warn' };
  }
  return { status: 500, body: INTERNAL_ERROR_BODY, logLevel: 'error' }; // unknown → opaque 500
}
```

Rules:

- **Prefer `AppError`.** Application/domain code throws `AppError`, not `HttpException` — it keeps status, `messageKey`, and details in one typed object and stays framework-agnostic.
- **`HttpException` is for the framework edge only.** Nest guards, pipes, and built-in `404`/`405` produce `HttpException`; the filter maps those into the same body shape so clients see one contract.
- **Map vendor exceptions inside adapters, not the filter.** A driver's unique-constraint error becomes a `ConflictError` in the repository's owning adapter/wrapper — never a special case in the filter (keep the filter generic).
- **`5xx` is opaque.** Anything that isn't an `AppError` or `HttpException` returns a fixed `INTERNAL_ERROR_BODY` (`errors.internal.unexpected`) with **no** detail. The real error lives only in the log, keyed by `correlationId`.
- **`logLevel` follows status:** `4xx` → `warn` (expected, client-driven); `5xx` → `error` (investigate). Never log a 404 at `error` and drown the real alerts.

---

## The error catalog convention

Errors are a versioned contract, not ad-hoc strings. Maintain a single catalog so every key is discoverable, localized, and testable.

- **Source of truth:** `messageKey` constants live with their feature (`model/<feature>.constants.ts`) and are aggregated; the human/operator catalog lives in [`/memory/known-pitfalls.md`](../memory/known-pitfalls.md) and the feature docs.
- **Key shape:** `errors.<feature>.<key>` — lowercase, dot-delimited, stable. Renaming a key is a breaking client change; treat it like an API change.
- **One key per scenario.** Validation, not-found, forbidden, conflict, and each illegal transition get **distinct** keys (rule 26) — never reuse a generic `errors.<feature>.failed`.
- **Every key is localized.** Each new key needs an entry for **each supported locale** before merge; a missing translation is a release blocker ([16-i18n-and-messaging.md](./16-i18n-and-messaging.md)).
- **Retryability is metadata, not status.** If clients need it, expose a `retryable` flag in `details` derived from the class (timeouts/`502`/`503` retryable; `400`/`403`/`404`/`409` not). Don't overload status codes to signal retry.

Illustrative catalog slice (placeholders — a real project records its own):

| messageKey | Class | HTTP | Meaning |
| --- | --- | --- | --- |
| `errors.account.notFound` | `NotFoundError` | 404 | Account id does not resolve |
| `errors.account.duplicateEmail` | `ConflictError` | 409 | Email already registered |
| `errors.order.notOwner` | `ForbiddenError` | 403 | Caller is not the resource owner |
| `errors.order.invalidTransition` | `StateTransitionError` | 422 | Action illegal in current state |
| `errors.email.deliveryFailed` | `IntegrationError` | 502 | Email provider rejected the send |
| `errors.validation.failed` | (pipe) | 400 | DTO validation rejected the request |
| `errors.internal.unexpected` | (unknown) | 500 | Unhandled server error |

---

## Logging full detail — server-side only

- **Log once, at the filter.** Don't log-and-rethrow at every layer; that produces duplicate noise and risks leaking the same secret repeatedly. Throw with context, log at the edge.
- **Attach a `correlationId`** (from the request/logging interceptor) to both the log line and the client body so support can join them without exposing internals ([14-observability-and-logging.md](./14-observability-and-logging.md)).
- **Redact before logging.** Strip tokens, passwords, API keys, PII, and full payloads; log identifiers, not raw bodies (rule 28).
- **Preserve `cause`.** Wrap with the original error in `cause` so the chain is logged, but `cause` is **never** serialized into the response.
- **Never leak** stacks, SQL, file paths, vendor messages, or config to the client (rule 36). If you can't prove a field is safe, it doesn't go in the body.

```ts
// Do — wrap with context, keep the cause, throw a typed error
try {
  await this.paymentAdapter.charge(input);
} catch (cause) {
  throw new IntegrationError('Payment charge failed', 'errors.payment.chargeFailed', { vendor: 'payment-provider' }, cause);
}
```

```ts
// Don't — swallow, or surface the raw vendor error to the client
catch { /* ignored */ }                                  // ❌ silent failure (rule 38)
catch (e) { throw new HttpException(String(e), 502); }    // ❌ leaks vendor text, no messageKey
```

---

## Async, events, and jobs

HTTP errors have a response to attach to; background work does not. For event handlers and jobs, **persist a terminal failure state** and stay fire-and-forget so one failure never blocks the workflow (rules 38, 39; [10-reliability-and-durability.md](./10-reliability-and-durability.md), [19-async-events-and-jobs.md](./19-async-events-and-jobs.md)).

```ts
// Do — catch, record a terminal state, surface it; don't crash the consumer
async handleOrderPlaced(payload: OrderPlacedEvent): Promise<void> {
  try {
    await this.fulfillment.start(payload.orderId);
  } catch (cause) {
    this.logger.error('order_fulfillment_failed', { orderId: payload.orderId, cause });
    await this.orders.markFailed(payload.orderId, 'errors.order.fulfillmentFailed'); // terminal state
  }
}
```

---

## Checklist

- [ ] Every user-facing failure is a typed `AppError` subclass with a `messageKey` of `errors.<feature>.<key>` — no raw `Error`/`HttpException` from app/domain code
- [ ] Class chosen by meaning; status comes from the class, never set by hand outside the filter
- [ ] Repository returns `null`/`[]` for absence; the service decides the error
- [ ] Adapters wrap vendor failures as `IntegrationError`; no SDK error escapes the adapter
- [ ] The global filter is the only producer of error responses; controllers have no transport `try/catch`
- [ ] Response body matches the sanitized contract (`statusCode`, `messageKey`, `correlationId`, `timestamp`) — no stacks/SQL/secrets/vendor text
- [ ] `mapToResponse` handles `AppError`, `HttpException`, and unknown → opaque `500`; `5xx` returns a fixed opaque body
- [ ] Logged once at the filter with full `cause`, `correlationId`, and redacted fields; `4xx`→`warn`, `5xx`→`error`
- [ ] Each new `messageKey` is in the catalog and localized for every supported locale
- [ ] Async/event/job failures record a terminal state and never crash the consumer
- [ ] Tests cover each thrown error → mapped status + `messageKey`; `npm run lint` / `typecheck` / `test:coverage` / `build` green
