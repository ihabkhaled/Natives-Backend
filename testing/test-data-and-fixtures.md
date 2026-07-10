# Test Data & Fixtures Standard

> How this workspace builds test data: typed builders/factories, minimal-but-realistic fixtures, per-test isolation, deterministic seeds, anonymization, and explicit permission/tenant coverage. Implements the canon in [/rules/11-testing-and-coverage.md](../rules/11-testing-and-coverage.md), [/testing/testing-strategy.md](./testing-strategy.md), and [/context/stack-and-toolchain.md](../context/stack-and-toolchain.md). Runner is **Vitest 4** + **@nestjs/testing** + **supertest** — never Jest.

Bad test data is the most common cause of false greens and flaky suites. Data must be **typed**, **minimal but realistic**, **deterministic**, **isolated**, and **scoped to the permission/tenant combinations that matter**. A test that depends on hand-created rows, ambient state, or a real clock is a defect.

---

## 1. Principles

| Principle                     | Rule                                                                                                                                                          |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Typed**                     | Every fixture is the real model/DTO type — no `any`, no `as any`, no partial blobs cast to a type. A contract change must break the builder, not production.  |
| **Minimal but realistic**     | Include only the fields the test needs to be meaningful; make values plausible (`'Jane Quinn'`, `'jane@example.test'`) — never `'test123'`, `'foo'`, `'aaa'`. |
| **Deterministic**             | Same inputs → same fixture. No `Date.now()`, no `Math.random()`, no real `randomUUID()` in assertions. Seeds are idempotent (upsert, not insert).             |
| **Isolated**                  | No shared mutable state across tests. Build fresh in `beforeEach`; tests pass in any order.                                                                   |
| **Boundary-aware**            | Fixture sets carry edge values: empty, max length, special chars, each supported locale, null-where-allowed.                                                  |
| **Permission/tenant-diverse** | Fixtures cover every role and at least two tenants/owners so isolation is _tested_, not assumed.                                                              |
| **Anonymized**                | Never embed real personal data, real secrets, or production exports. Synthesize.                                                                              |

---

## 2. Builders over literals (the factory pattern)

Hand-written object literals rot: a new required field breaks every test at once, and copy-paste hides intent. Use a **typed builder with overridable defaults** so each test states only what it cares about.

Builders live in `test/factories/<feature>.factory.ts` (not in `src/` — they are test assets, excluded from coverage). Return the real domain type; default to the _common, valid_ case; let callers override.

```ts
// test/factories/order.factory.ts
// DO — typed builder, valid defaults, narrow overrides
import { Order } from '@modules/order';
import { OrderStatus } from '@modules/order/model/order.enums';

export function buildOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'order-0001',
    ownerId: 'user-0001',
    tenantId: 'tenant-a',
    status: OrderStatus.Draft,
    total: 4200,
    currency: 'USD',
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  };
}
```

```ts
// In a test — only the salient field is named; the rest is implied valid context
const submitted = buildOrder({
  status: OrderStatus.Submitted,
  ownerId: 'user-0002',
});
```

```ts
// DON'T — untyped blob; a new required field silently passes `undefined` into the SUT
const order = { id: 'o1', status: 'DRAFT' } as any; // banned: `any`, raw string, missing fields
```

**Conventions**

- One factory per entity; compose them (`buildOrder({ lines: [buildOrderLine()] })`) rather than duplicating nested literals.
- Name domain values with **enum members and named constants**, never raw strings ([rules 8–9](../rules/00-non-negotiable-rules.md)).
- Add named variants for recurring states instead of repeating override objects: `buildPaidOrder()`, `buildArchivedOrder()`.
- Builders are pure functions — no I/O, no clock, no global counters. Pass ids explicitly; if you need uniqueness, take a `seq` argument.

---

## 3. Minimal but realistic

A fixture that sets every field hides which one drives the behavior; a fixture full of `'a'` proves nothing about real input.

- **Minimal:** include the fields the assertion depends on plus the minimum to construct a valid object. Override only what the scenario changes.
- **Realistic:** plausible names, well-formed emails on a reserved test domain (`@example.test`), in-range numbers, real-shaped ids (`'order-0001'`, a fixed UUID constant — not a fresh random one).
- **Edge-aware:** keep a small library of boundary values so every suite can reach for them.

```ts
// test/fixtures/boundary-values.ts — shared, reusable edge inputs
export const BOUNDARY = {
  emptyString: '',
  maxName: 'N'.repeat(120), // at the DTO @MaxLength
  overMaxName: 'N'.repeat(121), // one past the limit → must be rejected
  unicodeName: 'José Šö Ω 名前', // multi-script, exercises each supported locale path
  controlChars: 'a�b', // null byte
  injectionish: "'; DROP TABLE x; --", // must be treated as data, never executed
  scriptish: '<script>alert(1)</script>',
} as const;
```

