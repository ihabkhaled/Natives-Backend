# Skill: Write API End-to-End Tests

> Boot the **whole Nest application** and drive real HTTP journeys with supertest, asserting persisted state and emitted side effects — not just the response body. Implements the canon in [/rules/11-testing-and-coverage.md](../rules/11-testing-and-coverage.md) and [/context/stack-and-toolchain.md](../context/stack-and-toolchain.md).

E2E tests prove a **complete request flow through the assembled system**: the real `AppModule` with its global `ValidationPipe`, exception filter, guards, interceptors, and the same wiring production uses — exercised over HTTP by `supertest`, against a real (test-scoped) datastore. They sit above unit tests (one isolated unit, everything mocked) and integration tests (one slice — a controller plus its real repository). They are the slowest, highest-confidence layer, so keep them few and focused on the journeys that matter: auth → authorize → act → persist → emit.

## Rules this skill enforces

- **Tests come first.** No behavior change ships without tests in the same change ([rule 42](../rules/00-non-negotiable-rules.md)).
- **Coverage floor 95%**; critical journeys near 100% ([/testing/coverage-policy.md](../testing/coverage-policy.md)).
- **Boot the real app**, not a hand-wired sub-module — `Test.createTestingModule({ imports: [AppModule] })` so global pipes/filters/guards run.
- **Identity from a real token**, never a forged header or client-supplied id — drive the actual auth flow ([rules 33–35](../rules/00-non-negotiable-rules.md), [/skills/add-guard-and-permission.md](./add-guard-and-permission.md)).
- **Assert persistence and side effects**, not only the HTTP body — read the row back through the repository; assert emitted events/notifications via a captured spy ([rule 38](../rules/00-non-negotiable-rules.md), [/skills/add-event-handler.md](./add-event-handler.md)).
- **Assert typed errors at the boundary** — status code *and* the sanitized `messageKey`; never a leaked stack/SQL/secret ([rules 26, 36](../rules/00-non-negotiable-rules.md), [/skills/create-error.md](./create-error.md)).
- **No `any`, no `!`, `===`/`!==` only** — strict TS holds in tests too ([rules 1–7](../rules/00-non-negotiable-rules.md)).
- **Vitest only** — `vi.fn()` / `vi.spyOn()`. There is no Jest in this workspace.

---

## Tests FIRST

Write the failing journey before the feature is wired. Map each acceptance criterion to a named `it(...)`, run it red, then make the route, guard, and persistence make it green. For a bug that escaped to production, reproduce it as a failing E2E first so the regression is permanently locked in ([/skills/investigate-production-bug.md](./investigate-production-bug.md)).

---

## Steps

### 1. Place the test and pick the journeys

E2E specs live apart from the source so they are easy to run as their own pass: `test/e2e/<feature>.e2e-spec.ts`. Choose **journeys, not endpoints** — a sequence a real caller performs. Per feature, cover at minimum:

| Journey bucket | What it proves |
| --- | --- |
| Happy path | authenticated + authorized + owns the resource → 2xx, row persisted, event emitted |
| Validation | malformed DTO → 400 with the field error, nothing persisted |
| AuthN | no/invalid token → 401, never reaches the handler |
| AuthZ | valid token, missing permission → 403 |
| Ownership / tenant | valid token, another tenant's id → 404/403 (no cross-tenant leak) |
| Conflict | duplicate create → 409 with the conflict `messageKey` |
| Pagination bounds | over-limit `take` clamped to the hard max (100), no unbounded scan |

### 2. Boot the full application (do this once per suite)

Compile the real `AppModule`, then re-apply the **same global setup as `bootstrap/`** so the running app is faithful: global `ValidationPipe`, exception filter, and any global interceptors/guards. On Fastify call `getHttpAdapter().getInstance().ready()` before issuing requests.

```ts
// DO — real app, production-faithful globals, real datastore
import { Test, type TestingModule } from '@nestjs/testing';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '@app/app.module';
import { AllExceptionsFilter } from '@core/errors';
import { OrderRepository } from '@modules/order';
import request from 'supertest';

describe('Order API (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let orders: OrderRepository;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(app.get(AllExceptionsFilter));
    await app.init();
    // Fastify only: ensure the adapter is ready before the first request.
    await app.getHttpAdapter().getInstance().ready();

    http = request(app.getHttpServer());
    orders = moduleRef.get(OrderRepository); // read persisted state through the repo
  });

  afterAll(async () => {
    await app.close(); // releases connections; without it the run hangs
  });
});
```

