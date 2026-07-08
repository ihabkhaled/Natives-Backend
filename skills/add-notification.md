# Skill — Add a Notification (email / SMS / push)

> Send a notification through a **domain event** + a **provider adapter**, localized per locale and fail-safe so a delivery failure never breaks the request. Implements [/context/architecture-map.md](../context/architecture-map.md) and [00-non-negotiable-rules.md](../rules/00-non-negotiable-rules.md).

A notification is a **side effect**, not part of the request's success path. Never call a provider SDK inline in a controller, service, or use case. Emit a domain event after the work commits; a dedicated handler delivers through an adapter, catching its own errors.

## Rules this skill enforces

| Concern                                           | Rule                                                                                              |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Side effects are fire-and-forget + self-catching  | rule 38 — [10-reliability-and-durability.md](../rules/10-reliability-and-durability.md)           |
| External provider wrapped behind an adapter       | rule 32, 41 — [12-library-wrapping-and-adapters.md](../rules/12-library-wrapping-and-adapters.md) |
| Notification triggered by an event, not inline    | [19-async-events-and-jobs.md](../rules/19-async-events-and-jobs.md)                               |
| Copy localized per locale via `messageKey`        | rule 30 — [16-i18n-and-messaging.md](../rules/16-i18n-and-messaging.md)                           |
| Typed config (provider keys), never `process.env` | rule 27 — [17-configuration-and-environment.md](../rules/17-configuration-and-environment.md)     |
| Logger adapter, redact PII; no `console.*`        | rule 28, 40 — [14-observability-and-logging.md](../rules/14-observability-and-logging.md)         |
| No inline types/enums/constants in layer files    | rules 10–16 — [06-types-enums-constants.md](../rules/06-types-enums-constants.md)                 |
| Typed `AppError` for provider failures            | rule 26 — [18-error-handling-and-exceptions.md](../rules/18-error-handling-and-exceptions.md)     |

---

## Tests FIRST

Write the failing tests before any production code:

- **Unit (handler):** the event handler calls the notification adapter with the right channel + payload; assert recipient identity comes from the event, not raw input.
- **Fail-safe:** when the adapter **rejects**, the handler resolves anyway, logs the failure, and never re-throws into the workflow.
- **Per-locale:** one test per supported locale — the rendered copy resolves the correct `messageKey` and direction/format for that locale. An untested locale branch fails the 95% per-file coverage floor.
- **Subscription count:** if you register a new subscriber, bump the expected subscriber count assertion in the event-handler test.

See [write-unit-tests.md](./write-unit-tests.md).

---

## Steps

### 1. Define the channel enum + payload type in `model/` (no inline declarations)

```ts
// shared/enums/notification-channel.enum.ts
export enum NotificationChannel {
  Email = 'email',
  Sms = 'sms',
  Push = 'push',
}
export const NOTIFICATION_CHANNEL_VALUES = Object.values(NotificationChannel);
```

```ts
// modules/<feature>/model/<feature>.types.ts
export interface AccountVerifiedEvent {
  readonly accountId: string;
  readonly locale: string; // resolved upstream from the verified identity
}
```

### 2. Wrap the provider behind an adapter (never the SDK in business code)

The adapter is the **only** file allowed to import the vendor SDK (ESLint `architecture/no-restricted-layer-imports`). Expose a typed, app-owned interface so the provider is swappable.

```ts
// core/notifications/notification.adapter.ts
@Injectable()
export class NotificationAdapter {
  constructor(
    private readonly config: NotificationConfig, // typed config, not process.env
    private readonly logger: AppLogger,
  ) {}

  public async send(message: OutboundMessage): Promise<NotificationResult> {
    // call the email provider / SMS gateway / push provider SDK here
  }
}
```

> Do — depend on `NotificationAdapter`. Don't — `import { EmailClient } from '<vendor-sdk>'` inside a service.

### 3. Localize the copy with `messageKey` (every supported locale)

Resolve the recipient's locale from the verified identity, fall back to the default locale, and render through the i18n layer. Never hardcode user-facing strings in logic.

