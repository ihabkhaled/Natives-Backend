# Skill — Add an Event Handler (Subscribe to a Domain Event)

> Subscribe a fire-and-forget handler to a domain event so one module reacts to another without coupling — typed payload, named event constant, catches its own errors, idempotent on replay. Implements the canon: [/context/architecture-map.md](../context/architecture-map.md) and rules 24, 38, 41 of [00-non-negotiable-rules.md](../rules/00-non-negotiable-rules.md).

Use when a fact in one feature must trigger an independent reaction (notification, audit trail, read-model projection, cache invalidation, downstream sync) that the originating request **does not wait on** and whose failure **must not** fail that request.

## Rules this skill enforces

| #     | Rule                                                                                                            |
| ----- | --------------------------------------------------------------------------------------------------------------- |
| 24    | Cross-module reactions go through events, never internal imports. The handler lives in the consuming module.    |
| 38    | Side effects are fail-safe — the handler catches its own errors; a delivery failure never aborts the publisher. |
| 8, 13 | Event name is a constant in `model/`; no magic strings, no inline literals.                                     |
| 10–16 | Payload type lives in `model/<feature>.types.ts` — no inline shapes in the handler.                             |
| 12    | The emitter is reached only through `@core/events`; never import the vendor library in a handler.               |
| 28    | Log via the logger adapter (`@core/logger`); never `console.*`. Carry the correlation id.                       |
| 42    | Tests + docs ship in the same change; write the test first.                                                     |

Detail: [/rules/19-async-events-and-jobs.md](../rules/19-async-events-and-jobs.md) · [/rules/10-reliability-and-durability.md](../rules/10-reliability-and-durability.md).

## Inspect first

- `@core/events` — the `EventBus` wrapper and the `@OnEvent` registration API (the only place the emitter library is imported).
- The publishing feature's `model/<feature>.enums.ts` (the event name) and `model/<feature>.types.ts` (the payload type) — **reuse them; never redeclare**.
- An existing handler in any module for the established `try/catch` + log shape.
- [/memory/event-notification-decisions.md](../memory/event-notification-decisions.md) — the event/consumer catalog you must update.

---

## Steps

### 1. Tests FIRST

Before any handler code, write two assertions that pin the contract: the handler reacts to the event, and a thrown side effect is **isolated** (does not propagate). Also assert the registered-handler count so a silently-unregistered handler fails CI.

```ts
// notify-on-account-verified.handler.spec.ts
it('delegates to the service on the event', async () => {
  await handler.handle(event);
  expect(notifier.sendWelcome).toHaveBeenCalledWith(event.accountId);
});

it('isolates failures — a throwing side effect never propagates', async () => {
  notifier.sendWelcome.mockRejectedValueOnce(new Error('provider down'));
  await expect(handler.handle(event)).resolves.toBeUndefined(); // swallowed + logged
});

it('registers exactly one listener for the event', () => {
  expect(emitter.listenerCount(AccountEvent.Verified)).toBe(1); // bump N as handlers grow
});
```

### 2. Confirm the event name constant exists (no magic strings)

Event names are members of an `as const` map in the publisher's `model/`, past-tense `<feature>.<action>`. If it already exists, import it. Only add a member if the event is genuinely new.

```ts
// model/account.enums.ts  (owned by the publishing feature)
export const AccountEvent = {
  VERIFIED: 'account.verified',
  SUSPENDED: 'account.suspended',
} as const;
export type AccountEvent = (typeof AccountEvent)[keyof typeof AccountEvent];
```

### 3. Type the payload in `model/` — never inline

The payload carries identifiers, the facts the handler needs, and a correlation id. Never a full entity, never secrets (rules 5, 28).

```ts
// model/account.types.ts
export interface AccountVerifiedEvent {
  readonly accountId: string;
  readonly correlationId: string;
}
```

### 4. Register the handler in the CONSUMING module

The handler is a provider in the reacting feature. It registers declaratively with `@OnEvent` — it never reaches into the publisher's bus or internals (rule 24). It is a thin transport into the application layer: delegate heavy work to a service/use case.

```ts
// modules/notification/application/notify-on-account-verified.handler.ts
@Injectable()
export class NotifyOnAccountVerifiedHandler {
  constructor(
    private readonly notifier: WelcomeNotificationService,
    private readonly logger: AppLogger,
  ) {}

  @OnEvent(AccountEvent.Verified)
  async handle(event: AccountVerifiedEvent): Promise<void> {
    try {
      await this.notifier.sendWelcome(event.accountId);
    } catch (error: unknown) {
      this.logger.error('welcome notification failed', {
        accountId: event.accountId,
        correlationId: event.correlationId,
        error,
      });
    }
  }
}
```