```ts
// DON'T — hand-wire only the controller; globals never run, so the test lies
const app = (await Test.createTestingModule({
  controllers: [OrderController],
  providers: [{ provide: OrderService, useValue: fakeService }],
}).compile()).createNestApplication();
// no ValidationPipe, no exception filter, fake service → proves nothing about the real flow
```

> **Mock only true externals.** Override the email/SMS/payment/object-storage **adapter** provider with a spy so no real call leaves the box; everything inside the app boundary stays real. See [/skills/add-library-adapter.md](./add-library-adapter.md).

### 3. Obtain a real token through the real auth flow

Identity must come from a verified token the app issued, never a forged `Authorization` header or a `userId` in the body. Drive the genuine sign-in path and capture the token.

```ts
let token: string;

beforeAll(async () => {
  const res = await http.post('/auth/login').send({ email: seededEmail, password: seededSecret });
  expect(res.status).toBe(200);
  token = (res.body as { accessToken: string }).accessToken;
});

const authed = (): request.Test => http.get('/orders').set('Authorization', `Bearer ${token}`);
```

If your auth provider is itself an external adapter, seed a deterministic verified principal in the test datastore rather than hand-minting JWTs — keep token issuance going through the app.

### 4. Drive the happy journey and assert PERSISTENCE

The point of E2E is truth on disk. After a write, read the row back through the repository and assert the persisted shape — an HTTP `201` alone does not prove the entity was stored correctly.

```ts
it('creates an order, returns 201, and persists it for the owner', async () => {
  const res = await http
    .post('/orders')
    .set('Authorization', `Bearer ${token}`)
    .send({ sku: 'SKU-1', quantity: 2 });

  expect(res.status).toBe(201);
  const body = res.body as { id: string };

  const persisted = await orders.findById(body.id); // verify the datastore, not the response
  expect(persisted).not.toBeNull();
  expect(persisted?.ownerId).toBe(seededUserId);   // identity came from the token
  expect(persisted?.status).toBe(OrderStatus.DRAFT); // enum member, never the string 'DRAFT'
});
```

### 5. Assert EMITTED SIDE EFFECTS

A flow that should publish a domain event or enqueue a notification must prove it did. Spy on the event publisher / notification adapter and assert it was called with the expected payload — and that a delivery failure never breaks the user-facing response ([rule 38](../rules/00-non-negotiable-rules.md)).

```ts
it('emits OrderCreated after commit', async () => {
  const publisher = app.get(EventPublisher);
  const emit = vi.spyOn(publisher, 'publish');

  const res = await http
    .post('/orders')
    .set('Authorization', `Bearer ${token}`)
    .send({ sku: 'SKU-2', quantity: 1 });

  expect(res.status).toBe(201);
  expect(emit).toHaveBeenCalledWith(
    expect.objectContaining({ name: OrderEvent.CREATED, payload: expect.objectContaining({ id: res.body.id }) }),
  );
});
```

### 6. Assert the failure boundaries — status AND messageKey

Every guard and every typed `AppError` has an observable HTTP contract. Pin the status code and the sanitized `messageKey` the exception filter returns; confirm no stack/SQL/secret leaks and that nothing was persisted on failure.

```ts
it('rejects an unauthenticated request', async () => {
  const res = await http.post('/orders').send({ sku: 'SKU-3', quantity: 1 });
  expect(res.status).toBe(401);
});

it('returns 403 when the caller lacks the permission', async () => {
  const res = await http.post('/orders').set('Authorization', `Bearer ${viewerToken}`).send({ sku: 'SKU-4', quantity: 1 });
  expect(res.status).toBe(403);
});

it('returns 404 for another tenant’s order without leaking it', async () => {
  const res = await http.get(`/orders/${otherTenantOrderId}`).set('Authorization', `Bearer ${token}`);
  expect(res.status).toBe(404);
  expect(res.body).toMatchObject({ messageKey: 'errors.order.notFound' });
  expect(JSON.stringify(res.body)).not.toMatch(/at \w+\.|select .* from/i); // no stack, no SQL
});

it('returns 400 with the field error on a malformed body', async () => {
  const res = await http.post('/orders').set('Authorization', `Bearer ${token}`).send({ quantity: -1 });
  expect(res.status).toBe(400);
  await expect(orders.findBySku('SKU-1')).resolves.not.toContainEqual(expect.objectContaining({ quantity: -1 }));
});
```

### 7. Assert pagination bounds

