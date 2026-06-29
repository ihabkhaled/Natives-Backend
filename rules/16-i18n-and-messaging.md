# 16 — i18n & Messaging

> The house standard for internationalization and user-facing copy. It implements the canon: API errors return **stable keys**, never localized sentences; server-rendered copy (email/SMS/push) is rendered **per supported locale** on the backend; every error scenario gets a **distinct** key. See [00-non-negotiable-rules.md](./00-non-negotiable-rules.md) (rules 26, 30, 36) and [/context/architecture-map.md](../context/architecture-map.md) §5.

The backend is **locale-agnostic**: it never hardcodes which locales exist or which is the default. A project records its supported-locale set and fallback once, in config and [/memory/event-notification-decisions.md](../memory/event-notification-decisions.md). Everything below works for any set of locales.

---

## Two distinct surfaces, two mechanisms

| Surface | Who localizes | Mechanism | Lives in |
| --- | --- | --- | --- |
| **API errors / API field copy** | The **client** | Backend returns a stable `messageKey`; client maps it to its bundle | `core/errors`, DTOs |
| **Server-rendered copy** (email, SMS, push, PDF, exports) | The **backend** | Render the actual localized text per recipient locale at send time | `adapters/`, notification templates |

Keep these apart. An API contract carries keys; a backend-rendered message carries finished text. Never mix them — never return a localized sentence as the API contract, never key a template you render yourself.

---

## Part A — `messageKey` discipline (API errors)

Every user-facing error is a typed `AppError` carrying a `messageKey` of the form **`errors.<feature>.<key>`** — lowerCamelCase feature segment that matches a real module under `src/modules/`, lowerCamelCase key. The global exception filter maps it to an HTTP status + sanitized body. The backend never returns a human-readable sentence as the contract; it returns the key, and each client maps it to its own bundle.

### Rules

1. **Format**: `errors.<feature>.<key>` — e.g. `errors.order.notFound`, `errors.account.invalidCredentials`, `errors.invoice.alreadyFinalized`.
2. **One key per scenario.** Validation, not-found, forbidden, conflict, and business-rule failures each get a **distinct** key. Never collapse them into a generic `errors.<feature>.error`.
3. **Keys are constants, never inline literals.** Per rule 8/13, message keys live in a dedicated file (`model/<feature>.constants.ts` or `@shared/constants`), never typed inline in a service/use-case.
4. **The English-ish `message` is for logs only.** The client contract is `messageKey` (+ machine-readable `code` + sanitized `details`). Never return stack traces, SQL, secrets, or raw internal messages (rule 36).
5. **Ship the key into every supported client bundle** in the same change. A key with a translation in some locales but not others is an incomplete change.

```ts
// model/order.constants.ts — keys are named constants, owned by the feature
export const ORDER_MESSAGE_KEYS = {
  NOT_FOUND: 'errors.order.notFound',
  FORBIDDEN_NOT_OWNER: 'errors.order.forbiddenNotOwner',
  ALREADY_FINALIZED: 'errors.order.alreadyFinalized',
} as const;
```

```ts
// DO — throw a typed error with a scenario-specific key constant
throw new NotFoundError(ORDER_MESSAGE_KEYS.NOT_FOUND, { orderId });
throw new ConflictError(ORDER_MESSAGE_KEYS.ALREADY_FINALIZED, { orderId });
throw new ForbiddenError(ORDER_MESSAGE_KEYS.FORBIDDEN_NOT_OWNER);
```

```ts
// DON'T
throw new NotFoundError('Order not found');                 // ✗ no key, a sentence as contract
throw new AppError('errors.order.error');                   // ✗ generic catch-all key
throw new BadRequestException('Le champ est requis');       // ✗ localized string from the backend
```

### Key → error class mapping

The `AppError` subclasses carry the key; the exception filter does the rest. (Full hierarchy: [18-error-handling-and-exceptions.md](./18-error-handling-and-exceptions.md).)

| Class | HTTP | `code` | When |
| --- | --- | --- | --- |
| `ValidationError` | 400 | `VALIDATION_ERROR` | bad/invalid input |
| `NotFoundError` | 404 | `RESOURCE_NOT_FOUND` | entity not found / not visible to caller |
| `UnauthorizedError` | 401 | `UNAUTHORIZED` | missing/invalid authentication |
| `ForbiddenError` | 403 | `FORBIDDEN` | authenticated but lacks permission/ownership |
| `ConflictError` | 409 | `CONFLICT` | duplicate / state collision |
| `StateTransitionError` | 400 | `STATE_TRANSITION_INVALID` | illegal state-machine transition |
| `IntegrationError` | 502 | `INTEGRATION_FAILED` | a wrapped external provider failed |

### Validation errors are keyed too

`class-validator` produces field-level failures at the HTTP boundary. Map them to a stable shape so each client can localize per field — never leak the raw validator sentence as the contract. Use a message-key convention for fields (e.g. `errors.<feature>.field.<name>.<rule>`) or attach a key in the DTO message option. Details in [05-dto-and-validation.md](./05-dto-and-validation.md).

---

## Part B — Server-rendered copy is localized inline (email / SMS / push)

`messageKey` covers API surfaces, where the client translates. **Anything the backend renders itself** — email bodies, SMS text, push payloads, PDFs, CSV headers — cannot be keyed for a client. It MUST carry the **actual localized text for the recipient's locale**, resolved at send time.

### Rules

