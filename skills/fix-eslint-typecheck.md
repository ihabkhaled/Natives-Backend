# Skill: Fix ESLint & Typecheck Failures

> Drive `eslint` and `tsgo --noEmit` to **zero** by fixing the root cause — never by disabling. Implements the canon in [00-non-negotiable-rules.md](../rules/00-non-negotiable-rules.md) and [13-eslint-and-typescript.md](../rules/13-eslint-and-typescript.md).

## Rules this skill enforces

- **No `any`** ([00](../rules/00-non-negotiable-rules.md) rule 3) — `unknown` + narrowing or a real type.
- **No suppressions** — no `// eslint-disable`, no `@ts-ignore` (rules 4–5); `@ts-expect-error` only with a linked decision file (rule 6), which almost never applies.
- **No non-null `!`** (rule 7) — guards, `??`, `?.`.
- **No magic strings / domain string comparisons** (rules 8–9) — compare enum members.
- **Lint floor: 0 errors AND 0 warnings** (rule 2); **typecheck: 0 errors**, project-wide.
- Fixes must keep **layer discipline** intact — never "fix" an architecture-plugin error by moving the violation, fix the design.

---

## Tests FIRST

A type/lint fix is still a behavior change if it alters narrowing, defaults, or control flow. Before touching code, run the affected module's tests and keep them green throughout. If your fix changes a value path (e.g. swapping `||` → `??`, narrowing a nullable), add or adjust a test that pins the new behavior *first*. See [write-unit-tests.md](./write-unit-tests.md).

---

## Steps

### 1. Run the gates and read the FIRST error

```bash
npm run typecheck    # tsgo --noEmit, project-wide — NOT just staged files
npm run lint         # eslint . → must be 0 errors AND 0 warnings
npm run lint:fix     # auto-fixes formatting, import-type, simple-import-sort, etc.
```

Iterate on one file at a time, but always re-run the full gate before "done":

```bash
npx eslint src/modules/<feature>/application/<feature>.service.ts
```

> `typecheck` is **whole-project**. A pre-existing error in a file you never touched still blocks your commit — fix it or include the fix. Never suppress it. Read the *first* error; later ones are usually cascades of it.

### 2. Map the error to a known fix (Section "Common errors"), apply at the root

Resolve the type or the design — not the linter. Re-run `typecheck` then `lint`. Repeat until both are clean.

### 3. If the fix is a recurring pattern, record it

Add a durable, abstract note to [known-pitfalls.md](../memory/known-pitfalls.md) so the next engineer (or agent) finds it.

---

## Common errors → root-cause fixes

### `no-explicit-any` — ban `any` at the boundary

```ts
// DON'T
function parse(raw: any): Account { return raw; }

// DO — accept unknown, narrow with a type guard
function parse(raw: unknown): Account {
  if (!isAccount(raw)) throw new AccountInvalidError();
  return raw;
}
```

### `noUncheckedIndexedAccess` — indexed access is `T | undefined`

```ts
const first = items[0];           // type: Item | undefined
if (first === undefined) return;  // narrow before use — never `first!`
useItem(first);
```

### `exactOptionalPropertyTypes` — reject explicit `undefined` (TS2375/2379)

```ts
// DON'T — passing undefined to `actorId?: string`
const payload = { actorId: maybeUndefined };

// DO — conditionally spread; don't widen the field to `string | undefined`
const payload = { ...(actorId === undefined ? {} : { actorId }) };
```

### `useUnknownInCatchVariables` — `catch (error: unknown)`

```ts
try {
  await this.repository.save(entity);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  this.logger.error('save failed', { message }); // logger adapter, never console.*
  throw new OrderPersistenceError();
}
```

### `no-unsafe-enum-comparison` — comparing an enum to a raw string

```ts
// DON'T
if (order.status === 'draft') { /* ... */ }

// DO — import the enum, compare to its member (rules 8–9)
if (order.status === OrderStatus.DRAFT) { /* ... */ }
```

### `switch-exhaustiveness-check` — handle every enum case

```ts
function label(status: OrderStatus): string {
  switch (status) {
    case OrderStatus.DRAFT: return MESSAGE_KEYS.orderDraft;
    case OrderStatus.SHIPPED: return MESSAGE_KEYS.orderShipped;
    default: { const _exhaustive: never = status; return _exhaustive; }
  }
}
```

### `no-unnecessary-condition` — redundant guard after narrowing

```ts
// DON'T — TS already proved `account` is non-null
if (account && account.id) { /* ... */ }

// DO — trust the type system
if (account.id.length > 0) { /* ... */ }
```

### `explicit-function-return-type` — declare return types

