# Integration Testing Standard

> The house standard for integration tests: wire a real `TestingModule`, run against a **real database** in a throwaway container, drive HTTP through supertest, and assert on **persisted state and emitted events** — not just status codes. Implements the canon in [/context/architecture-map.md](../context/architecture-map.md), [/testing/testing-strategy.md](./testing-strategy.md), and [11-testing-and-coverage.md](../rules/11-testing-and-coverage.md).

## What an integration test is (and is not)

Unit tests mock boundaries and prove one unit in isolation ([unit-testing-standard.md](./unit-testing-standard.md)). Integration tests prove the seams: the controller → use case/service → repository → **real datastore** path, plus the events that fire after commit. E2E tests boot the whole app and exercise it as a black box ([e2e-testing-standard.md](./e2e-testing-standard.md)).

| Layer | Wiring | Datastore | Network in | Mock surface |
| --- | --- | --- | --- | --- |
| Unit | `new Service(...)` or tiny module | none | none | every collaborator |
| **Integration** | `TestingModule` (feature module) | **real, in a container** | supertest (in-process) | only true externals (adapters) |
| E2E | full `AppModule` | real | supertest / HTTP | nothing internal |

Rule of thumb: an integration test fails when **wiring, SQL, mappers, transactions, or event ordering** are wrong — exactly the bugs unit tests cannot see.

## What every integration test must verify

1. **HTTP contract** — status, shape, and that the global `ValidationPipe` + exception filter behave.
2. **Persistence** — the row/document actually exists with the right values (read it back through the repository, not the response).
3. **Events** — the expected domain event(s) were emitted **after commit**, with the right payload and ordering.
4. **Authorization** — identity comes from the verified token; ownership/tenant scoping holds (see [07-security-authn-authz.md](../rules/07-security-authn-authz.md)).
5. **Isolation** — the test leaves the datastore as clean as it found it.

## Real database via a container — not mocks

Spin a disposable datastore per test run with [Testcontainers](https://node.testcontainers.org/), keep it behind the **repository** (the ORM is an interchangeable example — TypeORM / Prisma / Mongoose / Sequelize are equivalent here), and never let a vendor client leak into the test body.

```typescript
// test/support/database.fixture.ts — example uses a generic SQL container
import { GenericContainer, type StartedTestContainer } from 'testcontainers';

export interface DbHandle {
  readonly url: string;
  stop(): Promise<void>;
}

export async function startTestDatabase(): Promise<DbHandle> {
  const container: StartedTestContainer = await new GenericContainer('postgres:16-alpine')
    .withEnvironment({ POSTGRES_DB: 'app_test', POSTGRES_USER: 'app', POSTGRES_PASSWORD: 'app' })
    .withExposedPorts(5432)
    .start();

  const url = `postgres://app:app@${container.getHost()}:${container.getMappedPort(5432)}/app_test`;
  return { url, stop: () => container.stop() };
}
```

**Do** run migrations against the fresh container before the suite — same migration command the app uses, never `synchronize`-on-boot. **Don't** point integration tests at a shared dev/staging database; flaky data and cross-talk follow.

## Wiring the TestingModule

Import the **feature module** so DI, pipes, guards, and the repository binding are real. Override only true externals (vendor adapters, the clock, outbound providers) so the test stays deterministic and offline.

```typescript
// test/order.integration.spec.ts
import { Test, type TestingModule } from '@nestjs/testing';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';
import { OrderModule } from '@modules/order';
import { CONFIG_TOKEN } from '@config/config.tokens';
import { EmailGateway } from '@modules/order/adapters/email.gateway';
import { startTestDatabase, type DbHandle } from './support/database.fixture';

