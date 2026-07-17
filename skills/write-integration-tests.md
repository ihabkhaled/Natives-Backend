# Skill: Write Integration Tests

> Boot the real NestJS application with `@nestjs/testing`, drive it over HTTP with `supertest` against a real test database, and verify persisted state — not just the response body. Implements the canon in [/rules/11-testing-and-coverage.md](../rules/11-testing-and-coverage.md), [/testing/integration-testing-standard.md](../testing/integration-testing-standard.md), and [/context/stack-and-toolchain.md](../context/stack-and-toolchain.md).

Integration tests prove **multiple layers wired together**: controller → guards/pipes → use case/service → repository → real database, plus the global `ValidationPipe` and the exception filter. They exist to catch what mocks hide — DI wiring, query correctness, transaction boundaries, validation, auth chains, and the actual shape that leaves the HTTP boundary. Run them whenever you change a route, controller wiring, a repository query, a migration, an adapter contract, or a guard.

## Rules this skill enforces

- **Tests come first.** No behavior change ships without tests in the same change ([rule 42](../rules/00-non-negotiable-rules.md)).
- **Coverage floor:** 95% statements/functions/lines, 90% measured branches for decorator artifacts, and every real touched branch covered ([/testing/coverage-policy.md](../testing/coverage-policy.md)).
- **Verify persisted state, not just HTTP** — read the row back through the repository and assert it ([rule 19, 20](../rules/00-non-negotiable-rules.md)).
- **Exercise the real auth chain** — auth guard + permissions guard + ownership/tenant check; identity from the token, never the body ([rules 33–35](../rules/00-non-negotiable-rules.md)).
- **Every typed `AppError` path maps to a sanitized HTTP body** with its `messageKey` and status; no stack/SQL/secret leakage ([rule 26, 36](../rules/00-non-negotiable-rules.md), [/skills/create-error.md](./create-error.md)).
- **Parameterized SQL only** in setup/teardown — bind every value ([rule 31](../rules/00-non-negotiable-rules.md), [/skills/sql-injection-review.md](./sql-injection-review.md)).
- **No `any`, no `!`, `===`/`!==` only; assert against enum members**, never raw literals ([rules 1–9](../rules/00-non-negotiable-rules.md)).
- **Vitest only** — `vi.*`, never `jest.*`, `ts-jest`, or `--runInBand`.

---

## Tests FIRST

Write the failing test before the route or query exists. Map each acceptance criterion — happy path, validation rejection, `401`, `403`, not-found, conflict, and the persisted side effect — to a named `it(...)`, watch it go red, then make it green. For a bug fix, reproduce the defect as a failing integration test _first_ so the regression is locked in permanently ([/skills/investigate-production-bug.md](./investigate-production-bug.md)).

---

## Steps

### 1. Locate the test and assume a migrated DB

Integration tests live under `test/integration/<feature>.integration-spec.ts` (kept out of the unit `*.spec.ts` glob). The DB schema is created and migrated **once** by the shared global setup ([/testing/test-data-and-fixtures.md](../testing/test-data-and-fixtures.md)); a test file never runs migrations itself — assume a ready, migrated database and a connection string supplied via test config. If no database is reachable, integration tests fail on their own; unit tests stay green because they mock the boundary.

> The database driver, ORM, and migration runner are project choices kept behind the repository/adapter — pick yours and record it in [/memory/database-decisions.md](../memory/database-decisions.md). The shape below holds regardless of which one you use.

### 2. Boot the real application once per suite

Compile the **whole `AppModule`** (or the feature module plus its real dependencies), apply the same global `ValidationPipe`, exception filter, and prefix that `bootstrap/` applies in production, then `init()`. Reuse the running instance across every `it` — booting per test is slow and flaky.

```ts
// DO — one real app + supertest agent for the suite
import { Test, type TestingModule } from '@nestjs/testing';
import request, { type Agent } from 'supertest';
import { type INestApplication } from '@nestjs/common';
import { AppModule } from '@app/app.module';
import { applyGlobalPipeline } from '@app/bootstrap/global-pipeline';
import { OrderRepository } from '@modules/order/infrastructure/order.repository';

describe('Order API (integration)', () => {
  let app: INestApplication;
  let http: Agent;
  let orders: OrderRepository;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    applyGlobalPipeline(app); // same ValidationPipe + exception filter as production
    await app.init(); // boots Fastify/HTTP adapter for supertest
    http = request(app.getHttpServer());
    orders = moduleRef.get(OrderRepository); // real repo → verify persisted state
  });

  afterAll(async () => {
    await app.close(); // releases the HTTP server + DB pool
  });
});
```

