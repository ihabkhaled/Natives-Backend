# Unit Testing Standard

> The house standard for unit tests in this workspace: **Vitest 4 + `@nestjs/testing`**, one unit in isolation, mocked at every layer boundary, AAA structure, deterministic, branch-complete. Implements the testing canon in [/rules/11-testing-and-coverage.md](../rules/11-testing-and-coverage.md) and the strategy in [testing-strategy.md](./testing-strategy.md); the recipe for writing them is [/skills/write-unit-tests.md](../skills/write-unit-tests.md).

A unit test proves **one unit** — a service, use case, domain policy, mapper, guard, pipe, or interceptor — with every collaborator across a layer line replaced by a double. It never opens a real database, cache, broker, HTTP server, clock, or external API. It is the fastest feedback loop and carries the bulk of the 95% coverage floor. The layer above is the [integration standard](./integration-testing-standard.md) (the real Nest pipeline via supertest); above that, the [e2e standard](./e2e-testing-standard.md).

A function without a test is unfinished work, not a future task. 100% line coverage with zero scenario coverage is paperwork — see [coverage-policy.md](./coverage-policy.md).

---

## 1. What is a unit (and what to mock)

The unit is the **system under test (SUT)**. Everything it calls across a layer boundary is a double. Mock the dependencies, **never the SUT**, and never the pure logic you are trying to prove.

| Unit under test                                 | Mock these (boundaries)                                           | Never mock                                  |
| ----------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------- |
| `<feature>.service.ts`                          | repository, adapters, other modules' public surface, logger       | the domain policies it calls                |
| `<action>.use-case.ts`                          | the services it orchestrates, transaction runner, event publisher | —                                           |
| `domain/*.policy.ts` (entities, state machines) | nothing — pure input → output                                     | everything                                  |
| `lib/` mapper / formatter / helper              | nothing if pure                                                   | —                                           |
| guard / pipe / interceptor                      | reflector, the service it queries                                 | the framework itself                        |
| `adapters/<vendor>.adapter.ts`                  | the vendor SDK (doubled inside the adapter)                       | the adapter's own mapping/error translation |

**Mock at the right depth.** A service test doubles the repository and exercises the real service + real domain policy. If you mock the domain policy too, the test asserts nothing about the decision it claims to verify.

---

## 2. Build the SUT with the NestJS testing module

Wire DI exactly as production with `Test.createTestingModule`, overriding each boundary with a **typed** double. Never `new Service(...)` with an untyped blob — you lose DI parity and silently miss provider-wiring bugs.

```typescript
// DO — real SUT, doubled boundary, typed mocks, reset between cases
import { Test } from '@nestjs/testing';
import { OrderService } from './order.service';
import { OrderRepository } from '../infrastructure/order.repository';
import { AppLogger } from '@core/logger';
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
      providers: [
        OrderService,
        { provide: OrderRepository, useValue: repo },
        { provide: AppLogger, useValue: { info: vi.fn(), error: vi.fn() } },
      ],
    }).compile();
    service = moduleRef.get(OrderService);
  });

  afterEach(() => vi.clearAllMocks()); // reset impls + call history every test
});
```

```typescript
// DON'T — no DI, untyped blob, leaks state, uses `any`
const service = new OrderService({ findById: () => null } as any); // banned
```

Pure domain policies need no module at all — instantiate or call directly. These are the cheapest, most valuable tests.

```typescript
// DO — pure policy: feed inputs, assert outputs and thrown invariants
it('rejects an illegal state transition', () => {
  expect(() => assertTransition(OrderStatus.CLOSED, OrderStatus.DRAFT)).toThrow(
    InvalidTransitionError,
  );
});
```

---

## 3. AAA structure — one behavior per test

Every `it` follows **Arrange → Act → Assert**, separated by blank lines, with exactly one behavior under test. Assert both the **return value** and the **collaborator interaction** — never only that a function ran.

```typescript
// DO — clear AAA, asserts the result AND the call
it('returns the order for its owner', async () => {
  // Arrange
  const order = { id: 'order-1', ownerId: 'user-1', status: OrderStatus.DRAFT };
  repo.findById.mockResolvedValue(order);

  // Act
  const result = await service.getOwned('order-1', 'user-1');

  // Assert
  expect(result.status).toBe(OrderStatus.DRAFT); // enum member, never 'DRAFT'
  expect(repo.findById).toHaveBeenCalledWith('order-1');
});
```

Keep fixtures minimal and realistic. Factor shared fixtures into builders ([test-data-and-fixtures.md](./test-data-and-fixtures.md)); never share **mutable** state between tests.

---

## 4. Assert typed errors — class AND messageKey

Every `AppError` branch (not-found, forbidden, conflict, validation, business-rule) gets a dedicated case pinning both the **error class** and its **`messageKey`** of the form `errors.<feature>.<key>`. Assert rejections with `rejects.toBeInstanceOf(...)`, never bare truthiness.