describe('Order (integration)', () => {
  let app: NestFastifyApplication;
  let db: DbHandle;
  const emailGateway = { send: vi.fn().mockResolvedValue(undefined) };

  beforeAll(async () => {
    db = await startTestDatabase();
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [OrderModule],
    })
      .overrideProvider(CONFIG_TOKEN)
      .useValue({ database: { url: db.url }, list: { maxLimit: 100 } })
      .overrideProvider(EmailGateway) // real external → fake at the adapter boundary
      .useValue(emailGateway)
      .compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    await app.getHttpAdapter().getInstance().ready(); // Fastify must be ready before requests
  });

  afterAll(async () => {
    await app.close();
    await db.stop();
  });
});
```

> Mock at the **adapter** boundary only ([12-library-wrapping-and-adapters.md](../rules/12-library-wrapping-and-adapters.md)). Mocking the repository or a service turns an integration test back into a unit test and proves nothing about the seam.

## Driving HTTP with supertest

Inject identity through a real (or test-signed) token, never through the body — that is the contract under test.

```typescript
it('creates an order and returns 201 with the persisted id', async () => {
  const token = await signTestToken({ sub: 'user-1', roles: ['customer'] });

  const res = await request(app.getHttpServer())
    .post('/orders')
    .set('Authorization', `Bearer ${token}`)
    .send({ items: [{ sku: 'A-1', quantity: 2 }] })
    .expect(201);

  expect(res.body).toMatchObject({ id: expect.any(String), status: 'PENDING' });
});

