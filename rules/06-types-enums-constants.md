# 06 — Types, Enums & Constants

> The zero-inline policy in depth. Every type, enum, and reusable constant lives in its own dedicated file; every domain value is an enum member, never a string literal. Implements rules 8–16 of [00-non-negotiable-rules.md](./00-non-negotiable-rules.md) and the conventions in [/context/architecture-map.md](../context/architecture-map.md).

Related: [05-dto-and-validation.md](./05-dto-and-validation.md) · [04-repositories-and-persistence.md](./04-repositories-and-persistence.md) · [01-architecture-and-module-boundaries.md](./01-architecture-and-module-boundaries.md) · [16-i18n-and-messaging.md](./16-i18n-and-messaging.md) · [13-eslint-and-typescript.md](./13-eslint-and-typescript.md) · [/memory/known-pitfalls.md](../memory/known-pitfalls.md).

---

## 1. The zero-inline policy (rules 10–16)

A `*.controller.ts`, `*.service.ts`, `*.use-case.ts`, `*.repository.ts`, guard, interceptor, pipe, or adapter contains **only its primary class/function**. Every reusable type, enum, constant, DTO, request/response shape, and config map is extracted to a dedicated file and imported. The custom `architecture/no-inline-layer-declarations` rule mechanically rejects module-level `type`/`interface`/`enum`/`const`/`function` declarations inside controllers, services, use cases, repositories, adapters, guards, interceptors, and pipes (only a file-local `LOG_PREFIX` const is allowed).

| Artifact                       | Goes in                                                                    | Example path                                               |
| ------------------------------ | -------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Types & interfaces             | `model/<feature>.types.ts` or `@shared/types`                              | `src/modules/order/model/order.types.ts`                   |
| Enums                          | `@shared/enums/<name>.enum.ts` (+ barrel) or `model/<feature>.enums.ts`    | `src/shared/enums/order-status.enum.ts`                    |
| Constants / config maps        | `model/<feature>.constants.ts` or `@shared/constants/<topic>.constants.ts` | `src/modules/order/model/order-sort.constants.ts`          |
| DTOs & validation schemas      | `api/dto/<name>.dto.ts`                                                    | see [05-dto-and-validation.md](./05-dto-and-validation.md) |
| Helpers / mappers / formatters | `lib/<feature>.helpers.ts`, `lib/<feature>.mappers.ts`                     | —                                                          |

### DTOs vs. model types

API DTOs live in `api/dto/` and are owned by the HTTP boundary. The application layer should prefer **model types** (`model/<feature>.types.ts`) for its input contracts so that services and use cases are not coupled to request/response shapes. A service may return a response DTO when the mapper in `lib/` produces it, but it should not import API DTOs unnecessarily for input. Use cases and domain files must never import API DTOs; this is enforced by `architecture/no-dto-import-in-domain-or-use-case`.

```ts
// Don't — interface declared inside the repository file (rules 10–16)
// order.repository.ts
interface OrderUpdateData {
  status: OrderStatus;
  fulfilledAt?: Date;
}

// Do — import it from the module's types file
import type { OrderUpdateData } from '@modules/order/model/order.types';
```

The only literal that may stay file-local is a logging label:

```ts
const LOG_PREFIX = '[Order:Service]'; // ✓ logging convenience, tied to this one file
```

---

## 2. Single-value constants are constants too (rule 13, STRICT)

The most-missed half of the rule: a **single named value** is still a constant. Any magic number, TTL, timeout, interval, retry/backoff/jitter parameter, i18n `messageKey`, URL/endpoint, header name, cache key, or limit/threshold **MUST** live in a `*.constants.ts` file and be imported. Declaring it at the top of an implementation file — even with a comment — is a violation.

```ts
// Don't — single-value constants squatting in a service / adapter (rules 8, 13, 16)
const SMS_RETRY_JITTER_MS = 500; // ✗ magic number / backoff param
const ORDER_NOT_FOUND_KEY = 'errors.order.notFound'; // ✗ messageKey literal
const SESSION_TTL_SECONDS = 30 * 60; // ✗ TTL
const RATE_LIMIT_HEADER = 'x-ratelimit-remaining'; // ✗ header name
```

```ts
// Do — declare in the owning constants file, import where used
// src/adapters/sms/sms.constants.ts
export const SMS_RETRY_JITTER_MS = 500;
export const SMS_MAX_RETRIES = 3;

// src/modules/order/model/order.constants.ts
export const ORDER_NOT_FOUND_KEY = 'errors.order.notFound';

// src/shared/constants/session.constants.ts
export const SESSION_TTL_SECONDS = 30 * 60;

// src/shared/constants/http-headers.constants.ts
export const RATE_LIMIT_HEADER = 'x-ratelimit-remaining';
```