```typescript
// DO — type and messageKey both pinned
it('throws OrderNotFoundError when the order is missing', async () => {
  repo.findById.mockResolvedValue(null);

  await expect(service.getOwned('missing', 'user-1')).rejects.toBeInstanceOf(
    OrderNotFoundError,
  );
  await expect(service.getOwned('missing', 'user-1')).rejects.toMatchObject({
    messageKey: 'errors.order.notFound',
  });
});

it('throws OrderForbiddenError on cross-owner access', async () => {
  repo.findById.mockResolvedValue({
    id: 'order-1',
    ownerId: 'user-2',
    status: OrderStatus.DRAFT,
  });

  await expect(service.getOwned('order-1', 'user-1')).rejects.toBeInstanceOf(
    OrderForbiddenError,
  );
});
```

See [/skills/create-error.md](../skills/create-error.md) and [/rules/18-error-handling-and-exceptions.md](../rules/18-error-handling-and-exceptions.md).

---

## 5. Branch coverage — the real target

Line coverage is a side effect; **branch + scenario coverage** is the goal. Exercise both sides of every `if`, `else`, `switch` arm, ternary, `??`, `?.`, and guard clause. A function can hit 100% lines with one happy-path call and still leave every error path untested — that is where the bugs live.

Aim for **≥ 10 cases per service / use case**. Each suite must include these unless explicitly justified in review:

| Scenario                            | What to assert                                                       |
| ----------------------------------- | -------------------------------------------------------------------- |
| Happy path                          | expected return; correct collaborator args                           |
| Validation / business rule          | invalid state/transition rejects the typed error                     |
| Not found                           | repo returns `null` → typed not-found `AppError`                     |
| Ownership / tenant (IDOR)           | actor A cannot read/mutate actor B's resource by id                  |
| Permission / RBAC                   | authenticated-but-unauthorized path rejects                          |
| Boundary: at / below / above limits | off-by-one correct; the hard list cap (100) enforced                 |
| Empty / null                        | `[]` returns `[]` (not null, not a crash); null handled              |
| Idempotent / no-op                  | the path that skips a query (same value, already applied)            |
| Branch flag true/false              | e.g. `includeArchived` on vs off — assert the arg to the repo        |
| Optional field present/absent       | `undefined` stripped vs included                                     |
| Collaborator failure                | repo/adapter rejects → propagated, wrapped, or swallowed as designed |

Per-unit thresholds and exclusions (`*.types.ts`, `*.enums.ts`, `*.constants.ts`, barrels, `model/**`, migrations) live in [coverage-policy.md](./coverage-policy.md). Don't pad data-only files — spend the effort on logic.

---

## 6. Repositories never throw; services decide

Repository unit tests verify **query shape and pass-through**, not real database behavior — the ORM driver (TypeORM / Prisma / Mongoose / Sequelize are interchangeable examples) is doubled. The contract: a repository returns data on hit, returns `null` / `[]` on miss, and **never throws**; the service decides what a miss means.

```typescript
// DO — repository returns null on miss, never throws; query stays bounded
it('returns null when the order is not found', async () => {
  driver.findOne.mockResolvedValue(null);

  await expect(repo.findById('order-1')).resolves.toBeNull();
});

it('caps a list query at the hard maximum of 100', async () => {
  driver.find.mockResolvedValue([]);

  await repo.list({ limit: 5000 });

  expect(driver.find).toHaveBeenCalledWith(
    expect.objectContaining({ take: MAX_LIST_LIMIT }),
  );
});
```

Proving the query actually executes against a real engine is an **integration** concern — see [integration-testing-standard.md](./integration-testing-standard.md) and [/rules/04-repositories-and-persistence.md](../rules/04-repositories-and-persistence.md).

---

## 7. Fail-safe side effects and async discipline

A fire-and-forget handler (event subscriber, notification) must **swallow its own error** and never reject the caller. Prove it.

```typescript
// DO — side-effect failure is logged and swallowed, workflow keeps going
it('swallows a notification failure and resolves without rejecting', async () => {
  notifier.send.mockRejectedValue(new Error('provider down'));

  await expect(
    handler.onOrderPlaced(orderPlacedEvent),
  ).resolves.toBeUndefined();
  expect(logger.error).toHaveBeenCalled();
});
```

Always `await` the promise under test and drive sequential reads with `mockResolvedValueOnce` chains; assert call **order and arguments**, not only counts. See [/rules/19-async-events-and-jobs.md](../rules/19-async-events-and-jobs.md) and [/rules/10-reliability-and-durability.md](../rules/10-reliability-and-durability.md).

---

## 8. Determinism — flaky tests are defects

Never rerun-until-green, never paper over timing with `sleep`. Control everything non-deterministic.

- **Time:** `vi.useFakeTimers()` / `vi.setSystemTime(...)`; restore in `afterEach`. Never assert against live `Date.now()`.
- **Randomness:** inject the id/token generator and stub it; never assert against real `randomUUID` / `Math.random`.
- **No real I/O:** no network, real clock, or real DB in a unit test — those belong to integration/e2e behind a controlled instance.
- **Isolation:** `vi.clearAllMocks()` in `beforeEach`/`afterEach`. A test that passes only after another test is broken.

