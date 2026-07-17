# 12 — Library Wrapping & Adapters

> Every external library that touches product behavior is wrapped behind an app-owned **adapter**. Business code depends on _your_ interface — never on the vendor SDK. This implements the Integration layer of [`/context/architecture-map.md`](../context/architecture-map.md) and rules **32** and **41** of [00-non-negotiable-rules.md](./00-non-negotiable-rules.md).

The vendor package is a swappable implementation detail. The port (the interface) is yours, it is stable, and it is the only thing the rest of the codebase ever sees.

---

## Why wrap (the five reasons)

| Reason                | What the adapter centralizes                                                                                                                                                                               |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Central config**    | Secrets, base URLs, timeouts, pool sizes — read once from typed config ([17-configuration-and-environment.md](./17-configuration-and-environment.md)), never re-read by callers.                           |
| **Hardening**         | TLS, timing-safe compares, allow-lists, redaction, retry/timeout/circuit-breaker ([10-reliability-and-durability.md](./10-reliability-and-durability.md)) live in **one** place.                           |
| **Consistent errors** | The adapter catches vendor exceptions and rethrows typed `AppError`s with a `messageKey` ([18-error-handling-and-exceptions.md](./18-error-handling-and-exceptions.md)); vendor error shapes never escape. |
| **Test doubles**      | One mock surface per dependency. Callers mock the port token; the adapter's own tests mock the SDK. No network in tests ([11-testing-and-coverage.md](./11-testing-and-coverage.md)).                      |
| **Swap surface**      | Replace the email provider, cache client, or HTTP library by editing one adapter — not 40 call sites.                                                                                                      |

```ts
// DON'T — a service imports the SDK directly; config, auth, retry, and the
// vendor's error/return types all leak into business code, in 40 places.
import { SomeMailSdk } from 'some-mail-sdk';
await new SomeMailSdk(process.env.MAIL_KEY).send({ to, html }); // ESLint blocks both lines

// DO — depend on the port; the adapter owns the SDK, config, and hardening.
constructor(@Inject(MAILER_PORT) private readonly mailer: MailerPort) {}
await this.mailer.send({ to, templateKey, data });
```

---

## Package-boundary enforcement (ESLint)

`architecture/no-restricted-layer-imports` makes the boundary mechanical, not aspirational:

- **Vendor packages may be imported only inside `adapters/` directories** (module `adapters/` or `core/`). A controller, service, use case, repository, guard, or DTO that imports a wrapped library is a lint **error** — `npm run lint` must be 0 errors / 0 warnings (rule 2).
- A Nest module may import the vendor's module solely to register/configure the adapter provider. That does not authorize a service, guard, repository, or test fixture to inject the vendor service directly; consumers inject the app-owned port token.
- `process.env` is restricted to `config/` and `bootstrap/`; an adapter takes its settings via injected typed config, it does not read env.
- `no-restricted-syntax` bans inline `type`/`interface`/`enum`/`const` inside adapters — the **port interface and its types live in `model/` or `@shared/types`**, not in the adapter file ([06-types-enums-constants.md](./06-types-enums-constants.md)).

> The list of "wrapped" packages is configured in [`/eslint/architecture.config.mjs`](../eslint/architecture.config.mjs). When you add a new external dependency, add it to that list so the boundary is enforced from day one. Record the package → adapter mapping in [/memory/library-boundaries.md](../memory/library-boundaries.md).

The reference app currently enforces `bcrypt` → auth password adapter and `@nestjs/jwt` → auth JWT adapter (with `JwtModule` registration allowed only in `auth.module.ts`).

---

## The adapter shape

Three pieces, always, in this order:

1. **Port interface** — a small, intention-revealing contract you own. Owned input/output types only; **no vendor types cross it**. Domain values are enums, not string unions. Lives in `model/<name>.types.ts` (or `@shared/types` if cross-module).
2. **Implementation provider** — the single `@Injectable()` adapter that imports the SDK, reads its config, applies hardening + resilience, maps results to owned types, and maps failures to typed `AppError`s.
3. **Module wiring** — bind the port token to the implementation with `{ provide: PORT, useClass: Adapter }`, and `export` the token so consumers inject the interface, not the concrete class.

Authentication libraries follow the same rule as payment/mail/cache SDKs: password hashing and JWT signing/verification live behind owned ports; decoded payloads are runtime-validated before becoming an application identity.

