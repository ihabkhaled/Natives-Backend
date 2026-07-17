# Skill: Write Unit Tests

> Author fast, mock-only Vitest unit tests with `@nestjs/testing` that mock at every boundary and exercise every branch to meet the coverage gate. Implements the canon in [/rules/11-testing-and-coverage.md](../rules/11-testing-and-coverage.md) and [/context/stack-and-toolchain.md](../context/stack-and-toolchain.md).

Unit tests prove **one unit in isolation** — a service, use case, domain policy, mapper, guard, or pipe. They never touch a real database, cache, broker, HTTP server, or external API; every collaborator across a layer boundary is a test double. They are the fastest feedback loop and carry the bulk of the 95% coverage floor.

## Rules this skill enforces

- **Tests come first.** No behavior change ships without tests in the same change ([rule 42](../rules/00-non-negotiable-rules.md)).
- **Coverage floor:** 95% statements/functions/lines, 90% measured branches for decorator artifacts, and every real touched branch covered ([/testing/coverage-policy.md](../testing/coverage-policy.md)).
- **Mock at the boundary, not inside the unit** — double the repository/adapter/collaborator, exercise the real logic under test.
- **Every typed `AppError` path is asserted** — error class _and_ `messageKey` ([rule 26](../rules/00-non-negotiable-rules.md), [/skills/create-error.md](./create-error.md)).
- **No magic strings / domain string comparisons** — assert against enum members, never raw literals ([rules 8–9](../rules/00-non-negotiable-rules.md)).
- **No `any`, no `!`, `===`/`!==` only** — strict TS holds in tests too ([rule 1–7](../rules/00-non-negotiable-rules.md)).
- **Vitest only** — `vi.fn()` / `vi.mock()` / `vi.spyOn()`. There is no Jest in this workspace.

---

## Tests FIRST

Write the failing test before the implementation. Map each acceptance criterion and each branch to a named `it(...)`, watch it go red, then make it green. For a bug fix, reproduce the defect as a failing test _first_ so the regression is permanently locked in ([/skills/investigate-production-bug.md](./investigate-production-bug.md)).

---

## Steps

### 1. Locate the unit and its boundaries

Tests live beside the source: `*.spec.ts` next to the file under test (the SUT). Identify every collaborator the unit calls across a layer line — those are your mocks. A service mocks its repository and adapters; a use case mocks the services it orchestrates; a domain policy usually needs **no** mocks (pure input → output).

| Unit under test            | Mock these                                                     | Never mock                  |
| -------------------------- | -------------------------------------------------------------- | --------------------------- |
| `<feature>.service.ts`     | repository, adapters, other modules' public surface            | the domain policies it uses |
| `<action>.use-case.ts`     | the services it calls, the transaction runner, event publisher | —                           |
| `domain/*.policy.ts`       | nothing (pure)                                                 | —                           |
| guard / pipe / interceptor | reflector, the service it queries                              | —                           |

### 2. Build the unit with the NestJS testing module

Prefer `Test.createTestingModule` so DI is wired exactly as production, with provider overrides supplying the doubles. Type the mocks; never reach for `any`.

```ts
// DO — wire DI, override the boundary with a typed mock
import { Test } from '@nestjs/testing';
import { OrderService } from './order.service';
import { OrderRepository } from '../infrastructure/order.repository';
import { OrderStatus } from '../model/order.enums';

type Mocked<T> = { [K in keyof T]: ReturnType<typeof vi.fn> };

describe('OrderService', () => {
  let service: OrderService;
  let repo: Mocked<OrderRepository>;

  beforeEach(async () => {
    repo = {
      findById: vi.fn(),
      save: vi.fn(),
      list: vi.fn(),
    } as Mocked<OrderRepository>;
    const moduleRef = await Test.createTestingModule({
      providers: [OrderService, { provide: OrderRepository, useValue: repo }],
    }).compile();
    service = moduleRef.get(OrderService);
  });

  afterEach(() => vi.clearAllMocks()); // reset call history + impls between cases
});
```

```ts
// DON'T — `new Service()` with an untyped blob, leaking state across tests
const service = new OrderService({ findById: () => null } as any); // no DI, no reset, `any`
```

### 3. Arrange typed fixtures, act, assert

Keep fixtures minimal and realistic. One behavior per `it`; assert both the **return value** and the **collaborator call**.

```ts
it('returns the order for the owner', async () => {
  const order = { id: 'order-1', ownerId: 'user-1', status: OrderStatus.Draft };
  repo.findById.mockResolvedValue(order);

  const result = await service.getOwned('order-1', 'user-1');

  expect(result.status).toBe(OrderStatus.Draft); // enum member, not 'draft'
  expect(repo.findById).toHaveBeenCalledWith('order-1');
});
```

### 4. Assert typed errors — class AND messageKey

Every `AppError` branch (not-found, forbidden, conflict, validation, business-rule) needs a case that pins the error type and its `messageKey`.

```ts
it('throws NotFoundError when the order is missing', async () => {
  repo.findById.mockResolvedValue(null);

  await expect(service.getOwned('missing', 'user-1')).rejects.toBeInstanceOf(
    NotFoundError,
  );
  await expect(service.getOwned('missing', 'user-1')).rejects.toMatchObject({
    messageKey: 'errors.order.notFound',
  });
});

it('throws ForbiddenError on cross-owner access', async () => {
  repo.findById.mockResolvedValue({
    id: 'order-1',
    ownerId: 'user-2',
    status: OrderStatus.Draft,
  });
  await expect(service.getOwned('order-1', 'user-1')).rejects.toBeInstanceOf(
    ForbiddenError,
  );
});
```