```ts
// DON'T
async findById(id: string) { return this.repository.findById(id); }

// DO — public surfaces carry explicit, typed returns
async findById(id: string): Promise<Account | null> {
  return this.repository.findById(id);
}
```

### `consistent-type-imports` / `-exports` — `lint:fix` applies these

```ts
import type { Account } from '@modules/account';
import { ACCOUNT_LIMIT, type AccountFilter } from './account.constants';
```

### `architecture/no-restricted-layer-imports` — wrong-layer import

Don't relocate the import to dodge the rule — fix the layering.

```ts
// DON'T — controller importing the repository (banned)
import { OrderRepository } from '../infrastructure/order.repository';

// DO — controller delegates to the application layer; the service owns the repo
constructor(private readonly orders: OrderService) {}
```

Same shape for: use-case ⇏ controller/api-dto, service ⇏ controller, repository ⇏ service/use-case, vendor SDK only inside `adapters/`, `process.env` only in `config/`/`bootstrap/`. The error is telling you the responsibility lives in the wrong file.

### `no-restricted-syntax` — inline declaration or banned construct

```ts
// DON'T — inline interface in a service (banned)
interface Row { id: string; }

// DO — move it to model/<feature>.types.ts and import it
import type { Row } from '../model/<feature>.types';
```

Inside services, `Promise.all | allSettled | any | race` are banned — escalate concurrent multi-step work to a **use case** (see [create-use-case.md](./create-use-case.md)), don't fan out in a service.

### `max-lines-per-function` (services, 20 lines) / `controller-no-logic`

Don't compress lines to pass the count. Extract validation, mapping, and policy into `lib/` or `domain/`, or escalate to a use case. See [decompose-large-file.md](./decompose-large-file.md).

### Other frequent flags

- `prefer-nullish-coalescing`: `??` not `||` for null/undefined defaults (changes behavior on falsy `0`/`''` — pin with a test).
- `prefer-optional-chain`: `a?.b?.c` not `a && a.b && a.b.c`.
- `restrict-template-expressions`: only `number`/`boolean` interpolate freely; wrap objects in `JSON.stringify(...)` or use an explicit field.
- `no-floating-promises`: `await` it, or `void` it with deliberate error handling.
- `return-await`: `return await promise;` inside `try`.
- `require-array-sort-compare`: `arr.sort((a, b) => a - b)`.
- `unicorn/filename-case`: files are `kebab-case`.

---

## Last resort: `@ts-expect-error`

Permissible **only** with a dedicated, linked decision file justifying it. In practice: don't. A real type-system limitation is almost always solvable with a narrow, typed cast through `unknown` at a single isolated boundary. If you believe you need a disable, escalate the design instead — a suppression rots silently and the next change inherits the lie.

---

## Quality gates (all green before "done")

```bash
npm run lint            # 0 errors AND 0 warnings
npm run typecheck       # tsgo --noEmit, project-wide, 0 errors
npm run test            # affected + adjacent suites pass
npm run test:coverage   # touched-module floor (95%) still met
npm run build           # compiles clean
```

No `eslint-disable`, `@ts-ignore`, or `@ts-expect-error` introduced. Never bypass hooks with `--no-verify`.

---

## Pitfalls

- **Suppressing instead of fixing.** A disable comment moves the failure downstream; the root cause stays. Fix the type or the design.
- **Widening a type to silence an error.** Turning `string` into `string | undefined` (or anything into `any`) trades a compile error for a runtime bug. Narrow, don't widen.
- **Relocating an import to dodge the architecture plugin.** The plugin is detecting a design flaw — fix the layering, don't smuggle the violation into a "legal" file.
- **Compressing lines to beat `max-lines-per-function`.** Line count is a proxy for doing too much. Extract or escalate to a use case.
- **Treating `lint:fix` as the fix.** It handles formatting and import order only; logic and type errors still need a real fix.
- **Ignoring project-wide typecheck failures in untouched files.** They block your commit too — include the fix.
- **`||` → `??` without a test.** The behavior differs on falsy-but-valid values (`0`, `''`, `false`). Pin the intended default with a test first.
- **Mass-fixing the cascade.** Fix the first error and re-run; most of the rest disappear.

---

## Related

[00-non-negotiable-rules.md](../rules/00-non-negotiable-rules.md) · [13-eslint-and-typescript.md](../rules/13-eslint-and-typescript.md) · [06-types-enums-constants.md](../rules/06-types-enums-constants.md) · [decompose-large-file.md](./decompose-large-file.md) · [create-use-case.md](./create-use-case.md) · [write-unit-tests.md](./write-unit-tests.md) · [final-validation.md](./final-validation.md) · [known-pitfalls.md](../memory/known-pitfalls.md) · [/context/stack-and-toolchain.md](../context/stack-and-toolchain.md)