```ts
// DON'T — re-create the app inside each test, or skip the global pipeline
beforeEach(async () => {
  app = (
    await Test.createTestingModule({ imports: [AppModule] }).compile()
  ).createNestApplication();
  await app.init(); // slow; and without applyGlobalPipeline validation never runs
});
```

### 3. Override only the outermost external boundary

Keep the database **real** — that is the point. Override only what must not be hit from a test: external vendors behind adapters (email/SMS/payment/object storage), so deliveries are observable and never leave the machine. Override the adapter's public class, never the SDK.

```ts
// DO — stub the adapter, keep DB + business logic real
import { EmailAdapter } from '@modules/notification/adapters/email.adapter';

const emailSpy = { send: vi.fn().mockResolvedValue(undefined) };
const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
  .overrideProvider(EmailAdapter)
  .useValue(emailSpy)
  .compile();
```

### 4. Obtain identity through the real auth flow

Drive the actual sign-in/token-issuance endpoints to get a bearer token, then attach it. Do not hand-mint JWTs or inject a fake `CurrentUser` — that bypasses the guards you are trying to prove. Use unique credentials per run (see step 6).

```ts
async function authenticate(http: Agent, email: string): Promise<string> {
  await http
    .post('/auth/register')
    .send({ email, password: 'Str0ng-Pass!' })
    .expect(201);
  const res = await http
    .post('/auth/login')
    .send({ email, password: 'Str0ng-Pass!' })
    .expect(200);
  return (res.body as { accessToken: string }).accessToken;
}
// usage: http.get('/orders/me').set('Authorization', `Bearer ${token}`)
```

### 5. Assert the response AND the persisted row

An integration test that checks only the HTTP body is half a test. Fetch the row back through the repository and assert the database actually changed (or did not).

```ts
it('creates an order and persists it', async () => {
  const res = await http
    .post('/orders')
    .set('Authorization', `Bearer ${token}`)
    .send({ sku: `SKU-${uniqueId}`, quantity: 2 })
    .expect(201);

  const body = res.body as { id: string; status: string };
  expect(body.status).toBe(OrderStatus.Draft); // enum member, not 'draft'

  const row = await orders.findById(body.id); // verify against the DB, not just HTTP
  expect(row?.ownerId).toBe(userId); // identity came from the token
  expect(row?.status).toBe(OrderStatus.Draft);
  expect(emailSpy.send).toHaveBeenCalledTimes(1); // side effect fired
});
```

### 6. Use unique, self-cleaning test data

The database is **shared and persistent across runs**, so hardcoded values collide on unique constraints. Derive identifiers from `Date.now()` and clean up your own rows in `afterAll` with parameterized SQL or a repository delete — never interpolate values into a query string.

```ts
const uniqueId = `${Date.now()}-${Math.floor(Math.random() * 1e4)}`;
const email = `user-${uniqueId}@example.com`;
let userId: string;
let token: string;

afterAll(async () => {
  if (userId) {
    await orders.deleteByOwner(userId); // parameterized inside the repo
  }
});
```

### 7. Prove the validation, auth, and error chains end to end

These paths only exist once layers are wired — assert each through real HTTP, including the sanitized error body the exception filter produces.

```ts
it('rejects an invalid payload with 400 from the ValidationPipe', async () => {
  const res = await http
    .post('/orders')
    .set('Authorization', `Bearer ${token}`)
    .send({ quantity: -1 }) // fails DTO constraints; `sku` missing
    .expect(400);
  expect(res.body).not.toHaveProperty('stack'); // never leak internals (rule 36)
});

it('returns 401 without a token', async () => {
  await http.get('/orders/me').expect(401); // no Authorization header → auth guard
});

it('returns 403 when the permission is missing', async () => {
  await http
    .get('/orders/admin')
    .set('Authorization', `Bearer ${token}`)
    .expect(403);
});

it('blocks cross-owner access with a typed error body', async () => {
  const res = await http
    .get(`/orders/${otherOwnersOrderId}`)
    .set('Authorization', `Bearer ${token}`)
    .expect(403);
  expect((res.body as { messageKey: string }).messageKey).toBe(
    'errors.order.forbidden',
  );
});

it('returns 404 for a missing resource', async () => {
  await http
    .get('/orders/00000000-0000-0000-0000-000000000000')
    .set('Authorization', `Bearer ${token}`)
    .expect(404);
});
```