### 5. Cover every branch

Coverage is earned by exercising both sides of every `if`, `??`, `?.`, guard clause, ternary, and `switch` arm. Aim for **≥ 10 cases per service/use case**.

| Bucket                        | What to assert                                                         |
| ----------------------------- | ---------------------------------------------------------------------- |
| Happy path                    | returns expected value; collaborator called with expected args         |
| Not-found                     | rejects `NotFoundError` when the repo returns `null`                   |
| Conflict / duplicate          | rejects `ConflictError` when a uniqueness check finds a row            |
| Forbidden / ownership         | rejects `ForbiddenError` on cross-owner / cross-tenant access          |
| Validation / business-rule    | rejects the typed error for invalid state transitions                  |
| Branch: flag true/false       | e.g. `includeArchived` on vs off — assert the arg passed to the repo   |
| Optional field present/absent | `undefined` stripped vs included                                       |
| Empty result                  | `[]` / `total: 0` handled without throwing                             |
| Idempotent / no-op            | the path that skips a query (same value, already-applied)              |
| Collaborator failure          | repo/adapter rejects → error propagates or is wrapped to an `AppError` |

### 6. Drive sequential and conditional collaborator calls

Use `mockResolvedValueOnce` chains for read-modify-read flows; assert call **order** and **arguments**, not just counts.

```ts
it('reloads after update', async () => {
  repo.findById
    .mockResolvedValueOnce({ id: 'order-1', status: OrderStatus.Draft })
    .mockResolvedValueOnce({ id: 'order-1', status: OrderStatus.Submitted });
  repo.save.mockResolvedValue(undefined);

  const result = await service.submit('order-1', 'user-1');

  expect(repo.save).toHaveBeenCalledWith(
    expect.objectContaining({ status: OrderStatus.Submitted }),
  );
  expect(result.status).toBe(OrderStatus.Submitted);
});
```

### 7. Test pure domain policies directly

No DI, no mocks — feed inputs, assert outputs and thrown invariants. These are the cheapest and most valuable tests.

```ts
it('rejects an illegal state transition', () => {
  expect(() => assertTransition(OrderStatus.Closed, OrderStatus.Draft)).toThrow(
    InvalidTransitionError,
  );
});
```

### 8. Control time and randomness for determinism

Flaky tests are defects. Fake timers and clocks; inject randomness so it can be stubbed.

```ts
beforeEach(() =>
  vi.useFakeTimers().setSystemTime(new Date('2025-01-01T00:00:00Z')),
);
afterEach(() => vi.useRealTimers());
```

### 9. Verify per-file coverage on the unit you touched

Narrow the report to the SUT so you see the exact metrics the gate enforces, then close every uncovered line/branch.

```bash
npx vitest run src/modules/order/application/order.service.spec.ts \
  --coverage --coverage.include="src/modules/order/application/order.service.ts"
```

---

## Quality gate

```bash
npm run lint            # 0 errors AND 0 warnings
npm run typecheck       # tsc --noEmit (TypeScript 7), project-wide
npm run test            # vitest
npm run test:coverage   # statements/functions/lines ≥95%; measured branches ≥90%; real critical branches ~100%
npm run build           # compiles clean
```

Never bypass a hook with `--no-verify`. A green run is not proof of correctness — confirm each branch and error path has a dedicated assertion.

---

## Pitfalls

- **Forgetting `vi.clearAllMocks()`** in `afterEach`/`beforeEach` — call counts and stubbed return values leak across cases and produce false greens.
- **Mocking too deep.** Mock at the boundary (repository, adapter). If you mock the very logic you claim to test, the test proves nothing — see [/skills/write-integration-tests.md](./write-integration-tests.md) for cross-layer coverage.
- **Asserting raw strings/numbers.** Compare against enum members and named constants from `model/` and `@shared/enums`; raw literals drift from the SUT's domain types.
- **`new Service()` instead of the testing module.** You lose DI parity and silently miss provider wiring bugs; use `Test.createTestingModule` with overrides.
- **Untyped doubles (`as any`).** Banned. Type the mock to the collaborator's interface so a contract change breaks the test, not production.
- **Only the happy path.** The happy path is one case; the branches, the empty results, and every `AppError` are where regressions hide.
- **Coverage chasing on data-only files.** `model/*.types.ts`, `*.enums.ts`, `*.constants.ts`, DTOs, and migrations are excluded — don't pad them; spend the effort on logic.
- **Real I/O sneaking in.** A unit test that opens a connection or hits the network isn't a unit test — move it to integration and stub the boundary here.
- **Non-deterministic `Date.now()`/`Math.random()`.** Fake the clock and inject randomness or the suite flakes under load.

---

**Related:** [/rules/11-testing-and-coverage.md](../rules/11-testing-and-coverage.md) · [/testing/unit-testing-standard.md](../testing/unit-testing-standard.md) · [/testing/coverage-policy.md](../testing/coverage-policy.md) · [/skills/write-integration-tests.md](./write-integration-tests.md) · [/skills/write-e2e-tests.md](./write-e2e-tests.md) · [/skills/create-service.md](./create-service.md) · [/skills/create-error.md](./create-error.md) · [/skills/fix-eslint-typecheck.md](./fix-eslint-typecheck.md) · [/memory/known-pitfalls.md](../memory/known-pitfalls.md)