- Use `UPPER_SNAKE_CASE` for every module-level value constant.
- The only literals that do **not** need extraction: the throwaway numerics `0`, `1`, `-1`, `100`; regex; ORM column-name strings; and the file-local `LOG_PREFIX`.
- `messageKey`s are **value constants** and belong in `*.constants.ts` — not co-mingled with machine error codes or HTTP status maps. See [16-i18n-and-messaging.md](./16-i18n-and-messaging.md).

---

## 3. No magic strings, no domain string comparisons (rules 8, 9)

Any value with domain meaning — status, role, permission, action, event name, entity type, channel, visibility — is an **enum member**, never a raw string. This is the single most-repeated review failure.

```ts
// Don't — raw string compare + magic-string assignment
if (order.status === 'pending') {
  /* … */
}
order.status = 'published';

// Do — compare and assign enum members
import { OrderStatus } from '@shared/enums';
if (order.status === OrderStatus.PENDING) {
  /* … */
}
order.status = OrderStatus.PUBLISHED;
```

- **No string-union types.** `type Status = 'active' | 'inactive'` is banned — declare an enum.
- **No string-literal switch cases, object keys, or event names** for domain concepts — use the member (`case OrderStatus.DRAFT:`, `emit(OrderEvent.PUBLISHED)`).
- **Allowed literals:** `messageKey`s (`'errors.order.notFound'`), log messages/prefixes, regex, ORM column strings, and test descriptions. Everything else is suspect.

---

## 4. Enums: location, barrel, and the `_VALUES` array (rule 12)

Every shared enum lives in `src/shared/enums/` in a kebab-case `<name>.enum.ts` file and is re-exported from the barrel `src/shared/enums/index.ts`. Import everything through the barrel: `import { OrderStatus } from '@shared/enums'`.

Each enum file exports the enum **plus a runtime `_VALUES` array**. Export a typed `as const` tuple as well when a schema validator needs to preserve enum-literal narrowing.

```ts
// src/shared/enums/notification-channel.enum.ts
export enum NotificationChannel {
  EMAIL = 'email',
  SMS = 'sms',
  EMAIL_AND_SMS = 'email_and_sms',
}

// Runtime string tuple — for ORM enum validation and generic runtime checks
export const NOTIFICATION_CHANNEL_VALUES = Object.values(
  NotificationChannel,
) as [string, ...string[]];

// Typed const tuple — preserves enum-literal narrowing for schema validators
export const NOTIFICATION_CHANNELS = [
  NotificationChannel.EMAIL,
  NotificationChannel.SMS,
  NotificationChannel.EMAIL_AND_SMS,
] as const;
```

A minimal enum only needs the enum + `_VALUES`:

```ts
// src/shared/enums/sort-order.enum.ts
export enum SortOrder {
  ASC = 'ASC',
  DESC = 'DESC',
}
export const SORT_ORDER_VALUES = Object.values(SortOrder) as [
  string,
  ...string[],
];
```

```ts
// src/shared/enums/index.ts — the barrel
export * from './notification-channel.enum';
export * from './order-status.enum';
export * from './sort-order.enum';
```

### The schema-narrowing pitfall

`Object.values(Enum) as [string, ...string[]]` **erases** literal types. Feeding the `_VALUES` array into a string-enum validator infers `channel: string`, not `NotificationChannel`, and downstream code typed `(c: NotificationChannel)` then fails the type check.

```ts
// Don't — the _VALUES array loses enum narrowing in the schema
schema.enum(NOTIFICATION_CHANNEL_VALUES); // -> channel: string

// Do (preferred) — use the native-enum validator; no extra tuple needed
channel: nativeEnumValidator(NotificationChannel); // -> channel: NotificationChannel

// Do (when a string-enum validator is unavoidable) — pass the typed const tuple
schema.enum(NOTIFICATION_CHANNELS); // -> channel: NotificationChannel
```

> Rule of thumb: in DTOs, prefer the native-enum validator (`@IsEnum(NotificationChannel)` for class-validator, the native-enum schema for the Zod alternative — see [05-dto-and-validation.md](./05-dto-and-validation.md)). Use the typed `_CHANNELS` tuple only when a string-enum validator is genuinely required. Use the `_VALUES` array for ORM schema `enum:` validation and other runtime checks.