```ts
// model/mailer.types.ts — the PORT (you own this; SDK types never appear here)
export interface SendEmailInput {
  to: string;
  templateKey: EmailTemplateKey; // enum from @shared/enums, not a string union
  data: Readonly<Record<string, string>>;
}
export interface MailerPort {
  send(input: SendEmailInput): Promise<void>;
}
```

```ts
// model/mailer.constants.ts — the injection token (no inline tokens in the adapter)
export const MAILER_PORT = Symbol('MailerPort');
```

```ts
// adapters/email-provider.adapter.ts — the IMPLEMENTATION (only file importing the SDK)
import { Inject, Injectable } from '@nestjs/common';
import { SomeMailSdk } from 'some-mail-sdk'; // ← allowed ONLY inside adapters/
import { AppLogger } from '@core/logger';
import { mailerConfig } from '@config/mailer.config';
import { IntegrationUnavailableError } from '@core/errors';
import type { ConfigType } from '@nestjs/config';
import type { MailerPort, SendEmailInput } from '../model/mailer.types';

@Injectable()
export class EmailProviderAdapter implements MailerPort {
  private readonly client: SomeMailSdk;

  constructor(
    @Inject(mailerConfig.KEY) config: ConfigType<typeof mailerConfig>,
    private readonly logger: AppLogger,
  ) {
    this.client = new SomeMailSdk({
      apiKey: config.apiKey,
      timeoutMs: config.timeoutMs,
    });
  }

  public async send(input: SendEmailInput): Promise<void> {
    try {
      await this.client.deliver(this.toVendorPayload(input)); // map owned → vendor inside
    } catch (cause) {
      this.logger.error('email.send.failed', {
        templateKey: input.templateKey,
      }); // no secrets
      throw new IntegrationUnavailableError('errors.mailer.send_failed', {
        cause,
      });
    }
  }

  private toVendorPayload(input: SendEmailInput): SomeMailSdk.Payload {
    /* translate to the SDK shape here — never expose SomeMailSdk.Payload to callers */
  }
}
```

```ts
// integration.module.ts — WIRING: bind the port token, export it for consumers
@Module({
  providers: [{ provide: MAILER_PORT, useClass: EmailProviderAdapter }],
  exports: [MAILER_PORT],
})
export class MailerModule {}
```

### Provider-swappable variant

When more than one vendor can satisfy the same port (e.g. two email providers, two SMS gateways), keep the port identical and select the implementation by a typed config enum via a `useFactory`. The contract stays constant; only the concrete class changes.

```ts
{
  provide: MAILER_PORT,
  inject: [mailerConfig.KEY, PrimaryAdapter, FallbackAdapter],
  useFactory: (cfg: MailerConfig, primary: MailerPort, fallback: MailerPort): MailerPort =>
    cfg.provider === MailerProvider.Primary ? primary : fallback,
}
```

---

## Documentation required per adapter (rule 41)

An adapter is **not done** until [/memory/library-boundaries.md](../memory/library-boundaries.md) (or a module doc) records:

- **Concern owned** — what capability this adapter provides (e.g. "outbound transactional email").
- **Vendor wrapped** — package name + version, and the config keys it consumes.
- **Public port** — the interface and its methods (the only surface callers use).
- **Failure behavior** — which `AppError`/`messageKey` is thrown, retry/timeout/breaker policy, and degradation behavior.
- **Security notes** — what is redacted, TLS expectations, allow-lists, timing-safe comparisons.
- **Swap notes** — what changing the vendor would touch (ideally only this adapter + config).

No new integration, queue client, job runner, or external dependency ships without **adapter + port + tests + docs + config wiring** in the same change.

---

## Worked examples (neutral placeholders)

| Concern            | Port (you own)                                             | Wrapped vendor (example)                  | Adapter owns                                                                                                                     |
| ------------------ | ---------------------------------------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **Outbound HTTP**  | `HttpClientPort.request<T>(req): Promise<HttpResponse<T>>` | any HTTP client (`fetch`, axios, undici)  | base URL, timeout, retry+backoff, auth header injection, response typing, error mapping                                          |
| **Logging**        | `AppLogger` (`info`/`warn`/`error`/`debug`)                | any logger (pino, winston, Nest `Logger`) | level config, structured fields, **PII/secret redaction** ([14-observability-and-logging.md](./14-observability-and-logging.md)) |
| **Mailer**         | `MailerPort.send(input): Promise<void>`                    | any email provider                        | template selection, HTML escaping, owned `SendEmailInput`, provider swap                                                         |
| **Object storage** | `ObjectStoragePort.put/get/delete/signedUrl(...)`          | any blob/object store                     | bucket config, content-type/size allow-list, signed-URL TTL, key namespacing                                                     |
| **Cache**          | `CachePort.get<T>/set<T>/del(key, ttl?)`                   | any cache client                          | connection/pool config, key prefixing, default TTL, serialize/deserialize, fail-open reads                                       |