1. **Render in every supported locale.** A template must produce correct copy for each locale the product supports — never ship a single-locale template into a multi-locale product.
2. **Resolve the locale at the top of the template, with a deterministic fallback.** Resolve the recipient's preferred locale to a supported one; unknown/missing values fall back to the configured default locale, so a recipient still gets a fully localized message.
3. **All copy lives in one locale-keyed copy object** — subject, headings, body lines, list items, button labels, plain-text body. No hardcoded sentences outside that object.
4. **Route through shared layout helpers** (greeting, sign-off, base layout, direction/RTL) so structure and per-locale formatting (text direction, date/number/currency) come for free. Locale-aware formatting belongs in `lib/` formatters, not inline.
5. **The recipient locale is a parameter, plumbed from the caller** (the verified user's preference), defaulting to the configured default. Never read it from the request body of an unrelated caller.
6. **Wrap the i18n/template engine behind an adapter** (rule 32): templates depend on your localizer interface, not on a vendor SDK. See [12-library-wrapping-and-adapters.md](./12-library-wrapping-and-adapters.md).

```ts
// DO — locale-resolved template; all copy in one locale-keyed object
function renderOrderShippedEmail(input: OrderShippedInput, locale?: string): RenderedEmail {
  const resolved = this.localizer.resolveLocale(locale); // → a supported locale, default-fallback
  const t = this.copy.orderShipped(resolved);            // copy object per locale, from lib/
  const html = this.layout.base(t.subject, this.body(t), resolved); // sets direction + formatting
  return { subject: t.subject, html, text: t.plain };
}
```

```ts
// DON'T — single-locale, no resolution, copy inline
function renderOrderShippedEmail(input: OrderShippedInput): RenderedEmail {
  const subject = `Your order ${input.id} has shipped`;   // ✗ one locale, inline sentence
  return { subject, html: this.layout.base(subject, body), text }; // ✗ layout defaults to one locale
}
```

> **Coverage trap:** each locale branch in a template is a real branch. Test **every supported locale** (subject + body assertions, plus direction/format checks for locales that need them) and the "missing locale → default" fallback path, or per-file coverage fails. See [11-testing-and-coverage.md](./11-testing-and-coverage.md).

---

## Optional: a NestJS i18n provider

If the project adopts a NestJS i18n library, treat it as an infrastructure dependency, not a free-for-all:

- **Wrap it in a localizer adapter/service** in `core/` exposing `translate(key, locale, args)`, `resolveLocale(input)`, and `supportedLocales()`. Business and template code depend on that interface — never import the i18n package directly outside the adapter (rule 32).
- **Use it for backend-rendered copy only.** API error contracts still return `messageKey`; do not pre-translate API errors server-side just because a translator is available.
- **Locale resolution order** is documented and consistent: explicit recipient preference → request/`Accept-Language` (for synchronous, locale-sensitive responses only) → configured default. Record the order in [/memory/event-notification-decisions.md](../memory/event-notification-decisions.md).
- **Translation files load at startup** and are validated; a missing key in a supported locale fails fast in CI, not silently at runtime.

---

## Catalog completeness & governance

- **Every supported locale must define every key.** A linter/CI check (or a key-parity test) compares locale bundles and template copy objects; a key present in one locale but missing in another **fails the build**.
- **The supported-locale set and default locale are typed config** (rule 27), read via `@nestjs/config`, never from scattered `process.env`. See [17-configuration-and-environment.md](./17-configuration-and-environment.md).
- **Keys are append-mostly.** Renaming or removing a key is a contract change: update every client bundle and template, note it in release notes, and keep the old key until clients migrate.
- **No orphan keys.** A key with no thrower, and a thrower with no key, are both defects — surface them in review ([15-review-checklist.md](./15-review-checklist.md)).

> _Project specifics to record (not here):_ the exact supported-locale codes, the default/fallback locale, the chosen i18n library (if any), and where client bundles live — capture these in [/memory/event-notification-decisions.md](../memory/event-notification-decisions.md) and [/memory/project-architecture.md](../memory/project-architecture.md).

---

## Checklist before "done"

- [ ] Every new throw path carries a **distinct** `errors.<feature>.<key>` (validation / not-found / forbidden / conflict / business-rule each separate).
- [ ] The `<feature>` segment matches a real `src/modules/` folder; keys are named constants, not inline literals.
- [ ] The key exists in **every** supported client bundle, added in the same change.
- [ ] API responses carry `messageKey` + `code` + sanitized `details` only — no stack/SQL/secret/raw-message leakage.
- [ ] Every new server-rendered template (email/SMS/push/PDF) renders **every supported locale**, with deterministic default fallback for unknown locales.
- [ ] All template copy lives in a locale-keyed object; locale-aware formatting is in `lib/` formatters; the i18n/template engine is behind an adapter.
- [ ] Tests assert each locale branch + the fallback path; key-parity check is green.
- [ ] Supported locales and default are typed config, not `process.env` reads.

Related: [18-error-handling-and-exceptions.md](./18-error-handling-and-exceptions.md) · [05-dto-and-validation.md](./05-dto-and-validation.md) · [07-security-authn-authz.md](./07-security-authn-authz.md) · [17-configuration-and-environment.md](./17-configuration-and-environment.md) · [12-library-wrapping-and-adapters.md](./12-library-wrapping-and-adapters.md) · [/skills/add-i18n-message-key.md](../skills/add-i18n-message-key.md) · [/skills/add-notification.md](../skills/add-notification.md) · [/memory/known-pitfalls.md](../memory/known-pitfalls.md)