List endpoints must clamp to the hard max (default cap 100) — prove an over-limit request is bounded, not an unbounded scan ([rule 37](../rules/00-non-negotiable-rules.md)).

```ts
it('clamps take to the hard max', async () => {
  const res = await http.get('/orders?take=10000').set('Authorization', `Bearer ${token}`);
  expect(res.status).toBe(200);
  expect((res.body as { items: unknown[] }).items.length).toBeLessThanOrEqual(MAX_LIST_LIMIT);
});
```

### 8. Keep journeys isolated and deterministic

The datastore is shared across cases in a suite. Derive unique inputs per run, reset created rows so reruns don't collide, and reset spies between cases.

```ts
const runId = Date.now();
const seededEmail = `e2e-${runId}@example.test`; // unique → no unique-constraint collisions

afterEach(() => vi.restoreAllMocks());           // drop spies installed per case
afterAll(async () => {
  await orders.deleteByOwner(seededUserId);       // clean up YOUR rows, via the repo (parameterized)
});
```

Control time with `vi.useFakeTimers()` for any TTL/expiry-sensitive journey; never raw-interpolate values into cleanup SQL ([/skills/sql-injection-review.md](./sql-injection-review.md)).

### 9. Run the suite and the journey you touched

```bash
# the file you are writing
npx vitest run test/e2e/order.e2e-spec.ts
# the whole e2e pass + coverage (what pre-push exercises)
npm run test:coverage
```

---

## Quality gate

```bash
npm run lint            # 0 errors AND 0 warnings
npm run typecheck       # tsgo --noEmit, project-wide
npm run test            # vitest
npm run test:coverage   # statements/branches/functions/lines ≥ 95% (critical journeys ~100%)
npm run build           # compiles clean
```

Never bypass a hook with `--no-verify`. A green run is not proof of correctness — confirm each journey asserts persisted state and emitted side effects, not just the response code.

---

## Pitfalls

- **Forgetting `await app.close()`** in `afterAll` — connections leak and the run hangs or flakes; close the app every suite.
- **Skipping `ready()` on Fastify.** Issuing requests before the adapter is ready yields intermittent connection errors; await it once after `app.init()`.
- **Hand-wiring controllers instead of importing `AppModule`.** You bypass the global `ValidationPipe`, exception filter, and guards — the exact wiring E2E exists to prove. Boot the real app.
- **Re-applying globals inconsistently with `bootstrap/`.** If the test pipe/filter config drifts from production, the test validates a system that doesn't ship. Mirror `bootstrap/` exactly.
- **Forging tokens or passing `userId` in the body.** Identity must come from a token the app issued; a forged header tests nothing about your guards and hides IDOR bugs.
- **Asserting only the HTTP body.** A `201` is not persistence — read the row back through the repository and assert the stored shape and ownership.
- **Ignoring side effects.** If the flow should emit an event or send a notification, spy on the adapter and assert it; otherwise broken fan-out ships silently.
- **Letting real external calls escape.** Override the email/SMS/payment/storage **adapter** with a spy — never hit a live provider from a test.
- **Hardcoded shared data.** A fixed email/sku collides on the shared datastore across runs; derive unique values from `Date.now()` and clean up your rows.
- **Asserting raw strings.** Compare against enum members and named constants from `model/` and `@shared/enums`, not literals like `'DRAFT'`.
- **Leak assertions skipped.** Always check the error body has no stack/SQL/secret — a sanitized boundary is a security contract ([/skills/security-review.md](./security-review.md)).
- **Turning E2E into a mock farm.** If you mock the repository and the service, you've written a slow unit test. Keep the inside real; mock only true externals — for isolated logic use [/skills/write-unit-tests.md](./write-unit-tests.md).

---

**Related:** [/rules/11-testing-and-coverage.md](../rules/11-testing-and-coverage.md) · [/testing/e2e-testing-standard.md](../testing/e2e-testing-standard.md) · [/testing/coverage-policy.md](../testing/coverage-policy.md) · [/skills/write-integration-tests.md](./write-integration-tests.md) · [/skills/write-unit-tests.md](./write-unit-tests.md) · [/skills/create-error.md](./create-error.md) · [/skills/add-guard-and-permission.md](./add-guard-and-permission.md) · [/skills/add-event-handler.md](./add-event-handler.md) · [/skills/security-review.md](./security-review.md) · [/skills/fix-eslint-typecheck.md](./fix-eslint-typecheck.md) · [/memory/known-pitfalls.md](../memory/known-pitfalls.md)