```typescript
// DO — frozen clock, restored afterwards
beforeEach(() =>
  vi.useFakeTimers().setSystemTime(new Date('2025-01-01T00:00:00Z')),
);
afterEach(() => vi.useRealTimers());
```

---

## 9. Naming

Format: `should [do X] when [condition Y]` — readable as a behavior from the description alone. `describe` blocks nest **class → method**.

```typescript
// GOOD
describe('OrderService', () => {
  describe('getOwned', () => {
    it('returns the order when it exists and belongs to the caller', () => {});
    it('throws OrderNotFoundError when the order does not exist', () => {});
    it('throws OrderForbiddenError when the order belongs to another user', () => {});
    it('caps the list at 100 when a larger limit is requested', () => {});
  });
});

// BAD — vague, untestable from the name, or lying about the assertion
it('should work', () => {});
it('handles error', () => {});
it('returns 400 for invalid input', () => {}); // then asserts a 200 — worse than no test
```

A test description that lies about its assertion is worse than no test: it manufactures false confidence.

---

## 10. The three failures of fake testing — avoid

```typescript
// FAKE 1 — testing the mock: asserts a call happened, nothing about the result or logic
it('calls the repository', async () => {
  await service.getOwned('order-1', 'user-1');
  expect(repo.findById).toHaveBeenCalled(); // proves you called a function, not behavior
});

// FAKE 2 — pure pass-through: mock returns X, assert X back; no branch exercised
it('returns the order', async () => {
  repo.findById.mockResolvedValue(theOrder);
  expect(await service.getOwned('order-1', 'user-1')).toBe(theOrder); // ownership check never tested
});

// FAKE 3 — happy-path-only on a method with five error paths
it('creates an order', async () => {
  repo.save.mockResolvedValue(created);
  expect(await service.create(dto, 'user-1')).toBe(created);
  // missing: duplicate, invalid state, forbidden, validation, persistence failure
});
```

The fix is always **more scenarios at the right boundary**, never a lower threshold.

---

## File placement & banned tokens

- Tests live beside the SUT: `<name>.spec.ts` next to `<name>.ts` (mirrors the module anatomy in [/context/architecture-map.md](../context/architecture-map.md)).
- Type doubles to the collaborator interface; **never** `any`, `@ts-ignore`, `!`, or `eslint-disable` — strict TS and the non-negotiable rules ([/rules/00-non-negotiable-rules.md](../rules/00-non-negotiable-rules.md)) hold in tests too.

```text
DON'T:  jest / jest.mock / jest.fn / jest.spyOn / ts-jest / @jest/globals / tsc --noEmit / any / @ts-ignore / eslint-disable
DO:     vi.mock / vi.fn / vi.spyOn / vi.hoisted / vi.useFakeTimers / npm run test* / tsgo --noEmit
```

---

## Quality gate

```bash
npm run lint            # 0 errors AND 0 warnings
npm run typecheck       # tsgo --noEmit, project-wide
npm run test            # vitest run — full suite
npm run test:coverage   # statements/branches/functions/lines ≥ 95% (critical paths ~100%)
npm run build           # compiles clean
```

Narrow coverage to the unit you touched to see the exact metrics the gate enforces, then close every uncovered branch:

```bash
npx vitest run src/modules/order/application/order.service.spec.ts \
  --coverage --coverage.include="src/modules/order/application/order.service.ts"
```

Never bypass a hook with `--no-verify`. A green run is not proof of correctness — confirm each branch and each `AppError` path has its own assertion.

---

## Checklist

- [ ] Test written/updated **first**; bug fixes ship a reproducing regression test
- [ ] SUT built via `Test.createTestingModule` with typed provider overrides — no `new Service()` blob
- [ ] Mocked at the **boundary**; never the SUT, never the pure domain policy under test
- [ ] AAA structure; one behavior per `it`; asserts return value **and** collaborator call
- [ ] Every `AppError` branch pins the error **class** and its `messageKey`
- [ ] Scenarios cover happy + validation + not-found + ownership + permission + boundary + empty/null + failure
- [ ] Repository tests prove null/`[]` on miss (never throw) and the hard list cap (100)
- [ ] Fire-and-forget handlers asserted to swallow their own errors
- [ ] Deterministic: time and randomness controlled; `vi.clearAllMocks()` per test; zero arbitrary sleeps
- [ ] Enum members / named constants in assertions — no raw literals
- [ ] Touched-module coverage ≥ 95% (critical paths near 100%)
- [ ] `npm run lint` / `typecheck` / `test` / `test:coverage` / `build` all green

**Related:** [testing-strategy.md](./testing-strategy.md) · [integration-testing-standard.md](./integration-testing-standard.md) · [e2e-testing-standard.md](./e2e-testing-standard.md) · [coverage-policy.md](./coverage-policy.md) · [test-data-and-fixtures.md](./test-data-and-fixtures.md) · [quality-gates.md](./quality-gates.md) · [/rules/11-testing-and-coverage.md](../rules/11-testing-and-coverage.md) · [/skills/write-unit-tests.md](../skills/write-unit-tests.md) · [/memory/testing-strategy.md](../memory/testing-strategy.md)