### Outbound HTTP — the canonical wrap

Never instantiate a global HTTP singleton in business code. Each integration gets a typed client built from the shared `HttpClientPort`, configured once.

```ts
// model/http-client.types.ts
export interface HttpRequest {
  method: HttpMethod; // enum from @shared/enums
  path: string;
  query?: Readonly<Record<string, string>>;
  body?: unknown;
}
export interface HttpResponse<T> {
  status: number;
  data: T;
}
export interface HttpClientPort {
  request<T>(req: HttpRequest): Promise<HttpResponse<T>>;
}
```

```ts
// adapters/payment-provider.adapter.ts — composes the port; SDK/HTTP lib stays hidden
@Injectable()
export class PaymentProviderAdapter implements PaymentPort {
  constructor(
    @Inject(HTTP_CLIENT_PORT) private readonly http: HttpClientPort,
  ) {}

  public async charge(input: ChargeInput): Promise<ChargeResult> {
    const res = await this.http.request<ChargeResponseBody>({
      method: HttpMethod.Post,
      path: PaymentRoutes.Charge, // constant, not a magic string
      body: this.toRequestBody(input),
    });
    return this.toResult(res.data); // map vendor body → owned ChargeResult
  }
}
```

### Cache — fail-open reads, mapped errors

```ts
// DON'T — caller imports the cache SDK and lets its errors bubble into the workflow
import { CacheSdk } from 'cache-sdk';
const cached = await new CacheSdk().get(key); // a cache outage now breaks the request

// DO — CachePort; a read miss/outage degrades gracefully, a write failure is logged
const cached = await this.cache.get<UserProfile>(CacheKeys.profile(userId));
if (cached) return cached;
```

> Loggers, the global exception filter, and config are foundational adapters that all other adapters use — they live in `src/core`. Feature-specific vendors (mailer, storage, payment, SMS) live in the owning module's `adapters/`.

---

## Checklist

- [ ] No vendor SDK imported outside an `adapters/`/`core/` directory (ESLint green, rules 2 & 32).
- [ ] Port interface owns its types/enums; **no vendor types or string unions** cross the boundary (rule 32, rules 10–16).
- [ ] Adapter is the **sole** importer of the SDK; provider-swappable via config where it earns its keep.
- [ ] Config read from typed config only ([17](./17-configuration-and-environment.md)); no `process.env` in the adapter (rule 27).
- [ ] Resilience (timeout + bounded retry + breaker) and graceful degradation handled inside the adapter (rules/10).
- [ ] Vendor failures mapped to typed `AppError` + `messageKey`; no leaked vendor errors/secrets (rules 26, 36).
- [ ] Logging via `@core/logger` with redaction; never `console.*` (rule 28).
- [ ] Module wiring binds and **exports** the port token; consumers inject the interface, not the class.
- [ ] Tests: callers mock the port token; the adapter's own tests mock the SDK; no real network (rules/11).
- [ ] Docs entry + swap notes recorded in [/memory/library-boundaries.md](../memory/library-boundaries.md); package added to [`architecture.config.mjs`](../eslint/architecture.config.mjs) (rule 41).
- [ ] Gates green: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run test:coverage`, `npm run build`.

**Related:** [00-non-negotiable-rules.md](./00-non-negotiable-rules.md) · [01-architecture-and-module-boundaries.md](./01-architecture-and-module-boundaries.md) · [10-reliability-and-durability.md](./10-reliability-and-durability.md) · [17-configuration-and-environment.md](./17-configuration-and-environment.md) · [18-error-handling-and-exceptions.md](./18-error-handling-and-exceptions.md) · [/skills/add-library-adapter.md](../skills/add-library-adapter.md) · [/memory/library-boundaries.md](../memory/library-boundaries.md)