Module-private enums that never cross a boundary may live in `model/<feature>.enums.ts` instead of `@shared/enums`. Promote to the shared barrel the moment a second module needs them.

---

## 5. Constants & config maps (rule 16)

Lookup tables, sort maps, allowed-field lists, permission maps, and state maps live in a constants file — never inline in business logic.

```ts
// src/modules/order/model/order-sort.constants.ts
import type { SortFieldMap } from '@modules/order/model/order.types';

/** Maps client-supplied sort field names to safe, bound DB column paths. */
export const ORDER_SORT_MAP: SortFieldMap = {
  title: 'order.title',
  createdAt: 'order.created_at',
  status: 'order.status',
  total: 'order.total_amount',
};
```

- **Constants may import from types; types must NOT import from constants.** That cycle crashes at module load.
- Module-private constants stay in the module's `model/`; cross-cutting ones go to `src/shared/constants/<topic>.constants.ts`.
- A config map that selects safe values (column names, allowed sort fields) is also a defense against injection — see [08-database-and-injection-safety.md](./08-database-and-injection-safety.md).

---

## 6. The no-duplicate-helper rule — search before you create (rule 13, STRICT)

Before creating **any** new `*.constants.ts` / `*.types.ts` / `*.helpers.ts` / `*.util.ts` file, **search for the file that already owns that concern and extend it.** A parallel file that overlaps an existing one fragments the source of truth, invites drift, and — worst case — ships a subtly-wrong duplicate that silently shadows the correct logic.

**Mandatory pre-flight search:**

```bash
# Shared, cross-cutting owners — check these FIRST
src/shared/utils/        # pagination, response shaping, resource-owner, sort, cookie, …
src/shared/constants/    # cross-cutting value constants & config maps
src/shared/enums/        # the enum barrel — extend it, don't fork it
# Module-local owners — the module already holds its own values
src/modules/<feature>/model/        # <feature>.types.ts | .enums.ts | .constants.ts
src/modules/<feature>/lib/          # mappers, formatters, helpers
# Adapter-local — each adapter keeps one constants file
src/adapters/<vendor>/<vendor>.constants.ts
```

**Decision rules:**

- **One concern → one file.** If `src/shared/utils/resource-owner.util.ts` exports `isResourceOwner`, its throwing variant `assertResourceOwner` goes **into that same file** — not a new `ownership.util.ts`. (A forked helper once shipped a naive ownership check that ignored the tenant/effective-account context and would have wrongly denied legitimate team members.)
- **Co-locate with siblings.** Module-local guard/service constants live next to their siblings — one `model/<feature>.constants.ts`, not a per-file `enrich-user.constants.ts` + `guard.constants.ts` pair.
- **A genuinely-new concern gets one new file.** A brand-new email adapter with no prior constants file legitimately adds `src/adapters/email/email.constants.ts`, mirroring the existing `src/adapters/sms/sms.constants.ts`. The test is "does an existing file already own this concern?" — not "is the name slightly different?".
- **Wrong home ≠ valid home.** Don't drop a `messageKey` into an `error-codes.ts` that holds machine error codes — different concern.

> Decision: **search → found an owner? extend it. No owner? create one descriptively-named file and make it the single home.** Never two files for one concern. Record durable choices in [/memory/known-pitfalls.md](../memory/known-pitfalls.md).

---

## 7. `type` vs `interface`, and type-only imports

- **Prefer `interface` for object shapes** (`consistent-type-definitions`) — they extend cleanly and produce better error messages. Use `type` for unions, intersections, tuples, mapped/conditional types, and function signatures.
- **Use `import type` / `export type` for all type-only imports/exports** (`consistent-type-imports` / `consistent-type-exports` are errors). Inline `import()` type annotations are forbidden — declare a proper top-of-file `import type`.

```ts
// Do — interface for a shape; type for a union; type-only imports are explicit
import type { Repository } from 'the-orm'; // wrapped behind a repository — see rules/04, rules/12
import type { OrderUpdateData } from '@modules/order/model/order.types';

export interface OrderSummary {
  id: string;
  status: OrderStatus;
  total: number;
}

export type SortFieldMap = Record<string, string>;
```

- **`unknown` over `any`** (rule 3). Narrow with type guards; type raw query results with a generic, never `any`.
- **No non-null assertion (`!`)** (rule 7). Use `?.`, `??`, or an explicit guard.
- **`exactOptionalPropertyTypes`** — never pass an explicit `undefined` to an optional field; spread it conditionally (see [05-dto-and-validation.md](./05-dto-and-validation.md)).
- **Method types use property style** — `fn: () => void`, not `fn(): void` (`method-signature-style`).

