# API End-to-End Testing Standard

> The house standard for end-to-end (E2E) tests: boot the **whole Nest application** and drive real HTTP journeys with `supertest` against a real test datastore, asserting status, body contract, persisted state, side effects, and security boundaries. Implements the canon in [/context/architecture-map.md](../context/architecture-map.md), [/rules/00-non-negotiable-rules.md](../rules/00-non-negotiable-rules.md), and [/rules/11-testing-and-coverage.md](../rules/11-testing-and-coverage.md). For the step-by-step authoring recipe see the skill [/skills/write-e2e-tests.md](../skills/write-e2e-tests.md).

E2E is **backend API** testing, not browser testing. We do not drive a UI; we drive HTTP. The "user" is a real HTTP client (`supertest`) calling the assembled application exactly as a production caller would: through the global `ValidationPipe`, the global exception filter, every guard, every interceptor, and the same module wiring `bootstrap/` ships.

---

## 1. What E2E proves (and what it doesn't)

E2E proves a **complete request flow through the assembled system** behaves correctly: authenticate → authorize → validate → act → persist → emit → respond. It is the slowest, highest-confidence layer, so keep it **few and journey-focused**.

| Layer | Scope | Datastore | Globals run | Use for |
| --- | --- | --- | --- | --- |
| Unit ([standard](./unit-testing-standard.md)) | one class, deps mocked | none | no | branch logic, policies, mappers |
| Integration ([standard](./integration-testing-standard.md)) | one slice (controller + real repo) | real, scoped | partial | a controller against its real persistence |
| **E2E (this file)** | the real `AppModule` over HTTP | real, scoped | **yes** | the journeys that matter end to end |

> An E2E test that mocks the repository and the service is a slow unit test. Keep the **inside real**; mock only true externals (§5).

---

## 2. Boot the real application

Compile the genuine `AppModule` and re-apply the **same global setup as [`bootstrap/`](../context/architecture-map.md)** so the running app is production-faithful. Drifting from `bootstrap/` validates a system that doesn't ship.

```ts
// DO — real app, production-faithful globals, real datastore
import { Test, type TestingModule } from '@nestjs/testing';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '@app/app.module';
import { AllExceptionsFilter } from '@core/errors';
import { OrderRepository } from '@modules/order';
import request from 'supertest';

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
  await app.getHttpAdapter().getInstance().ready(); // Fastify only: ready before first request

  http = request(app.getHttpServer());
  orders = moduleRef.get(OrderRepository); // read persisted truth through the repo
});

afterAll(async () => {
  await app.close(); // release connections; without it the run hangs
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

**Boot rules**

- Import `AppModule` — never hand-assemble controllers + fake providers.
- Mirror `bootstrap/` exactly (pipe options, exception filter, global interceptors/guards).
- On Fastify, `await getHttpAdapter().getInstance().ready()` once after `init()`.
- `await app.close()` in `afterAll` every suite — leaked connections hang or flake the run.

---

## 3. Identity comes from a real token

Authentication is part of the journey. Drive the genuine sign-in path and capture the issued token; **never** forge an `Authorization` header or pass a `userId` in the body — that hides IDOR and broken-guard bugs ([rules 33–35](../rules/00-non-negotiable-rules.md), [/skills/add-guard-and-permission.md](../skills/add-guard-and-permission.md)).

```ts
let ownerToken: string; // seeded principal who owns the resource
let viewerToken: string; // valid token, lacks the write permission

beforeAll(async () => {
  const res = await http.post('/auth/login').send({ email: seededEmail, password: seededSecret });
  expect(res.status).toBe(200);
  ownerToken = (res.body as { accessToken: string }).accessToken;
});