> Injection-shaped and script-shaped values belong in **validation/security** tests where you assert they are rejected or stored verbatim as data — see [/skills/sql-injection-review.md](../skills/sql-injection-review.md) and [/rules/08-database-and-injection-safety.md](../rules/08-database-and-injection-safety.md). They are data, never a reason to weaken the repository.

---

## 4. Permission & tenant coverage (mandatory)

Authorization and isolation are only proven when the fixtures contain the _other_ actor. Every protected feature ships fixtures for: each role, the resource owner **and** a non-owner, and at least two tenants.

```ts
// test/fixtures/actors.ts — canonical actors reused across suites
import { UserRole } from '@shared/enums';

export const ACTORS = {
  admin: { id: 'user-admin', tenantId: 'tenant-a', role: UserRole.Admin },
  ownerA: { id: 'user-0001', tenantId: 'tenant-a', role: UserRole.Operator },
  otherUserA: {
    id: 'user-0002',
    tenantId: 'tenant-a',
    role: UserRole.Operator,
  }, // same tenant, not owner
  viewerA: { id: 'user-0003', tenantId: 'tenant-a', role: UserRole.Viewer }, // read-only
  ownerB: { id: 'user-9001', tenantId: 'tenant-b', role: UserRole.Operator }, // different tenant
} as const;
```

| Combination                    | Fixture to provide                                                | Asserted outcome                              |
| ------------------------------ | ----------------------------------------------------------------- | --------------------------------------------- |
| Owner reads own resource       | `buildOrder({ ownerId: ACTORS.ownerA.id, tenantId: 'tenant-a' })` | allowed                                       |
| Same-tenant non-owner reads it | resource owned by `ownerA`, actor `otherUserA`                    | forbidden (IDOR)                              |
| Cross-tenant actor reads it    | resource in `tenant-a`, actor `ownerB`                            | not-found / forbidden — never leaks existence |
| Insufficient role mutates      | actor `viewerA` on a write route                                  | `403`                                         |
| Admin override (if modeled)    | actor `admin`                                                     | per policy, explicitly asserted               |

Identity in tests always comes from the verified token, **never the request body** ([rule 33](../rules/00-non-negotiable-rules.md)). In integration tests, inject identity by overriding the auth guard — see [/skills/write-integration-tests.md](../skills/write-integration-tests.md) and [/rules/07-security-authn-authz.md](../rules/07-security-authn-authz.md).

```ts
// DO — the isolation case names the attacker and the victim explicitly
it("forbids a same-tenant non-owner from reading another user's order", async () => {
  repo.findById.mockResolvedValue(buildOrder({ ownerId: ACTORS.ownerA.id }));
  await expect(
    service.getOwned('order-0001', ACTORS.otherUserA.id),
  ).rejects.toBeInstanceOf(OrderForbiddenError);
});
```

---

## 5. State coverage with named variants

For any entity with a lifecycle, provide a fixture per state so state-machine and filtering logic is exercised. Encode states as named builders, not ad-hoc overrides scattered through suites.

```ts
export const buildDraftOrder = (o: Partial<Order> = {}) =>
  buildOrder({ status: OrderStatus.Draft, ...o });
export const buildSubmittedOrder = (o: Partial<Order> = {}) =>
  buildOrder({ status: OrderStatus.Submitted, ...o });
export const buildPaidOrder = (o: Partial<Order> = {}) =>
  buildOrder({ status: OrderStatus.Paid, total: 4200, ...o });
export const buildArchivedOrder = (o: Partial<Order> = {}) =>
  buildOrder({ status: OrderStatus.Archived, ...o });
```

Cover legal transitions, illegal transitions (domain rejects), terminal states, and the empty/zero case (`buildOrder({ lines: [] })`). Pair each with a domain-policy unit test ([/rules/03-application-services-and-use-cases.md](../rules/03-application-services-and-use-cases.md)).

---

## 6. Isolation: fresh data, no leakage

Each test owns its data. Shared mutable fixtures cause order-dependent passes — the worst kind of flake.

```ts
// DO — build fresh per test; reset doubles between cases
describe('OrderService', () => {
  let service: OrderService;
  let repo: { findById: Mock; save: Mock; list: Mock };

  beforeEach(async () => {
    repo = { findById: vi.fn(), save: vi.fn(), list: vi.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [OrderService, { provide: OrderRepository, useValue: repo }],
    }).compile();
    service = moduleRef.get(OrderService);
  });

  afterEach(() => vi.clearAllMocks()); // call history + impls reset every case
});
```