### 8. Verify pagination bounds and transactional atomicity

List endpoints must cap the page size (default max 100); a use case under one transaction must leave **no partial writes** when a later step fails.

```ts
it('caps the page size at the hard limit', async () => {
  const res = await http
    .get('/orders?limit=1000')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);
  expect((res.body as { items: unknown[] }).items.length).toBeLessThanOrEqual(
    LIST_MAX_LIMIT,
  );
});

it('rolls back the whole use case when a step fails', async () => {
  emailSpy.send.mockRejectedValueOnce(new Error('provider down'));
  await http
    .post('/orders/checkout')
    .set('Authorization', `Bearer ${token}`)
    .send({ sku: `SKU-${uniqueId}` })
    .expect(502);
  const rows = await orders.listByOwner(userId);
  expect(rows).toHaveLength(0); // transaction rolled back — no orphan row
});
```

### 9. Keep each test independent and the file focused

One concern per `describe`; keep every `it` self-contained so the suite is stable under a serial run. Don't depend on the order of cases or on rows another file created.

```bash
# Run a single integration file while iterating
npx vitest run test/integration/order.integration-spec.ts
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

Never bypass a hook with `--no-verify`. A green run is not proof of correctness — confirm each route asserts both the HTTP contract and the persisted state, and that the `401`/`403`/`404`/validation paths are covered. If you added or changed routes, re-run [/skills/security-review.md](./security-review.md).

---

## Pitfalls

- **Mocking the database.** A `vi.mock` of the data source turns this into a unit test and breaks the real connection the suite relies on. Keep the DB real; override only external vendor adapters.
- **Asserting only the HTTP body.** The whole reason to pay for a real DB is to read the row back. Verify persisted state through the repository, or you have re-implemented a unit test slowly.
- **Hardcoded test data.** Fixed emails/SKUs/keys collide on unique constraints across runs. Derive everything from `Date.now()` and clean up your own rows.
- **Hand-minting tokens.** Injecting a fake identity skips the auth + permissions + ownership chain you are meant to prove. Go through the real auth endpoints.
- **Skipping the global pipeline.** Without `applyGlobalPipeline` the `ValidationPipe` and exception filter never run, so your `400`/error-body assertions are meaningless.
- **Re-creating the app per test.** Boot once in `beforeAll`; per-test boots are slow and surface phantom flakes.
- **Leaking the server or pool.** No `app.close()` in `afterAll` means open handles, hanging runs, and exhausted connections under coverage.
- **Order-dependent tests.** Relying on rows another `it` or file created makes failures non-reproducible. Each test seeds and cleans its own state.
- **Raw-interpolated cleanup SQL.** Teardown is still code — bind values with parameters; never string-concat ids into a query.
- **Trusting a `200` for writes.** A success status with a silently-rolled-back transaction is a real bug class; assert the persisted result for every write and state transition.

---

**Related:** [/rules/11-testing-and-coverage.md](../rules/11-testing-and-coverage.md) · [/testing/integration-testing-standard.md](../testing/integration-testing-standard.md) · [/testing/test-data-and-fixtures.md](../testing/test-data-and-fixtures.md) · [/testing/coverage-policy.md](../testing/coverage-policy.md) · [/skills/write-unit-tests.md](./write-unit-tests.md) · [/skills/write-e2e-tests.md](./write-e2e-tests.md) · [/skills/create-repository.md](./create-repository.md) · [/skills/add-guard-and-permission.md](./add-guard-and-permission.md) · [/skills/sql-injection-review.md](./sql-injection-review.md) · [/skills/security-review.md](./security-review.md) · [/memory/database-decisions.md](../memory/database-decisions.md) · [/memory/known-pitfalls.md](../memory/known-pitfalls.md)