const asOwner = (): request.Test => http.get('/orders').set('Authorization', `Bearer ${ownerToken}`);
```

If the identity provider is itself an external adapter, seed a deterministic verified principal in the test datastore and still route issuance through the app — do not hand-mint tokens.

---

## 4. Required journey matrix (per feature)

Cover **journeys, not endpoints** — a sequence a real caller performs. Every feature ships at minimum these buckets; each maps to one or more named `it(...)`.

| Journey | Proves | Expected |
| --- | --- | --- |
| Happy path | authenticated + authorized + owns the resource | 2xx, row persisted, event emitted |
| Read-after-write | the write is durable and readable | GET returns the persisted shape |
| Validation — missing required | DTO rejects | 400, field error, nothing persisted |
| Validation — wrong type / bad enum | DTO + enum guard reject | 400, lists valid values |
| Validation — boundary | min/max length & numeric bounds | at-limit passes, over-limit 400 |
| Validation — unknown property | `whitelist: true` strips/rejects extras | extra field never persisted |
| AuthN — no / invalid / expired token | request never reaches the handler | 401 |
| AuthZ — valid token, missing permission | RBAC guard blocks | 403 |
| Ownership / tenant isolation | another principal's id is invisible | 404 or 403, no cross-tenant leak |
| Not found | unknown id | 404 with the not-found `messageKey` |
| Conflict | duplicate of a unique resource | 409 with the conflict `messageKey` |
| Pagination bounds | list clamps to the hard max (100) | bounded result, no unbounded scan |
| Idempotency | safe retry of the same operation | no duplicate effect (§6) |

Negative cases get equal weight with the happy path. A green happy path alone is not adequate validation ([rule 42](../rules/00-non-negotiable-rules.md)).

---

## 5. Mock only true externals

Everything **inside the application boundary stays real** — controllers, use cases, services, domain, repositories, the datastore. Override **only** the integration adapters that would otherwise leave the box: an email provider, an SMS gateway, a payment provider, object storage, a third-party HTTP client.

```ts
// DO — override the adapter (your interface), not the vendor SDK
const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
  .overrideProvider(EmailAdapter)
  .useValue({ send: vi.fn().mockResolvedValue(undefined) })
  .compile();
```

```ts
// DON'T — mock the repository/service in an E2E; now you're testing nothing real
.overrideProvider(OrderRepository).useValue(fakeRepo) // ✗ this is a unit test wearing an E2E costume
```

Override at the **adapter** seam because that is the documented swap surface ([rules/12](../rules/12-library-wrapping-and-adapters.md), [/skills/add-library-adapter.md](../skills/add-library-adapter.md)). Never let a real external call escape a test.

---

## 6. Contract assertions — the four checks per write

A `2xx` is not success. For every state-changing journey assert all four:

### 6.1 Response contract

Status code per the table below, and the response body shape (fields + types). Read-after-write proves durability: GET the resource back and compare key fields.

| Operation | Success | Not found | Validation | AuthN | AuthZ |
| --- | --- | --- | --- | --- | --- |
| GET one | 200 | 404 | — | 401 | 403 |
| GET list | 200 | — | 400 (bad query) | 401 | 403 |
| POST | 201 | — | 400 | 401 | 403 |
| PUT / PATCH | 200 | 404 | 400 | 401 | 403 |
| DELETE | 200 or 204 | 404 | — | 401 | 403 |

### 6.2 Persisted state

Read the row back **through the repository**, not the response, and assert the stored shape — including that ownership/tenant came from the token, and enum columns hold enum members.

```ts
it('creates an order, returns 201, and persists it for the owner', async () => {
  const res = await http
    .post('/orders')
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({ sku: 'SKU-1', quantity: 2 });

  expect(res.status).toBe(201);
  const { id } = res.body as { id: string };

  const persisted = await orders.findById(id);   // truth on disk, not the HTTP body
  expect(persisted?.ownerId).toBe(seededUserId); // identity came from the token, not the body
  expect(persisted?.status).toBe(OrderStatus.DRAFT); // enum member, never the string 'DRAFT'
});
```

### 6.3 Emitted side effects

If the flow should publish a domain event or enqueue a notification, prove it — spy on the publisher/adapter and assert payload. Also prove fail-safety: a delivery failure must **not** break the user-facing response ([rule 38](../rules/00-non-negotiable-rules.md), [/skills/add-event-handler.md](../skills/add-event-handler.md)).

```ts
it('emits OrderCreated after commit and survives a delivery failure', async () => {
  const emit = vi.spyOn(app.get(EventPublisher), 'publish');

  const ok = await http.post('/orders').set('Authorization', `Bearer ${ownerToken}`).send({ sku: 'SKU-2', quantity: 1 });
  expect(ok.status).toBe(201);
  expect(emit).toHaveBeenCalledWith(
    expect.objectContaining({ name: OrderEvent.CREATED, payload: expect.objectContaining({ id: (ok.body as { id: string }).id }) }),
  );

  emit.mockRejectedValueOnce(new Error('broker down'));
  const stillOk = await http.post('/orders').set('Authorization', `Bearer ${ownerToken}`).send({ sku: 'SKU-3', quantity: 1 });
  expect(stillOk.status).toBe(201); // side-effect failure never blocks the workflow
});
```

### 6.4 Failure boundary — status AND messageKey, no leakage

Every guard and typed `AppError` has an observable HTTP contract. Pin the status **and** the sanitized `messageKey` the exception filter returns, confirm nothing was persisted on failure, and confirm **no stack / SQL / secret leaks** ([rules 26, 36](../rules/00-non-negotiable-rules.md), [/rules/18-error-handling-and-exceptions.md](../rules/18-error-handling-and-exceptions.md)).

```ts
it('returns 404 for another tenant’s order without leaking it', async () => {
  const res = await http.get(`/orders/${otherTenantOrderId}`).set('Authorization', `Bearer ${ownerToken}`);
  expect(res.status).toBe(404);
  expect(res.body).toMatchObject({ messageKey: 'errors.order.notFound' });
  expect(JSON.stringify(res.body)).not.toMatch(/at \w+\.|select .* from/i); // no stack, no SQL
});