```ts
// DON'T — module-level mutable fixture shared across tests
const order = buildOrder(); // one mutation in test 1 corrupts test 3
beforeAll(() => repo.save(order)); // beforeAll = shared state = order-dependent flake
```

**Rules**

- Build fixtures **inside** `beforeEach` or the `it`, never at module scope if any test mutates them. A `const` from a pure builder used read-only is fine.
- `vi.clearAllMocks()` in `afterEach` — never `beforeAll` for resettable state.
- Integration/e2e tests that write to a real test DB must clean up what they create (transaction rollback per test, truncate-between, or unique namespacing). See [/testing/integration-testing-standard.md](./integration-testing-standard.md).
- Tests must pass when run in isolation **and** in any order (`vitest run`, `--shuffle`).

---

## 7. Determinism: time, randomness, ids

Non-deterministic fixtures flake under load. Control every source of nondeterminism.

- **Time:** `vi.useFakeTimers().setSystemTime(new Date('2025-01-01T00:00:00Z'))`; restore in `afterEach`. Builder `createdAt`/`updatedAt` are fixed constants, never `new Date()` at call time when the value is asserted.
- **Randomness/ids:** inject the id/token generator and stub it; fixtures use fixed ids (`'order-0001'`) or a sequence helper. Never assert against a real `randomUUID()`.
- **Ordering:** seed lists in a defined order; assert on a sorted/keyed view, not on incidental insertion order.

```ts
// test/fixtures/sequence.ts — deterministic, monotonic ids without global state
export function makeSequence(prefix: string): () => string {
  let n = 0;
  return () => `${prefix}-${String(++n).padStart(4, '0')}`; // order-0001, order-0002, ...
}
```

```ts
beforeEach(() =>
  vi.useFakeTimers().setSystemTime(new Date('2025-01-01T00:00:00Z')),
);
afterEach(() => vi.useRealTimers());
```

---

## 8. Mock the boundary, not the unit

Test data feeds the **doubles at a layer boundary**, never the unit under test.

| Unit under test          | Feed fixtures into                                                        | Never stub                                   |
| ------------------------ | ------------------------------------------------------------------------- | -------------------------------------------- |
| `<feature>.service.ts`   | repository / adapter return values                                        | the domain policies it calls                 |
| `<action>.use-case.ts`   | the services it orchestrates, the transaction runner, the event publisher | —                                            |
| `domain/*.policy.ts`     | direct function inputs (no mocks)                                         | —                                            |
| controller (integration) | overridden guard identity + supertest body                                | the real `ValidationPipe` / exception filter |

```ts
// DO — fixture drives the repository double; real service logic runs
repo.findById.mockResolvedValue(buildPaidOrder({ ownerId: ACTORS.ownerA.id }));
const result = await service.refund('order-0001', ACTORS.ownerA.id);
expect(result.status).toBe(OrderStatus.Refunded);
```

Vendors/SDKs are always doubled behind their adapter — fixtures stand in for vendor responses; no test ever calls a real email provider, object storage, SMS gateway, payment provider, or cache ([/rules/12-library-wrapping-and-adapters.md](../rules/12-library-wrapping-and-adapters.md)).

---

## 9. Seeds for integration / e2e / local dev

Seed scripts populate a real test database for integration/e2e suites and local development. They are not for unit tests (those use builders + mocks).

- **Idempotent:** seed twice → same state. Upsert by a stable key; never blind-insert.
- **Well-known ids:** cross-referencing fixtures share fixed ids so relations resolve deterministically. Pin them in one place and never change them.
- **Reproducible from scratch:** the suite (and a new engineer) can rebuild the whole dataset from the seed alone — no manual rows.
- **ORM-agnostic:** the seed talks to repositories or the project's ORM (TypeORM / Prisma / Mongoose / Sequelize are interchangeable examples) — keep vendor specifics behind the persistence layer ([/rules/04-repositories-and-persistence.md](../rules/04-repositories-and-persistence.md)).
- **Layered seeds:** keep baseline, edge-case, and negative-case data in separate, composable seed modules so a suite loads only what it needs.

```ts
// test/seeds/well-known-ids.ts — single source of truth for cross-fixture references
export const WELL_KNOWN = {
  tenantA: 'tenant-a',
  tenantB: 'tenant-b',
  adminUser: 'user-admin',
  ownerA: 'user-0001',
  orderA: 'order-0001',
} as const; // never change these — relations across seeds depend on them
```