it('rejects an unknown field via the global ValidationPipe', async () => {
  await request(app.getHttpServer())
    .post('/orders')
    .set('Authorization', `Bearer ${await signTestToken({ sub: 'user-1' })}`)
    .send({ items: [], injected: true })
    .expect(400); // whitelist + forbidNonWhitelisted
});
```

## Verifying persistence

Do not trust the response. Read state back through the repository and assert the **stored truth**.

```typescript
// Do — assert persisted state, not the echo
it('persists the order owned by the caller', async () => {
  const token = await signTestToken({ sub: 'user-1', roles: ['customer'] });
  const { body } = await request(app.getHttpServer())
    .post('/orders').set('Authorization', `Bearer ${token}`)
    .send({ items: [{ sku: 'A-1', quantity: 2 }] }).expect(201);

  const repo = app.get(OrderRepository);
  const stored = await repo.findById(body.id);
  expect(stored).not.toBeNull();
  expect(stored?.ownerId).toBe('user-1'); // identity from token, not body
  expect(stored?.items).toHaveLength(1);
});
```

```typescript
// Don't — this only proves the controller echoed its input back
expect(res.body.ownerId).toBe('user-1');
```

For write-then-read flows, also verify the negative: a failed transaction must leave **no** partial row.

```typescript
it('rolls back fully when a post-validation step throws', async () => {
  emailGateway.send.mockRejectedValueOnce(new Error('provider down'));
  await request(app.getHttpServer()).post('/orders') /* ... */ .expect(500);
  const repo = app.get(OrderRepository);
  expect(await repo.countByOwner('user-1')).toBe(0); // no orphan
});
```

## Verifying emitted events

Domain events fire **after commit** (see [19-async-events-and-jobs.md](../rules/19-async-events-and-jobs.md)). Subscribe through the real event bus and assert pattern, payload, and order. Keep async handlers' side effects mocked at their adapter so the test stays fast and deterministic.

```typescript
it('emits order.created after the transaction commits', async () => {
  const events = app.get(EventBus); // @core/events wrapper, not the raw library
  const captured: Array<{ pattern: string; payload: unknown }> = [];
  const sub = events.subscribe('order.*', (pattern, payload) =>
    captured.push({ pattern, payload }),
  );

  await request(app.getHttpServer())
    .post('/orders').set('Authorization', `Bearer ${token}`)
    .send({ items: [{ sku: 'A-1', quantity: 1 }] }).expect(201);

  await waitFor(() => captured.length === 1); // poll a condition, never sleep(n)
  expect(captured[0]).toMatchObject({
    pattern: 'order.created',
    payload: { orderId: expect.any(String), ownerId: 'user-1' },
  });
  sub.unsubscribe();
});
```

> For multi-entity use cases that emit **ordered** post-commit events, assert the sequence (`captured.map(e => e.pattern)`) — order is part of the contract.

### Deterministic async — `waitFor`, never `sleep`

```typescript
async function waitFor(
  predicate: () => boolean | Promise<boolean>,
  { timeoutMs = 2000, stepMs = 25 }: { timeoutMs?: number; stepMs?: number } = {},
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise(r => setTimeout(r, stepMs));
  }
  throw new Error('waitFor: condition not met within timeout');
}
```

Arbitrary `sleep(10_000)` is banned — it is slow on green and flaky on red. Poll a real signal (persisted row, captured event, queue depth) with a bounded timeout.

## Isolation and cleanup

Pick one strategy and apply it suite-wide. Tests must be order-independent and safe to re-run.

| Strategy | How | Use when |
| --- | --- | --- |
| **Transaction rollback** | Wrap each test in a transaction, roll back in `afterEach` | Fastest; works when the code under test doesn't manage its own commit boundary |
| **Truncate between tests** | `afterEach` truncates touched tables (respect FK order / cascade) | Default for use cases that commit their own transactions |
| **Fresh container per file** | One container per spec file | Maximum isolation for migration/schema-sensitive suites |

```typescript
afterEach(async () => {
  emailGateway.send.mockClear();
  const reset = app.get(TestDataReset); // a thin helper behind the repository layer
  await reset.truncateAll(); // ordered truncate, never raw SQL scattered in tests
});
```

**Do** seed via factories/fixtures that build only the minimum realistic data ([test-data-and-fixtures.md](./test-data-and-fixtures.md)). **Don't** rely on data left behind by another test, and **don't** share mutable state across files.

## Coverage and naming

- File name: `<feature>.integration.spec.ts`, colocated under `test/` or beside the module per the project layout.
- Integration tests count toward the **95% floor**; critical write/auth/transaction paths aim near 100% ([coverage-policy.md](./coverage-policy.md)).
- One concern per `it`; the title states scenario + expected outcome so a failure explains itself.

## Anti-patterns

- Mocking the repository, ORM, or a service — that is a unit test wearing an integration costume.
- Asserting only on the HTTP response body and calling it "persisted".
- Sharing one long-lived container across unrelated suites without cleanup.
- `sleep()` to "wait for the event"; reading `process.env` or `console.*` in tests (use config + the logger adapter).
- Letting a real outbound provider (email, SMS, object storage, payment) fire during a test — fake it at the adapter.

## Checklist

- [ ] `TestingModule` imports the **feature module**; only true externals are overridden at the adapter boundary.
- [ ] Datastore is a **real container**; migrations run before the suite; no shared dev/staging DB.
- [ ] Fastify `ready()` (or equivalent) awaited before the first request.
- [ ] Identity supplied via token; ownership/tenant scoping asserted.
- [ ] Persistence verified by reading **back through the repository**, including the rollback/negative case.
- [ ] Emitted events asserted on pattern, payload, and order, after commit.
- [ ] Async verified with bounded `waitFor`, never `sleep`.
- [ ] One isolation strategy applied suite-wide; `afterEach` cleans state and mocks.
- [ ] Touched-module coverage ≥ 95% (critical paths near 100%).
- [ ] `<feature>.integration.spec.ts` naming; one concern per `it`.

## Quality gate

```bash
npm run lint            # 0 errors AND 0 warnings
npm run typecheck       # tsgo --noEmit, project-wide
npm run test            # vitest
npm run test:coverage   # 95% floor enforced
npm run build           # compiles clean
```

Related: [testing-strategy.md](./testing-strategy.md) · [unit-testing-standard.md](./unit-testing-standard.md) · [e2e-testing-standard.md](./e2e-testing-standard.md) · [test-data-and-fixtures.md](./test-data-and-fixtures.md) · [quality-gates.md](./quality-gates.md) · [11-testing-and-coverage.md](../rules/11-testing-and-coverage.md) · [19-async-events-and-jobs.md](../rules/19-async-events-and-jobs.md) · [/skills/write-integration-tests.md](../skills/write-integration-tests.md)