it('returns 400 and persists nothing on a malformed body', async () => {
  const res = await http.post('/orders').set('Authorization', `Bearer ${ownerToken}`).send({ quantity: -1 });
  expect(res.status).toBe(400);
  await expect(orders.findBySku('SKU-bad')).resolves.toHaveLength(0);
});
```

The `messageKey` is locale-agnostic (`errors.<feature>.<key>`); assert the key, never a translated string, so the test holds across every supported locale ([/rules/16-i18n-and-messaging.md](../rules/16-i18n-and-messaging.md)).

---

## 7. Idempotency and safe retry

Network clients retry. E2E must document and prove the intended retry semantics for each state-changing journey.

- **Idempotent operations** (PUT/PATCH/DELETE, or POST guarded by an idempotency key/unique constraint): repeating the identical request produces the **same end state and no duplicate effect** — no second row, no second event, same status.
- **Non-idempotent creates**: state the expectation explicitly (a duplicate create yields a second resource, or a 409 if a uniqueness rule applies). Don't leave it implicit.

```ts
it('treats a repeated update as idempotent — same state, no extra event', async () => {
  const emit = vi.spyOn(app.get(EventPublisher), 'publish');
  const body = { status: OrderStatus.CONFIRMED };

  const first = await http.patch(`/orders/${orderId}`).set('Authorization', `Bearer ${ownerToken}`).send(body);
  const second = await http.patch(`/orders/${orderId}`).set('Authorization', `Bearer ${ownerToken}`).send(body);

  expect(first.status).toBe(200);
  expect(second.status).toBe(200);
  const persisted = await orders.findById(orderId);
  expect(persisted?.status).toBe(OrderStatus.CONFIRMED);
  expect(emit).toHaveBeenCalledTimes(1); // the no-op repeat emits no second event
});

