# Create a Typed Error

> Add (or normalize) a user-facing failure as a typed `AppError` with a stable `messageKey`, wire it through the global exception filter, and prove it with tests. Implements the canon in [00-non-negotiable-rules.md](../rules/00-non-negotiable-rules.md) (rules 26, 36), [18-error-handling-and-exceptions.md](../rules/18-error-handling-and-exceptions.md), and [16-i18n-and-messaging.md](../rules/16-i18n-and-messaging.md).

## Rules this skill enforces

- **Every user-facing failure is a typed `AppError`** with `messageKey` = `errors.<feature>.<key>` (rule 26). Never `throw new Error(...)` or `new HttpException(...)` from app/domain code.
- **Pick the class by meaning;** the HTTP status comes from the class — never set by hand outside the filter ([18](../rules/18-error-handling-and-exceptions.md)).
- **Keys are named constants,** not inline literals, owned by the feature (`model/<feature>.constants.ts`) — rules 8, 13.
- **Translate once at the edge:** the global filter is the only producer of error responses; it returns a sanitized body and logs full detail server-side (rule 36).
- **One distinct key per scenario,** localized for **every supported locale** before merge ([16](../rules/16-i18n-and-messaging.md)).
- **Tests first,** coverage floor 95% — each throw path → mapped status + `messageKey` (rule 42, [11](../rules/11-testing-and-coverage.md)).

## Decide first: new key, new class, or both?

| Situation                                                                          | Action                                                                                           |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Scenario fits an existing `AppError` subclass (not-found, forbidden, conflict, …)  | Add **only a new `messageKey`** + throw it                                                       |
| A genuinely new failure shape with extra structured data (e.g. illegal transition) | Add a **new subclass** in `@core/errors/` **and** a key                                          |
| Vendor/SDK call failed inside an adapter                                           | Wrap as `IntegrationError` in the **adapter**, never the filter                                  |
| The DTO can already express the precondition                                       | Not an error here — let the `ValidationPipe` reject it ([05](../rules/05-dto-and-validation.md)) |

Existing classes: `ValidationError` 400 · `UnauthorizedError` 401 · `ForbiddenError` 403 · `NotFoundError` 404 · `ConflictError` 409 · `StateTransitionError` 422 · `IntegrationError` 502. Reuse before inventing.

---

## Tests FIRST

Before touching production code, add/adjust tests that fail for the right reason:

- A **unit test** on the throwing service/domain method asserting the exact `AppError` subclass **and** its `messageKey` constant.
- A **mapper unit test** (`error.mapper.spec.ts`) asserting the new class/key → `{ status, body.messageKey }`.
- An **e2e/integration test** (supertest) asserting the route returns the sanitized contract: correct `statusCode`, `messageKey`, a `correlationId`, **no** stack/SQL/secret.

```ts
// <feature>.service.spec.ts — Do: assert the contract, not the prose
it('throws NotFoundError with the feature key when the resource is absent', async () => {
  repo.findById.mockResolvedValue(null);
  await expect(service.getById(missingId)).rejects.toMatchObject({
    name: 'NotFoundError',
    messageKey: FEATURE_MESSAGE_KEYS.NOT_FOUND,
  });
});
```

---

## Steps

### 1. Add the `messageKey` constant (feature-owned, never inline)

```ts
// model/<feature>.constants.ts — keys are constants, owned by the feature
export const FEATURE_MESSAGE_KEYS = {
  NOT_FOUND: 'errors.<feature>.notFound',
  FORBIDDEN_NOT_OWNER: 'errors.<feature>.forbiddenNotOwner',
  ALREADY_FINALIZED: 'errors.<feature>.alreadyFinalized',
} as const;
```

Search for the existing constants file before creating one; extend, don't duplicate (rule 13). The `<feature>` segment must match a real folder under `src/modules/`.

### 2. (Only if needed) add a new `AppError` subclass

Subclass `AppError` once in `@core/errors/`. Give it a fixed `status` and carry only **safe, structured** extras in `details`. Never inline a subclass in a service.

```ts
// @core/errors/quota-exceeded.error.ts — new class only when extra structure is needed
export class QuotaExceededError extends AppError {
  readonly status = 429;
  constructor(
    messageKey: string,
    readonly limit: number,
    readonly used: number,
    cause?: unknown,
  ) {
    super('Quota exceeded', messageKey, { limit, used }, cause);
  }
}
```

Export it from the `@core/errors` barrel. `details`/`ErrorResponseBody` shapes live in `error.types.ts` — no inline types (rules 10–16).

### 3. Throw it in the layer that detects the failure

Throw from the use case/service (preconditions, ownership), the domain (invariants, transitions), or the adapter (integration). Controllers never `try/catch` ([02](../rules/02-controllers-and-http-transport.md)); repositories return `null`/`[]` and let the service decide.

```ts
// application/<feature>.service.ts — Do: typed, semantic, keyed
async getOwnedById(id: string, actor: AuthIdentity): Promise<FeatureEntity> {
  const entity = await this.repository.findById(id); // repo returns null, doesn't throw
  if (entity === null) throw new NotFoundError('Resource not found', FEATURE_MESSAGE_KEYS.NOT_FOUND);
  if (entity.ownerId !== actor.id) {
    throw new ForbiddenError('Caller is not the owner', FEATURE_MESSAGE_KEYS.FORBIDDEN_NOT_OWNER);
  }
  return entity;
}
```

