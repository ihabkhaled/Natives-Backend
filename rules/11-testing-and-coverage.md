# 11 — Testing & Coverage

> Tests are the proof a change is safe — written **first**, run at every gate, and reviewed per touched logic file. This file implements non-negotiable rule **42** (behavior changes require tests + docs) and the toolchain canon. The runner is **Vitest 4** + **@nestjs/testing** + **supertest**. Never write Jest, ts-jest, `jest.mock`, or `jest.fn`.

A green build is not proof of correctness. A passing happy path is not proof of correctness. Behavior is proven by tests across happy, unhappy, boundary, and security paths — at the right layer, with the right boundary mocked.

---

## 1. Tests-first (TDD is the default)

Write or update the test **before** the implementation. The cycle:

1. Write a failing test that names the desired behavior.
2. Write the minimum code to make it green.
3. Refactor with the test as your safety net.
4. Add the next scenario; repeat.

| Situation                 | What you write first                                                                                                                                                                    |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New behavior              | The failing test, then implement.                                                                                                                                                       |
| Bug fix                   | A test that **reproduces** the bug (red), then fix it (green). That test is the permanent regression guard.                                                                             |
| Behavior change           | Update the affected tests **in the same change** ([00](./00-non-negotiable-rules.md) #42).                                                                                              |
| Refactor of untested code | **Characterization tests first** — pin what the code does _today_ (quirks included), get them green, then refactor. If a quirk was a bug, change the test deliberately and call it out. |

---

## 2. The three test layers

Map each change to layers; document why a layer is or isn't needed.

|               | Unit                                                                           | Integration                                                                                                             | E2E                                                              |
| ------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Subject       | One class in isolation (service, use-case, domain policy, mapper, pipe, guard) | A controller through the real Nest request pipeline (DTO → ValidationPipe → guards → handler → app layer)               | A workflow across modules/routes                                 |
| Tool          | `@nestjs/testing` `Test.createTestingModule` + `vi` doubles                    | `@nestjs/testing` app + **supertest**                                                                                   | supertest against a wired app (DB in a container/test instance)  |
| Dependencies  | All collaborators are doubles                                                  | Real Nest wiring + real guards/pipes; **persistence and vendors are doubled** (or a real test DB behind the repository) | Real wiring end-to-end; doubles only at true third-party edges   |
| Speed / count | Fast / many                                                                    | Medium / moderate                                                                                                       | Slow / few                                                       |
| Required when | Every change                                                                   | Routes, validation, guards, repository contracts change                                                                 | Critical flows (auth, ownership/tenant, multi-step transactions) |

Recipes: [/skills/write-unit-tests.md](../skills/write-unit-tests.md), [/skills/write-integration-tests.md](../skills/write-integration-tests.md), [/skills/write-e2e-tests.md](../skills/write-e2e-tests.md). Standards: [/testing/unit-testing-standard.md](../testing/unit-testing-standard.md), [/testing/integration-testing-standard.md](../testing/integration-testing-standard.md), [/testing/e2e-testing-standard.md](../testing/e2e-testing-standard.md).

---

## 3. Coverage floor

- **Workspace floor:** 95% statements/functions/lines and the live configured 90% aggregate branch floor (decorator-transform synthetic branches); touched real logic targets at least 95% branches and every security/validation branch. `vitest.config.mts` is executable authority and must never be lowered to absorb untested behavior.
- **Critical paths near 100%:** auth, RBAC, ownership/tenant scoping, money/state transitions, transactional use-cases.
- Touched modules should sit **above** the floor — never use a high repo-wide average to excuse weak coverage on the file you changed.
- A genuinely **unreachable defensive branch** may use a justified V8 ignore directive with a comment explaining _why_. This is the rare exception, not a tool to hit a number.

**Excluded from the denominator** (declarative / no-logic): `*.types.ts`, `*.enums.ts`, `*.constants.ts`, barrel `index.ts`, `model/**`, `@shared/{enums,constants,types}/**`, migrations. Keeping types/enums/constants in their own files (rules [10–16](./00-non-negotiable-rules.md)) is both architecture and coverage strategy: it removes non-logic from the denominator so your real logic files clear the bar. Full policy: [/testing/coverage-policy.md](../testing/coverage-policy.md).

> Coverage is a floor, not a goal. 100% lines through one happy-path call is paperwork. Branch + scenario coverage is the real target — see §6.

---

## 4. What to test, where

| Layer          | Test as **unit**                                                                                                                                        | Test as **integration / e2e**                                                                                                                            |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Controller** | One delegation per method: it forwards the parsed input + identity to exactly one application method and returns the result **without transformation**. | The full pipe/guard/handler chain via supertest (status codes, validation, auth).                                                                        |
| **Use case**   | Orchestration order, transaction boundary, ordered **post-commit** events, rollback on failure.                                                         | The route that triggers it, asserting persisted state + emitted events.                                                                                  |
| **Service**    | Happy path, not-found, forbidden/ownership, invalid state transition, correct delegation + args, error mapping to a typed `AppError`.                   | —                                                                                                                                                        |
| **Domain**     | Pure: every policy/invariant/state-machine arm, every boundary. No mocks needed.                                                                        | —                                                                                                                                                        |
| **Repository** | Returns data on hit, returns null/`[]` on miss (**never throws**), passes correct bounded/parameterized query args, enforces the hard list cap (100).   | Against a real test DB to prove the query actually runs (rules [04](./04-repositories-and-persistence.md), [08](./08-database-and-injection-safety.md)). |
| **DTO**        | Valid input passes; each missing/invalid/oversized field is rejected; boundary values at `min`/`max`; defaults applied; enum rejection.                 | Malformed body → `400` from the global `ValidationPipe`, never a `500`.                                                                                  |
| **Adapter**    | The wrapper's mapping + error translation, with the vendor SDK doubled (rules [12](./12-library-wrapping-and-adapters.md)).                             | —                                                                                                                                                        |

Readable tests follow [27-no-token-burning-code.md](./27-no-token-burning-code.md): scenario-named cases, minimal arrange sections, one reusable fixture owner when repetition earns it, no implementation-detail snapshots, and no inline contract duplicates that production code already owns.

```typescript
// DO — service unit test covers happy + unhappy + ownership, mocked at the repo boundary
describe('OrderService.getOrder', () => {
  it('should return the order when it exists and belongs to the caller', async () => {
    repo.findById.mockResolvedValue(orderOwnedBy('user-1'));
    await expect(service.getOrder('order-1', 'user-1')).resolves.toMatchObject({
      id: 'order-1',
    });
  });

  it('should throw OrderNotFoundError when the order does not exist', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(service.getOrder('order-1', 'user-1')).rejects.toBeInstanceOf(
      OrderNotFoundError,
    );
  });

  it('should throw OrderForbiddenError when the order belongs to another user', async () => {
    repo.findById.mockResolvedValue(orderOwnedBy('user-2'));
    await expect(service.getOrder('order-1', 'user-1')).rejects.toBeInstanceOf(
      OrderForbiddenError,
    );
  });
});
```

```typescript
// DON'T — fake coverage: tests the mock, asserts nothing about logic, skips every error path
it('should return the order', async () => {
  repo.findById.mockResolvedValue(theOrder);
  expect(await service.getOrder('order-1', 'user-1')).toBe(theOrder); // pure pass-through; no logic exercised
});
```

---

## 5. @nestjs/testing + supertest

**Unit** — build a minimal module and override every collaborator with a double. Mock at the **boundary**, never the subject.

```typescript
// DO — unit: real service, doubled repository
const moduleRef = await Test.createTestingModule({
  providers: [
    OrderService,
    {
      provide: OrderRepository,
      useValue: { findById: vi.fn(), save: vi.fn() },
    },
    { provide: AppLogger, useValue: { info: vi.fn(), error: vi.fn() } },
  ],
}).compile();

const service = moduleRef.get(OrderService);
const repo = moduleRef.get(OrderRepository);
```

**Integration / e2e** — boot the app, override guards to inject a verified identity (never trust the client body — [00](./00-non-negotiable-rules.md) #33), and drive it with supertest so the real `ValidationPipe`, guards, and exception filter run.

```typescript
// DO — integration: real pipeline, supertest assertions on the HTTP contract
const app = moduleRef.createNestApplication();
app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
await app.init();

await request(app.getHttpServer()).get('/orders/order-1').expect(401); // no token → unauthorized
await request(app.getHttpServer())
  .get('/orders/order-2')
  .set(asUser('user-1'))
  .expect(403); // not owner → forbidden
await request(app.getHttpServer())
  .post('/orders')
  .set(asUser('user-1'))
  .send({})
  .expect(400); // bad DTO → 400, not 500
```

**Boundary discipline**

- **Mock the system's _dependencies_, never the system under test.** A service test mocks the repository/adapter; a domain test mocks nothing.
- **Don't over-mock the thing you're proving.** If you mock the exact logic under test, the test asserts nothing real.
- **Vendors/SDKs are always doubled** — they live behind adapters, so you double the adapter (or the SDK inside it), never call the real provider in any test.
- Isolate every test: `vi.clearAllMocks()` in `beforeEach`. A test that only passes after another test is a broken test.
- Type doubles with `import type { Mock } from 'vitest'`; never `any`, `@ts-ignore`, or `eslint-disable` even though test files relax some lint rules ([00](./00-non-negotiable-rules.md) #3–#6).

---

## 6. Scenario coverage (more than line coverage)

Every suite must exercise these unless explicitly justified in review:

| Scenario                             | Why                                                                                                                                                                |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Happy path                           | The feature works.                                                                                                                                                 |
| Validation failure                   | Bad/missing/oversized input → typed `400`, never `500`.                                                                                                            |
| Not found                            | Missing entity → typed not-found `AppError`.                                                                                                                       |
| Ownership / tenant (IDOR)            | Actor A cannot read/mutate actor B's resource by id ([00](./00-non-negotiable-rules.md) #35).                                                                      |
| Permission / RBAC                    | Authenticated-but-unauthorized → `403`.                                                                                                                            |
| Invalid state transition             | Domain state machine rejects illegal moves.                                                                                                                        |
| Boundary (at / above / below limits) | Off-by-one and the list cap (100) are correct.                                                                                                                     |
| Empty / null                         | `[]` returns `[]` (not null, not a crash); null is handled.                                                                                                        |
| Idempotency / duplicate delivery     | Repeating an operation/event produces the correct result ([19](./19-async-events-and-jobs.md)).                                                                    |
| Dependency failure & fallback        | Adapter/repo throws → handled, mapped, or swallowed as designed.                                                                                                   |
| Fail-safe side effect                | A fire-and-forget handler **swallows** its own error and never rejects the caller ([10](./10-reliability-and-durability.md), [19](./19-async-events-and-jobs.md)). |

```typescript
// DO — prove a fire-and-forget handler never breaks the workflow when its side effect fails
it('should swallow a notification failure and resolve without rejecting', async () => {
  notifier.send.mockRejectedValue(new Error('provider down'));
  await expect(
    handler.onOrderPlaced(orderPlacedEvent),
  ).resolves.toBeUndefined();
  expect(logger.error).toHaveBeenCalled();
});
```

---

## 7. Security tests (mandatory on protected routes)

A protected route is not "tested" until its security surface is, preferably via **integration** so the real guard chain runs:

- **AuthN** — no/invalid token → `401`.
- **AuthZ / RBAC** — valid token, missing permission → `403`.
- **Ownership / tenant** — cannot access another actor's resource by id; identity comes from the verified token, not the body.
- **Validation** — malformed/oversized/type-confused input → `400`, never `500`.
- **Injection safety** — a `'; DROP …`-style value is treated as **data**; the repository stays parameterized and bounded ([08](./08-database-and-injection-safety.md)).
- **Rate limit** — sensitive endpoints (login, OTP, reset) → `429` past the limit.

Detail: [/skills/security-review.md](../skills/security-review.md), [/skills/sql-injection-review.md](../skills/sql-injection-review.md), [/rules/07-security-authn-authz.md](./07-security-authn-authz.md).

---

## 8. Determinism

Flaky tests are defects — fix the cause, never rerun-until-green or paper over with sleeps.

- **Control time.** `vi.useFakeTimers()` / `vi.setSystemTime(...)`; restore in `afterEach`. Never assert against `Date.now()` directly.
- **Control randomness.** Inject the id/token generator and stub it; never assert against real `Math.random`/`randomUUID` output.
- **No arbitrary `sleep`/`setTimeout`** to "wait for" async work. Await the promise, advance fake timers, or assert on the observable effect.
- **No real network, real clock, or real DB** in unit tests — those belong to integration/e2e behind a controlled test instance.
- **Async is explicit:** await every promise; assert rejections with `rejects.toBeInstanceOf(<AppError>)`, not bare truthiness.

```typescript
// DO — deterministic time
beforeEach(() => vi.setSystemTime(new Date('2025-01-01T00:00:00Z')));
afterEach(() => vi.useRealTimers());
```

---

## 9. Commands & gates

```bash
npm run test            # vitest run — full suite
npm run test:coverage   # vitest run --coverage — enforces the 95% floor
```

All gates green before "done" (Husky enforces lint+typecheck on pre-commit, test:coverage+build on pre-push — never `--no-verify`):

```bash
npm run lint            # 0 errors AND 0 warnings
npm run typecheck       # tsc --noEmit (TypeScript 7), project-wide
npm run test            # vitest
npm run test:coverage   # 95% floor met
npm run build           # compiles clean
```

### Banned in test code

```text
DON'T:  jest / jest.mock / jest.fn / jest.spyOn / ts-jest / @jest/globals / npx jest / any / @ts-ignore / eslint-disable
DO:     vi.mock / vi.fn / vi.spyOn / vi.hoisted / vi.useFakeTimers / npm run test* / npm run typecheck
```

The TypeScript 7 compiler gate validates types; it does not replace test execution.

---

## Checklist

- [ ] Test written/updated **first**; bug fixes ship a reproducing regression test
- [ ] Layer chosen correctly: unit for one class, integration (supertest) for the route pipeline, e2e for critical flows
- [ ] Mocked at the **boundary**; never mocked the subject; vendors doubled behind adapters
- [ ] Scenarios cover happy + validation + not-found + ownership + permission + boundary + empty/null + failure paths
- [ ] Protected routes assert `401`/`403`/`400`/`429` and injection safety
- [ ] Fire-and-forget handlers asserted to swallow their own errors
- [ ] Deterministic: time and randomness controlled; zero arbitrary sleeps
- [ ] Touched logic meets the configured metrics; every real branch is covered; any V8 ignore is justified
- [ ] `npm run lint` / `typecheck` / `test` / `test:coverage` / `build` all green

**Related:** [/testing/testing-strategy.md](../testing/testing-strategy.md) · [/testing/quality-gates.md](../testing/quality-gates.md) · [/testing/test-data-and-fixtures.md](../testing/test-data-and-fixtures.md) · [/skills/write-unit-tests.md](../skills/write-unit-tests.md) · [/skills/final-validation.md](../skills/final-validation.md) · [/memory/testing-strategy.md](../memory/testing-strategy.md)
