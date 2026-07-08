# Skill: Add a Library Behind a Mandatory Adapter

> Introduce a new npm dependency — or move existing raw usage — behind a typed adapter (port interface + provider + module) so business code depends on your contract, never the vendor. Implements [00-non-negotiable-rules.md](../rules/00-non-negotiable-rules.md) (32) and [12-library-wrapping-and-adapters.md](../rules/12-library-wrapping-and-adapters.md).

Use this for any runtime package or external service: an HTTP API, an email provider, object storage, an SMS gateway, a payment provider, a cache, a message broker. Type-only `@types/*` dev deps skip the adapter but still get the Step 1 vetting.

## Rules this skill enforces

- **One adapter per vendor.** Raw SDK / client / HTTP-library calls appear **only** inside `adapters/<vendor>.adapter.ts`. ESLint `architecture/no-restricted-layer-imports` bans vendor imports anywhere else.
- **Port interface first.** Consumers depend on an app-owned interface (`@shared/types` or `model/`), injected via a Nest provider token — never the concrete vendor class.
- **Config-driven.** Keys/URLs/timeouts come from typed `@nestjs/config`. **No `process.env` outside `config/` and `bootstrap/`** (rules 27).
- **Fail-safe + typed errors.** Wrap every external call; normalize failures into a typed `AppError` subclass carrying `errors.<feature>.<key>` (rules 26, 36). Never leak vendor stacks/secrets.
- **No inline declarations.** Types, tokens, constants live in dedicated files (rules 10–16).
- **Tested + documented** before merge (rules 41, 42).

---

## Step 1 — Vet the package BEFORE installing

Record findings (you paste them into memory in Step 8):

- **Health:** recent releases, open CVEs, downloads, license compatibility.
- **Supply chain:** transitive dep count; pin known-vulnerable transitives via `package.json` overrides.
- **Operability:** does it expose explicit timeouts, TLS, and connection pooling? Sync vs async cost.
- **Security surface:** does it touch secrets, exec, regex, or deserialization?

Then install and commit the lockfile:

```bash
npm install <package>
```

## Step 2 — Define the port interface and token

The contract is app-owned and vendor-free. **Do** keep vendor types out of the signature.

```ts
// src/modules/<feature>/model/<vendor>.types.ts
export interface SendResult {
  readonly id: string;
  readonly accepted: boolean;
}

export interface NotificationPort {
  send(to: string, body: string): Promise<SendResult>;
}
```

```ts
// src/modules/<feature>/model/<vendor>.constants.ts
export const NOTIFICATION_PORT = Symbol('NOTIFICATION_PORT');
export const VENDOR_TIMEOUT_MS = 5_000;
```

**Don't** return the SDK's response object — that re-leaks the vendor through the back door.

## Step 3 — Add typed config

Read every endpoint/key/timeout from `@nestjs/config`. Required secrets go in the startup validation schema so misconfiguration fails fast (rules 29).

```ts
// src/config/vendor.config.ts
import { registerAs } from '@nestjs/config';
import { VendorConfig } from '@shared/types/config.types';

export default registerAs('vendor', (): VendorConfig => ({
  baseUrl: process.env.VENDOR_BASE_URL ?? '', // process.env allowed ONLY here
  apiKey: process.env.VENDOR_API_KEY ?? '',
}));
```

See [add-config-value.md](./add-config-value.md) for the schema + validation wiring.

## Step 4 — Implement the adapter (the only file that imports the vendor)

```ts
// src/modules/<feature>/adapters/<vendor>.adapter.ts
import { Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { HttpService } from '@nestjs/axios'; // vendor/HTTP client — allowed HERE only
import { firstValueFrom } from 'rxjs';
import { AppLogger } from '@core/logger/app.logger';
import { IntegrationError } from '@core/errors/integration.error';
import vendorConfig from '@config/vendor.config';
import { NotificationPort, SendResult } from '../model/vendor.types';
import { VENDOR_TIMEOUT_MS } from '../model/vendor.constants';

const LOG_PREFIX = '[VendorAdapter]';

@Injectable()
export class VendorAdapter implements NotificationPort {
  constructor(
    private readonly http: HttpService,
    private readonly logger: AppLogger,
    @Inject(vendorConfig.KEY)
    private readonly config: ConfigType<typeof vendorConfig>,
  ) {}

  async send(to: string, body: string): Promise<SendResult> {
    try {
      const response = await firstValueFrom(
        this.http.post<{ id: string }>(
          `${this.config.baseUrl}/messages`,
          { to, body },
          {
            headers: { authorization: `Bearer ${this.config.apiKey}` },
            timeout: VENDOR_TIMEOUT_MS,
          },
        ),
      );
      return { id: response.data.id, accepted: true };
    } catch (error) {
      this.logger.error(`${LOG_PREFIX} send failed`, { to, error });
      throw new IntegrationError('errors.notification.send_failed');
    }
  }
}
```