```ts
// test/seeds/orders.seed.ts — idempotent upsert through the repository, deterministic data
export async function seedOrders(repo: OrderRepository): Promise<void> {
  await repo.upsert(
    buildPaidOrder({ id: WELL_KNOWN.orderA, ownerId: WELL_KNOWN.ownerA }),
  );
  await repo.upsert(
    buildArchivedOrder({ id: 'order-0002', ownerId: WELL_KNOWN.ownerA }),
  );
  await repo.upsert(
    buildDraftOrder({
      id: 'order-9001',
      ownerId: WELL_KNOWN.ownerA,
      tenantId: WELL_KNOWN.tenantB,
    }),
  );
}
```

Seeds that create durable state must order their inserts by dependency (users before the rows that reference them) and are reviewed with the same care as schema changes when they shape product behavior. Migrations and backfills are separate — see [/skills/add-migration-backfill.md](../skills/add-migration-backfill.md).

---

## 10. Anonymization & secret hygiene

Test data must never expose real people or real credentials.

- **No production exports.** Synthesize data with builders; if a real-shaped dataset is unavoidable, anonymize (mask names/emails/phones, scrub free-text) before it leaves a secure environment.
- **Reserved test identities:** emails on `@example.test`, obviously fictional names, fixed fake ids.
- **No real secrets, tokens, or keys.** Test credentials are clearly fake placeholders that fail against any real provider; encrypted-config fixtures encrypt placeholders with a test-only key from typed config — never `process.env` in a test, never a committed `.env` ([/rules/17-configuration-and-environment.md](../rules/17-configuration-and-environment.md)).
- **No PII in committed fixtures, logs, or evidence.** A fixture or test log that leaks protected data is a security defect ([/rules/14-observability-and-logging.md](../rules/14-observability-and-logging.md)).

> When an escaped defect inspires a new test, preserve a **synthesized** reproduction of the triggering shape in fixtures — not the raw production payload. See [/testing/bug-triage-and-retest.md](./bug-triage-and-retest.md).

---

## 11. Layout

```text
test/
  factories/        <feature>.factory.ts        # typed builders + named state variants
  fixtures/         actors.ts, boundary-values.ts, sequence.ts
  seeds/            well-known-ids.ts, <feature>.seed.ts   # integration/e2e/local only
src/modules/<feature>/.../<file>.spec.ts          # specs live beside the source
```

Factories, fixtures, and seeds live under `test/` and are **excluded from the coverage denominator** (they are test assets, not product logic) — see [/testing/coverage-policy.md](./coverage-policy.md). Keep them as carefully reviewed as the code they support.

---

## Quality gate

```bash
npm run lint            # 0 errors AND 0 warnings (no `any`/`!` in factories or fixtures)
npm run typecheck       # tsc --noEmit (TypeScript 7), project-wide
npm run test            # vitest run — full suite, must pass in any order
npm run test:coverage   # statements/functions/lines ≥95%; measured branches ≥90%; real critical branches ~100%
npm run build           # compiles clean
```

Never bypass a hook with `--no-verify`. Run `vitest run --shuffle` periodically — a failure under shuffle means a fixture is leaking state.

---

## Checklist

- [ ] Every fixture is the real typed model/DTO — no `any`, no casts, no missing required fields
- [ ] Built via a factory with valid defaults; tests override only the salient field
- [ ] Values are minimal but realistic; boundary values pulled from a shared edge library
- [ ] Domain values use enum members / named constants, never raw strings
- [ ] Permission/tenant fixtures include owner, same-tenant non-owner, cross-tenant, and each role
- [ ] State-machine entities have a named variant per state, with illegal-transition coverage
- [ ] Fresh data per test; `vi.clearAllMocks()` in `afterEach`; passes under `--shuffle`
- [ ] Time, randomness, and ids are deterministic — no `Date.now()`/`Math.random()`/real UUIDs in assertions
- [ ] Seeds are idempotent, use well-known ids, and rebuild the dataset from scratch
- [ ] No production data, real PII, or real secrets — synthesized and anonymized
- [ ] Factories/fixtures/seeds under `test/`, excluded from coverage, reviewed like code

**Related:** [/testing/testing-strategy.md](./testing-strategy.md) · [/testing/unit-testing-standard.md](./unit-testing-standard.md) · [/testing/integration-testing-standard.md](./integration-testing-standard.md) · [/testing/e2e-testing-standard.md](./e2e-testing-standard.md) · [/testing/coverage-policy.md](./coverage-policy.md) · [/testing/bug-triage-and-retest.md](./bug-triage-and-retest.md) · [/rules/11-testing-and-coverage.md](../rules/11-testing-and-coverage.md) · [/skills/write-unit-tests.md](../skills/write-unit-tests.md) · [/memory/testing-strategy.md](../memory/testing-strategy.md) · [/memory/known-pitfalls.md](../memory/known-pitfalls.md)
