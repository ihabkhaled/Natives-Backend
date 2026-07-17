# Add an i18n Message Key

> Add or change an `errors.<feature>.<key>` (and its per-locale translations) as a stable, scenario-specific contract — keys are constants, translated in **every** supported locale, and proven by tests. Implements the canon in [16-i18n-and-messaging.md](../rules/16-i18n-and-messaging.md), [00-non-negotiable-rules.md](../rules/00-non-negotiable-rules.md) (rules 26, 30, 36), and [/context/architecture-map.md](../context/architecture-map.md) §5.

## Rules this skill enforces

- **Format `errors.<feature>.<key>`** — lowerCamelCase feature segment matching a real folder under `src/modules/`, lowerCamelCase key (rule 26, [16](../rules/16-i18n-and-messaging.md)).
- **One distinct key per scenario** — validation, not-found, forbidden, conflict, and each business-rule failure get their own key. Never a catch-all `errors.<feature>.error`.
- **Keys are named constants,** owned by the feature (`model/<feature>.constants.ts` or `@shared/constants`) — never inline literals in services/use-cases (rules 8, 13).
- **The backend returns the key, never localized prose.** The `message` field is for server logs only; the client maps the key to its bundle (rule 36).
- **Catalog parity:** every supported locale defines every key in the same change. A key in some locales but not others is an incomplete change and a release blocker.
- **Locale set + default are typed config,** not hardcoded and not `process.env` reads (rule 27, [17](../rules/17-configuration-and-environment.md)).
- **Tests first,** coverage floor 95% — each throw path → mapped status + `messageKey`; key-parity check green (rule 42, [11](../rules/11-testing-and-coverage.md)).

This skill owns the **key lifecycle** (naming, parity, translation, governance). To introduce a new `AppError` subclass or wire the exception filter, pair it with [create-error.md](./create-error.md). For server-rendered copy (email/SMS/push), use [add-notification.md](./add-notification.md) — that text is rendered per locale on the backend, not keyed.

## Tests FIRST

Before touching production code, add/adjust tests that fail for the right reason:

- A **unit test** on the throwing service/domain method asserting the exact `AppError` subclass **and** its `messageKey` constant.
- An **e2e/integration test** (supertest) asserting the route returns `messageKey` + `code` + sanitized `details` only — correct `statusCode`, no stack/SQL/secret.
- A **key-parity test** asserting every supported-locale bundle defines the new key (no orphans, no missing locale).

```ts
// <feature>.service.spec.ts — Do: assert the contract (key constant), not the prose
it('throws ConflictError with the feature key when the resource is already finalized', async () => {
  repo.findById.mockResolvedValue(finalizedEntity);
  await expect(service.finalize(id, actor)).rejects.toMatchObject({
    name: 'ConflictError',
    messageKey: FEATURE_MESSAGE_KEYS.ALREADY_FINALIZED,
  });
});
```

```ts
// message-keys.parity.spec.ts — Do: every locale defines every key
it.each(SUPPORTED_LOCALES)('locale %s defines every error key', locale => {
  const bundle = loadBundle(locale);
  for (const key of Object.values(FEATURE_MESSAGE_KEYS)) {
    expect(bundle).toHaveProperty(key);
  }
});
```

---

## Steps

### 1. Choose a specific key

Pick `errors.<feature>.<scenario>` — one key per scenario, never a catch-all. The `<feature>` segment must match a real module under `src/modules/`.

| Scenario                    | Example key                            | Class                      |
| --------------------------- | -------------------------------------- | -------------------------- |
| Not found / not visible     | `errors.invoice.notFound`              | `NotFoundError` 404        |
| Authenticated but not owner | `errors.invoice.forbiddenNotOwner`     | `ForbiddenError` 403       |
| Duplicate / state collision | `errors.invoice.alreadyFinalized`      | `ConflictError` 409        |
| Illegal transition          | `errors.invoice.invalidTransition`     | `StateTransitionError` 400 |
| Field-level validation      | `errors.invoice.field.amount.positive` | `ValidationError` 400      |

### 2. Add the key constant (feature-owned, never inline)

Search for the existing constants file first and extend it — don't ship a parallel duplicate (rule 13).

```ts
// model/<feature>.constants.ts — keys are constants, owned by the feature
export const FEATURE_MESSAGE_KEYS = {
  NOT_FOUND: 'errors.<feature>.notFound',
  FORBIDDEN_NOT_OWNER: 'errors.<feature>.forbiddenNotOwner',
  ALREADY_FINALIZED: 'errors.<feature>.alreadyFinalized',
} as const;
```

### 3. Throw it (or reference it) where the failure is detected

Throw a typed `AppError` from the use case/service (preconditions, ownership), the domain (invariants, transitions), or an adapter (integration). The status comes from the class — never set by hand outside the filter ([18](../rules/18-error-handling-and-exceptions.md)).