---

## 8. Naming conventions (rule 6 of the toolchain)

| Kind                                 | Case                                   | Example                                          |
| ------------------------------------ | -------------------------------------- | ------------------------------------------------ |
| Files                                | `kebab-case` (`unicorn/filename-case`) | `order-status.enum.ts`, `order.repository.ts`    |
| Enums / types / interfaces / classes | `PascalCase` (singular)                | `OrderStatus`, `OrderSummary`, `OrderRepository` |
| Enum members                         | `UPPER_SNAKE_CASE`                     | `OrderStatus.PUBLISHED`                          |
| Constants (incl. `_VALUES` / tuples) | `UPPER_SNAKE_CASE`                     | `SORT_ORDER_VALUES`, `ORDER_SORT_MAP`            |
| Variables / functions                | `camelCase`                            | `findActiveByAccountId`                          |
| DTO classes                          | `PascalCase` + `Dto`                   | `CreateOrderDto`                                 |
| Booleans                             | `is` / `has` / `can` / `should` prefix | `isAnonymous`, `canFulfill`                      |

Avoid catch-all filenames (`types.ts`, `utils.ts`, `constants.ts`) at a module root — use descriptive, scoped names (`order.types.ts`, `order-sort.constants.ts`).

---

## 9. Worked example — a feature's `model/` directory

```
src/modules/order/model/
├── order.types.ts        # interface OrderSummary, type SortFieldMap, type OrderUpdateData
├── order.enums.ts        # module-private enums (promote to @shared/enums when shared)
└── order.constants.ts    # ORDER_NOT_FOUND_KEY, ORDER_SORT_MAP, ORDER_DEFAULT_PAGE_SIZE
```

```ts
// order.constants.ts — every reusable value the module needs, in one home
import type { SortFieldMap } from '@modules/order/model/order.types';

export const ORDER_NOT_FOUND_KEY = 'errors.order.notFound';
export const ORDER_CONFLICT_KEY = 'errors.order.statusConflict';
export const ORDER_DEFAULT_PAGE_SIZE = 20;
export const ORDER_MAX_PAGE_SIZE = 100; // hard cap — rules/09
export const ORDER_SORT_MAP: SortFieldMap = {
  title: 'order.title',
  createdAt: 'order.created_at',
  status: 'order.status',
};
```

```ts
// order.service.ts — imports values, declares nothing inline
import { Injectable } from '@nestjs/common';
import { OrderStatus } from '@shared/enums';
import { NotFoundError } from '@core/errors';
import { ORDER_NOT_FOUND_KEY } from '@modules/order/model/order.constants';
import { OrderRepository } from '@modules/order/infrastructure/order.repository';
import type { OrderSummary } from '@modules/order/model/order.types';

@Injectable()
export class OrderService {
  constructor(private readonly orders: OrderRepository) {}

  async getActiveSummary(id: string): Promise<OrderSummary> {
    const order = await this.orders.findById(id);
    if (!order) {
      throw new NotFoundError(ORDER_NOT_FOUND_KEY);
    }
    return {
      id: order.id,
      status: order.status ?? OrderStatus.DRAFT,
      total: order.total,
    };
  }
}
```

---

## 10. Checklist (types/enums/constants PRs)

- [ ] No type/interface/enum/constant/helper function declared inline in a controller/service/use-case/repository/guard/interceptor/pipe/adapter (rules 10–16); only a file-local `LOG_PREFIX` is allowed.
- [ ] Every single-value constant (TTL, timeout, retry/backoff, `messageKey`, URL, header, limit, magic number) lives in a `*.constants.ts` (rule 13).
- [ ] Every domain value is an enum member; no string-literal comparisons, switch cases, unions, object keys, or event names (rules 8, 9).
- [ ] New shared enum is in `@shared/enums/*.enum.ts`, re-exported from `index.ts`, and exports `_VALUES` (+ a typed `as const` tuple if a schema needs it).
- [ ] DTOs use the native-enum validator (or the typed tuple), never the `_VALUES` array, to keep enum narrowing.
- [ ] **No duplicate util/constants/types file** — searched `@shared/utils`, `@shared/constants`, `@shared/enums`, the module's `model/` + `lib/`, and `src/adapters/<vendor>/` first, then extended the existing owner (§ 6).
- [ ] `interface` for object shapes, `type` for unions; `import type`/`export type` used; no `any`, no `!`; constants don't create a cycle with types.
- [ ] `npm run lint` · `npm run typecheck` · `npm run test` green.