```ts
// DON'T — an unhandled throw aborts the publisher's success path
@OnEvent(AccountEvent.Verified)
async handle(event: AccountVerifiedEvent): Promise<void> {
  await this.notifier.sendWelcome(event.accountId); // throws → "account verified" fails
}
```

### 5. Make the handler idempotent

A handler may run more than once (re-delivery, retried publisher, replay). Dedupe on a stable key — the entity id or the event id — so a re-run touches nothing new. Heavy reaction work belongs in the service, which owns the dedupe check.

```ts
// inside WelcomeNotificationService — safe on replay
async sendWelcome(accountId: string): Promise<void> {
  if (await this.alreadyNotified(accountId)) return; // dedupe gate
  await this.emailAdapter.send(this.builder.welcome(accountId));
  await this.markNotified(accountId);
}
```

### 6. Wire the provider and bump the listener-count assertion

Add the handler to the consuming module's `providers`. Update the registered-handler-count test (step 1) to the new `N` — forgetting this is the most common miss.

```ts
// modules/notification/notification.module.ts
@Module({
  providers: [WelcomeNotificationService, NotifyOnAccountVerifiedHandler],
})
export class NotificationModule {}
```

### 7. No floating promises

Every promise is `await`ed or detached deliberately through the bus — never `void someAsync()` and hope. `@typescript-eslint/no-floating-promises` is `error`.

### 8. Update the catalog

Record the new event → consumer link in [/memory/event-notification-decisions.md](../memory/event-notification-decisions.md). An event without a documented trigger and consumer is incomplete (rule 41).

---

## Tests FIRST

Write step 1 before writing the handler. The success path proves delegation; the failure path proves isolation (`resolves`, not `rejects`); the listener-count assertion proves the subscription is wired. Critical paths approach 100% coverage; the touched-module floor is 95%.

## Quality gates (all must pass)

```bash
npm run lint          # 0 errors AND 0 warnings — no inline decls, no magic strings, no Promise.all in services
npm run typecheck     # tsc --noEmit (TypeScript 7) — typed payload, no any, no non-null assertion
npm run test          # success path + failure-isolation + listener-count
npm run test:coverage # touched-module floor 95%; critical paths near 100%
npm run build         # compiles clean
```

Never bypass Husky with `--no-verify`.

## Pitfalls

- **Throwing out of the handler** — the most repeated reliability bug. The `catch` is mandatory; a delivery failure is logged, never rethrown into the publisher (rule 38).
- **Forgetting the listener-count bump** — a silently-unregistered handler passes the success test but never fires in production. The count assertion is what catches it.
- **Awaiting the handler in the request path** — re-couples the caller to the side effect's latency and failure. Emit and move on; the bus dispatches.
- **Handler in the wrong module** — it belongs in the _consuming_ feature. Putting it in the publisher reintroduces the coupling events exist to remove.
- **Importing the emitter library directly** — it is wrapped in `@core/events`; a handler depends on `@OnEvent`, never the vendor SDK (rule 12).
- **Magic-string event name or inline payload type** — both are ESLint failures; the name lives in `model/<feature>.enums.ts`, the payload in `model/<feature>.types.ts`.
- **Non-idempotent reaction** — re-delivery double-sends. Dedupe on a stable key in the service.
- **Fat handler body** — heavy logic belongs in a service/use case; the handler just delegates and catches. Fan-out to many recipients uses `Promise.allSettled` in a use case or adapter, never a service (ESLint-banned).
- **Leaking a full entity or secret in the payload** — carry identifiers and facts plus the correlation id only (rules 5, 28).

## Related

[/rules/19-async-events-and-jobs.md](../rules/19-async-events-and-jobs.md) · [/rules/10-reliability-and-durability.md](../rules/10-reliability-and-durability.md) · [/rules/12-library-wrapping-and-adapters.md](../rules/12-library-wrapping-and-adapters.md) · [/skills/add-notification.md](./add-notification.md) · [/skills/add-library-adapter.md](./add-library-adapter.md) · [/skills/reliability-review.md](./reliability-review.md) · [/skills/write-unit-tests.md](./write-unit-tests.md) · [/memory/event-notification-decisions.md](../memory/event-notification-decisions.md)