```ts
// application/<feature>.service.ts — Do: typed, semantic, keyed
async finalize(id: string, actor: AuthIdentity): Promise<FeatureEntity> {
  const entity = await this.repository.findById(id); // repo returns null, doesn't throw
  if (entity === null) throw new NotFoundError(FEATURE_MESSAGE_KEYS.NOT_FOUND, { id });
  if (entity.ownerId !== actor.id) throw new ForbiddenError(FEATURE_MESSAGE_KEYS.FORBIDDEN_NOT_OWNER);
  if (entity.status === FeatureStatus.Finalized) {
    throw new ConflictError(FEATURE_MESSAGE_KEYS.ALREADY_FINALIZED, { id });
  }
  return this.repository.update(id, { status: FeatureStatus.Finalized });
}
```

```ts
// Don't — a sentence as contract, a catch-all key, or backend-localized prose
throw new NotFoundError('Invoice not found'); // ❌ no key, leaks a sentence
throw new AppError('errors.invoice.error'); // ❌ generic catch-all
throw new BadRequestException('El campo es obligatorio'); // ❌ backend returns localized text
```

If a new `AppError` subclass or filter change is required, hand off to [create-error.md](./create-error.md). A new key on an existing class needs **no** filter change — `mapToResponse` handles every `AppError` generically.

### 4. Key field-level validation too

`class-validator` failures at the HTTP boundary must map to stable per-field keys, not raw validator sentences. Carry a key in the DTO `message` option so each client localizes per field ([05](../rules/05-dto-and-validation.md)).

```ts
// api/dto/create-<feature>.dto.ts — Do: a stable key, never a localized sentence
@IsPositive({ message: FEATURE_MESSAGE_KEYS.FIELD_AMOUNT_POSITIVE }) // 'errors.<feature>.field.amount.positive'
declare readonly amount: number;
```

### 5. Translate the key in every supported locale (same change)

Add the key to **each** supported client bundle / backend catalog in this change. The supported-locale set and default locale come from typed config (rule 27) — never enumerate locales inline. A key translated in some locales but not others is a release blocker.

```ts
// locale bundle (one per supported locale) — same key, locale-correct text
// <locale>/errors.json
{ "errors": { "<feature>": { "alreadyFinalized": "<locale-correct copy>" } } }
```

If a NestJS i18n library is used, load and validate bundles **behind a localizer adapter** at startup so a missing key in any supported locale fails fast in CI, not at runtime ([12](../rules/12-library-wrapping-and-adapters.md), [16](../rules/16-i18n-and-messaging.md)).

### 6. Renaming/removing a key is a contract change

Keys are **append-mostly**. To rename: add the new key, translate it everywhere, migrate throwers, keep the old key until clients migrate, and note it in release notes. Never silently drop a key clients still map.

### 7. Run the gate and make tests green

Confirm the route returns `{ statusCode, messageKey, code, details, correlationId, timestamp }` with no leakage, `4xx` logs at `warn`/`5xx` at `error`, and the parity check passes.

---

## Quality gate

```bash
npm run lint          # 0 errors AND 0 warnings — no eslint-disable
npm run typecheck     # tsc --noEmit (TypeScript 7) — strict, no any / no !
npm run test          # unit + integration green
npm run test:coverage # ≥95% on touched files; critical paths near 100%
npm run build         # compiles clean
```

Husky runs these for you (pre-commit: lint-staged + typecheck; commit-msg: commitlint; pre-push: test:coverage + build). Never bypass with `--no-verify`.

## Pitfalls

- **Missing-locale ship:** a key added to one bundle but not the others is the most common defect — the key-parity test/CI check must gate it.
- **Catch-all keys** (`errors.<feature>.failed`) collapse distinct scenarios — give validation, not-found, forbidden, conflict, and each transition their own key.
- **Inline key literals** in services/use-cases violate rules 8/13 — keys live in `model/<feature>.constants.ts`.
- **Backend-localized prose:** returning a translated sentence as the API contract breaks the client's localization and leaks the server's locale assumptions — return the key.
- **Feature segment drift:** `<feature>` not matching a real `src/modules/` folder makes keys un-ownable and un-greppable.
- **Hardcoded locale lists:** enumerating supported locales inline instead of reading typed config (rule 27) rots the moment a locale is added.
- **Renaming in place:** removing/renaming a live key without keeping the old one is a silent breaking change for clients.
- **Orphan keys:** a key with no thrower (or a thrower with no key) is a defect — surface it in review ([15](../rules/15-review-checklist.md)).
- **Untested locale branches** and the "missing locale → default" fallback drop per-file coverage below the floor.
- **Confusing surfaces:** API errors are keyed for the client; email/SMS/push copy is rendered per locale on the backend — never key the latter ([16](../rules/16-i18n-and-messaging.md) Part B).

## Related

[16-i18n-and-messaging.md](../rules/16-i18n-and-messaging.md) · [18-error-handling-and-exceptions.md](../rules/18-error-handling-and-exceptions.md) · [05-dto-and-validation.md](../rules/05-dto-and-validation.md) · [17-configuration-and-environment.md](../rules/17-configuration-and-environment.md) · [06-types-enums-constants.md](../rules/06-types-enums-constants.md) · [12-library-wrapping-and-adapters.md](../rules/12-library-wrapping-and-adapters.md) · [create-error.md](./create-error.md) · [add-notification.md](./add-notification.md) · [write-unit-tests.md](./write-unit-tests.md) · [/memory/event-notification-decisions.md](../memory/event-notification-decisions.md) · [/memory/known-pitfalls.md](../memory/known-pitfalls.md)