Decide the failure contract deliberately: throw a typed `AppError` when the caller must know; for best-effort side effects, log and return a degraded result. Never let the raw vendor error reach the client.

## Step 5 — Bind the port to the implementation in a module

Consumers inject the **token**, so the vendor is swappable in one place.

```ts
// src/modules/<feature>/<feature>.module.ts
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { VendorAdapter } from './adapters/vendor.adapter';
import { NOTIFICATION_PORT } from './model/vendor.constants';

@Module({
  imports: [HttpModule],
  providers: [{ provide: NOTIFICATION_PORT, useClass: VendorAdapter }],
  exports: [NOTIFICATION_PORT],
})
export class NotificationModule {}
```

## Step 6 — Consume the port from services/use-cases only

```ts
// src/modules/<feature>/application/<feature>.service.ts
@Injectable()
export class AccountService {
  constructor(
    @Inject(NOTIFICATION_PORT) private readonly notifier: NotificationPort,
  ) {}

  async notify(account: Account): Promise<void> {
    await this.notifier.send(account.phone, account.greeting);
  }
}
```

No deep raw-SDK imports anywhere outside the adapter. If multiple modules need it, export the token from the owning module's `index.ts` public surface.

## Step 7 — Moving EXISTING raw usage behind an adapter

If the vendor is already imported in business code:

1. Count call sites: `rg "from ['\"]<package>" src`.
2. Create the port (Step 2) + adapter (Step 4) capturing the union of those calls.
3. Replace call sites in small, tested batches — service by service.
4. Run `npm run lint`; the architecture rule now flags any remaining raw import.
5. Record any temporarily-tolerated direct import (with an owner + removal date) in [library-boundaries.md](../memory/library-boundaries.md).

## Step 8 — Document the boundary

Record in [library-boundaries.md](../memory/library-boundaries.md): package + version, why chosen (Step 1 findings), adapter path, port interface, config keys, the failure mode, and any new `errors.<feature>.*` keys (add a string per supported locale via [add-i18n-message-key.md](./add-i18n-message-key.md)).

---

## Tests FIRST

Write the test before the adapter. Mock the vendor client — **never call the real service.** Cover:

- request shape (URL, headers, body, timeout);
- success mapping into the port's return type;
- the catch branch (vendor failure ⇒ the typed `AppError` with the correct `messageKey`);
- a consumer test injecting a **fake port** (proves business code never touches the vendor).

```ts
const port: NotificationPort = {
  send: vi.fn().mockResolvedValue({ id: 'x', accepted: true }),
};
```

The catch branch is the highest-risk path — keep touched-module coverage ≥ 95% (critical paths near 100%).

## Quality gates

```bash
npm run lint
npm run typecheck
npm run test
npm run test:coverage
npm run build
```

Never bypass Husky with `--no-verify`.

## Pitfalls

- **Raw vendor import in a service/controller/repository** ⇒ ESLint failure. The adapter is the only legal home.
- **Leaking the vendor type** through the port's return value re-couples consumers — map to your own type.
- **`process.env` inside the adapter** ⇒ move it into a `config/` namespace.
- **No timeout / unbounded retry** ⇒ a slow provider stalls the request pool. Constants live in `*.constants.ts`.
- **Raw vendor error thrown to the client** ⇒ wrap it in an `AppError` so the filter sanitizes it.
- **Injecting the concrete adapter class** instead of the token ⇒ loses swappability; inject `NOTIFICATION_PORT`.
- **Fire-and-forget side effect that throws** ⇒ the handler must swallow its own error (rules 38).

## Related

[create-service.md](./create-service.md) · [create-module.md](./create-module.md) · [create-error.md](./create-error.md) · [add-config-value.md](./add-config-value.md) · [add-i18n-message-key.md](./add-i18n-message-key.md) · [12-library-wrapping-and-adapters.md](../rules/12-library-wrapping-and-adapters.md) · [library-boundaries.md](../memory/library-boundaries.md)