```ts
// Don't — untyped, unmappable, leaks intent, no messageKey
throw new Error('not found'); // ❌ becomes a raw 500
throw new HttpException('forbidden', 403); // ❌ bypasses the catalog
return { error: 'duplicate' }; // ❌ errors are thrown, never returned
```

For wrapped vendor failures, keep the cause and stay typed:

```ts
// adapters/<vendor>.adapter.ts — Do: wrap once, preserve cause, never leak SDK text
try {
  await this.client.send(payload);
} catch (cause) {
  throw new IntegrationError(
    'Provider rejected the send',
    FEATURE_MESSAGE_KEYS.DELIVERY_FAILED,
    { vendor: '<provider>' },
    cause,
  );
}
```

### 4. Map it in the exception filter (only for a NEW class)

`mapToResponse` already handles every `AppError` generically via `exception.status`, so a **new key on an existing class needs no filter change**. Touch the mapper only when you added a new subclass — and only if it needs non-default `logLevel` or body handling.

```ts
// @core/errors/error.mapper.ts — pure, unit-tested; AppError is handled generically
export function mapToResponse(exception: unknown): MappedError {
  if (exception instanceof AppError) {
    return {
      status: exception.status,
      body: toBody(exception),
      logLevel: levelFor(exception.status),
    };
  }
  if (exception instanceof HttpException) {
    return {
      status: exception.getStatus(),
      body: fromHttpException(exception),
      logLevel: 'warn',
    };
  }
  return { status: 500, body: INTERNAL_ERROR_BODY, logLevel: 'error' }; // unknown → opaque 500
}
```

Map vendor exceptions inside adapters, not the filter — keep the filter generic. The client always receives the same sanitized shape:

```jsonc
{
  "statusCode": 404,
  "messageKey": "errors.<feature>.notFound",
  "details": null,
  "correlationId": "…",
  "timestamp": "…",
}
```

### 5. Localize the key in every supported locale

Add the `messageKey` to **each** supported client bundle in the same change. A key translated in some locales but not others is an incomplete change and a release blocker ([16](../rules/16-i18n-and-messaging.md), [add-i18n-message-key.md](./add-i18n-message-key.md)). Keys are append-mostly: renaming one is a breaking client change.

### 6. Run the gate and make tests green

Confirm the route returns the sanitized body, the right status, and the new key — with no stack/SQL/secret leakage. Check `4xx` logs at `warn`, `5xx` at `error`.

---

## Quality gate

```bash
npm run lint          # 0 errors AND 0 warnings — no eslint-disable
npm run typecheck     # tsgo --noEmit — strict, no any / no !
npm run test          # unit + integration green
npm run test:coverage # ≥95% on touched files; critical paths near 100%
npm run build         # compiles clean
```

Husky runs these for you (pre-commit: lint-staged + typecheck; commit-msg: commitlint; pre-push: test:coverage + build). Never bypass with `--no-verify`.

## Pitfalls

- **Generic catch-all keys** (`errors.<feature>.failed`) collapse distinct scenarios — give validation, not-found, forbidden, conflict, and each transition their own key.
- **Inline `messageKey` strings** in services/use-cases violate rules 8/13 — they belong in `model/<feature>.constants.ts`.
- **`throw new Error` / `new HttpException`** from app/domain code becomes a raw 500 and bypasses the catalog. Throw an `AppError` subclass.
- **Setting an HTTP status by hand** anywhere but the filter — the status must come from the class.
- **Leaking the cause:** `cause` is logged, never serialized into the response body. Same for stacks, SQL, vendor text, file paths, config.
- **`try/catch` in controllers** to build error bodies — let the error bubble; the filter is the only producer.
- **Repository throwing for "not found"** — return `null`/`[]`; the service decides the error.
- **Orphan keys:** a key with no thrower (or a thrower with no key) is a defect — surface it in review.
- **Untested locale branches** and the "missing locale → default" fallback drop per-file coverage below the floor.
- **Wrong `logLevel`:** logging a 404 at `error` drowns real alerts — `4xx`→`warn`, `5xx`→`error`.

## Related

[18-error-handling-and-exceptions.md](../rules/18-error-handling-and-exceptions.md) · [16-i18n-and-messaging.md](../rules/16-i18n-and-messaging.md) · [07-security-authn-authz.md](../rules/07-security-authn-authz.md) · [05-dto-and-validation.md](../rules/05-dto-and-validation.md) · [06-types-enums-constants.md](../rules/06-types-enums-constants.md) · [12-library-wrapping-and-adapters.md](../rules/12-library-wrapping-and-adapters.md) · [add-i18n-message-key.md](./add-i18n-message-key.md) · [create-service.md](./create-service.md) · [add-library-adapter.md](./add-library-adapter.md) · [write-unit-tests.md](./write-unit-tests.md) · [/memory/known-pitfalls.md](../memory/known-pitfalls.md)