it('rejects a duplicate of a unique resource with 409', async () => {
  await http.post('/accounts').set('Authorization', `Bearer ${ownerToken}`).send({ email: uniqueEmail });
  const dup = await http.post('/accounts').set('Authorization', `Bearer ${ownerToken}`).send({ email: uniqueEmail });
  expect(dup.status).toBe(409);
  expect(dup.body).toMatchObject({ messageKey: 'errors.account.alreadyExists' });
});
```

For concurrent retries (same request fired in parallel), assert no lost writes and no `500` — exactly one succeeds where a uniqueness rule applies; reach for concurrency only at the HTTP edge of a test, never inside a service ([rules/09](../rules/09-performance-and-scalability.md)).

---

## 8. Pagination bounds

Every list endpoint clamps to the hard max (default cap 100). Prove an over-limit request is bounded rather than an unbounded scan ([rule 37](../rules/00-non-negotiable-rules.md)).

```ts
it('clamps take to the hard max', async () => {
  const res = await http.get('/orders?take=10000').set('Authorization', `Bearer ${ownerToken}`);
  expect(res.status).toBe(200);
  expect((res.body as { items: unknown[] }).items.length).toBeLessThanOrEqual(MAX_LIST_LIMIT);
});
```

Also cover: a page past the end returns an empty array (not an error), and a negative/zero page is a 400.

---

## 9. Fixtures, isolation, and determinism

The datastore is **shared across cases in a suite**. Treat isolation as a contract, not a hope. See [/testing/test-data-and-fixtures.md](./test-data-and-fixtures.md) for the canonical fixture conventions.

- **Unique inputs per run.** Derive collision-proof values (`e2e-${Date.now()}@example.test`, unique SKUs) so reruns don't trip unique constraints.
- **Clean up your own rows** via the repository (parameterized) in `afterAll`; never raw-interpolate ids into cleanup SQL ([/skills/sql-injection-review.md](../skills/sql-injection-review.md)).
- **Reset spies** between cases (`afterEach(() => vi.restoreAllMocks())`).
- **Control time** with `vi.useFakeTimers()` for any TTL/expiry-sensitive journey.
- **Seed deterministically** — a fixed admin/owner/viewer principal set, created once, documented in the fixtures module.
- **No external network.** All adapters are overridden (§5); a test must pass offline.

```ts
const runId = Date.now();
const seededEmail = `e2e-${runId}@example.test`; // unique → no constraint collisions
afterEach(() => vi.restoreAllMocks());
afterAll(async () => {
  await orders.deleteByOwner(seededUserId); // your rows only, via the repo
});
```

---

## 10. Location, naming, and execution

- **Location:** E2E specs live apart from source so they run as their own pass — `test/e2e/<feature>.e2e-spec.ts`.
- **Naming:** `describe('<Feature> API (e2e)')`; each `it` names the journey and outcome (`'returns 403 when the caller lacks the permission'`) so a failure explains itself.
- **One boot per suite** in `beforeAll`; isolate state per case, not per boot (booting the app per test is too slow).

```bash
# the file you are writing
npx vitest run test/e2e/order.e2e-spec.ts
# the full e2e pass + coverage (what pre-push exercises)
npm run test:coverage
```

---

## 11. Coverage and the gate

E2E contributes to the workspace coverage floor; it does not replace unit/integration coverage. The critical journeys — auth, authorization, ownership, money/state transitions — should be near 100% ([/testing/coverage-policy.md](./coverage-policy.md)). Drive every change through the full gate ([/testing/quality-gates.md](./quality-gates.md)):

```bash
npm run lint            # 0 errors AND 0 warnings
npm run typecheck       # tsgo --noEmit, project-wide
npm run test            # vitest
npm run test:coverage   # statements/branches/functions/lines ≥ 95% (critical journeys ~100%)
npm run build           # compiles clean
```

Never bypass a hook with `--no-verify`. A green run is not proof of correctness — confirm each journey asserts persisted state, side effects, and the failure boundary, not just the response code. A bug that escaped to production becomes a failing E2E first, then a fix ([/testing/bug-triage-and-retest.md](./bug-triage-and-retest.md), [/skills/investigate-production-bug.md](../skills/investigate-production-bug.md)).

---

## Checklist

- [ ] Boots the real `AppModule`; globals mirror `bootstrap/` (pipe, exception filter, interceptors, guards)
- [ ] Fastify `ready()` awaited after `init()`; `app.close()` in `afterAll`
- [ ] Identity comes from a token the app issued — no forged header, no `userId` in the body
- [ ] Only integration **adapters** overridden; controllers/services/repositories/datastore stay real
- [ ] Required journey matrix covered: happy, read-after-write, validation, AuthN, AuthZ, ownership, not-found, conflict, pagination, idempotency
- [ ] Every write asserts: response contract, persisted state (via repo), emitted side effects, failure boundary
- [ ] Failures assert status **and** `messageKey`; no stack / SQL / secret leaks; nothing persisted on failure
- [ ] Idempotency / safe-retry semantics asserted and documented per state-changing journey
- [ ] List endpoints clamp to the hard max (100); empty page and bad page handled
- [ ] Inputs unique per run; own rows cleaned via the repo; spies reset; no external network
- [ ] No `any`, no `!`, `===`/`!==` only; enum members and named constants, never raw literals
- [ ] `lint` / `typecheck` / `test` / `test:coverage` / `build` all green; no `--no-verify`

**Related:** [/testing/testing-strategy.md](./testing-strategy.md) · [/testing/integration-testing-standard.md](./integration-testing-standard.md) · [/testing/unit-testing-standard.md](./unit-testing-standard.md) · [/testing/coverage-policy.md](./coverage-policy.md) · [/testing/test-data-and-fixtures.md](./test-data-and-fixtures.md) · [/testing/quality-gates.md](./quality-gates.md) · [/skills/write-e2e-tests.md](../skills/write-e2e-tests.md) · [/rules/11-testing-and-coverage.md](../rules/11-testing-and-coverage.md) · [/rules/07-security-authn-authz.md](../rules/07-security-authn-authz.md)