```ts
// modules/<feature>/lib/<feature>.notification.mapper.ts
export function buildVerificationMessage(
  event: AccountVerifiedEvent,
  i18n: I18nService,
): OutboundMessage {
  const subject = i18n.translate(
    'notifications.account.verified.subject',
    event.locale,
  );
  const body = i18n.translate(
    'notifications.account.verified.body',
    event.locale,
  );
  return {
    channel: NotificationChannel.Email,
    locale: event.locale,
    subject,
    body,
  };
}
```

Add the key to **each** supported locale catalogue. See [add-i18n-message-key.md](./add-i18n-message-key.md).

### 4. Emit the domain event after the work commits (don't notify inline)

The use case owns the transaction and emits **after** commit; the service for single-write flows emits the same way. No provider call in the request path.

```ts
// modules/<feature>/application/verify-account.use-case.ts
public async execute(command: VerifyAccountCommand): Promise<void> {
  const account = await this.accountService.verify(command.accountId);
  await this.events.emit(AccountEvents.Verified, {
    accountId: account.id,
    locale: account.locale,
  });
}
```

> Use the event-bus wrapper from `@core/events` — see [add-event-handler.md](./add-event-handler.md). Never `Promise.all` the emit inside a service (ESLint-banned).

### 5. Deliver in a self-catching handler (fail-safe)

The handler owns the try/catch. A failed delivery logs and exits cleanly — it must never re-throw into the emitter's flow.

```ts
// modules/<feature>/application/account-notification.handler.ts
@OnEvent(AccountEvents.Verified)
public async onAccountVerified(event: AccountVerifiedEvent): Promise<void> {
  try {
    const message = buildVerificationMessage(event, this.i18n);
    await this.notifications.send(message);
  } catch (error: unknown) {
    this.logger.error('notification.delivery.failed', { event, error });
    // swallowed on purpose: delivery failure must not break the workflow
  }
}
```

> Do — catch inside the handler and log. Don't — let a provider timeout bubble up and fail the originating request.

### 6. Wire config + provider keys through typed config

Add provider credentials/endpoints to the typed config namespace and validate them at startup; read them only in the adapter via injected config. See [add-config-value.md](./add-config-value.md).

### 7. Register the handler + adapter in the module

Provide `NotificationAdapter` and the handler in the feature `*.module.ts`; export only the public surface via `index.ts`. Keep cross-module reach to events + public barrels.

---

## Quality gates (all must pass)

```bash
npm run lint          # 0 errors, 0 warnings (architecture + style)
npm run typecheck     # tsgo --noEmit, full strict
npm run test          # unit + integration, including the fail-safe path
npm run test:coverage # ≥95% per-file; every locale branch covered
npm run build         # production build
```

Never bypass Husky with `--no-verify`. See [final-validation.md](./final-validation.md).

---

## Pitfalls

- **Inline provider call.** Calling the SDK in a service/use case couples the workflow to delivery latency and to one vendor. Route every call through the adapter + an event.
- **Unhandled rejection in the handler.** A handler without its own try/catch turns a transient provider outage into a failed user request. Always swallow + log.
- **English-only / default-locale-only copy.** Render for each supported locale via `messageKey`; add a test per locale or coverage drops on the untested branch.
- **Identity from the request body.** Recipient address/locale must come from the verified identity carried on the event, not from client input (IDOR / spoofing risk).
- **Secrets in logs.** Redact recipient PII and provider tokens; log a stable event label, not the raw payload. (rule 40)
- **Missing subscriber-count update.** Adding a new subscription without bumping the count assertion lets a silently-dropped handler pass review.
- **Provider keys via `process.env`.** Read them through typed config; validate at startup so a misconfigured provider fails fast, not at first send.

---

Related: [add-event-handler.md](./add-event-handler.md), [add-library-adapter.md](./add-library-adapter.md), [add-i18n-message-key.md](./add-i18n-message-key.md), [add-config-value.md](./add-config-value.md), [create-error.md](./create-error.md), [write-unit-tests.md](./write-unit-tests.md), [/rules/10-reliability-and-durability.md](../rules/10-reliability-and-durability.md), [/rules/19-async-events-and-jobs.md](../rules/19-async-events-and-jobs.md).
