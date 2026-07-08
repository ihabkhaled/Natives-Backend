# 04 — Repositories & Persistence

> The persistence layer of the canon in [/context/architecture-map.md](../context/architecture-map.md). A repository does **one** thing: parameterized, bounded data access. **Zero** business logic, **zero** authorization, **zero** transformation, **zero** error vocabulary. It returns raw entities or `null`; the service/use-case decides everything else. ORM-agnostic by design — TypeORM, Prisma, Mongoose, and Sequelize are interchangeable examples behind the same contract.

Enforces non-negotiable rules **19, 20, 31, 36, 37** from [00-non-negotiable-rules.md](./00-non-negotiable-rules.md).

Related: [03-application-services-and-use-cases.md](./03-application-services-and-use-cases.md) · [05-dto-and-validation.md](./05-dto-and-validation.md) · [07-security-authn-authz.md](./07-security-authn-authz.md) · [08-database-and-injection-safety.md](./08-database-and-injection-safety.md) · [09-performance-and-scalability.md](./09-performance-and-scalability.md)

---

## 1. A repository is persistence and nothing else

Lives at `infrastructure/<feature>.repository.ts`. It is `@Injectable`, receives its ORM client/data source by constructor DI, exposes named query methods, and returns the raw entity (or `{ items, total }`, or `null`). It never knows who is asking or why.

```ts
// Do — thin, typed, persistence-only (TypeORM example)
@Injectable()
export class OrderRepository {
  constructor(
    @InjectRepository(Order) private readonly orders: Repository<Order>,
  ) {}

  async findById(id: string): Promise<Order | null> {
    return this.orders.findOne({ where: { id, deletedAt: IsNull() } });
  }
}
```

```ts
// Don't — authorization + user-facing error + mapping inside the repo
@Injectable()
export class OrderRepository {
  async findOwned(id: string, userId: string): Promise<OrderResponseDto> {
    const order = await this.orders.findOneBy({ id });
    if (!order) throw new OrderNotFoundError(); // ❌ rule 26 belongs to the service
    if (order.ownerId !== userId) throw new ForbiddenError(); // ❌ rule 35 belongs to the service
    return toOrderResponse(order); // ❌ mapping belongs to lib/
  }
}
```

### Allowed vs. banned

| Allowed in a repository                                                                                | Banned — push up to service / domain / lib                                                                                      |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `find` / `findOne` / `findAndCount` / `save` / `insert` / `update` / `softDelete` / `count` / `exists` | Ownership or tenant **decisions** (`if (row.ownerId !== userId) throw …`) → service/domain ([07](./07-security-authn-authz.md)) |
| Query-builder joins/aggregations the find API can't express                                            | Throwing typed `AppError` / `messageKey` → service ([18](./18-error-handling-and-exceptions.md))                                |
| Conditional query building (add a filter only when an arg is present)                                  | Status-transition rules, pricing, scoring → `domain/`                                                                           |
| Pagination math (`skip`/`take`) + ordering                                                             | DTO mapping / response shaping → `lib/<feature>.mappers.ts`                                                                     |
| Filtering soft-deleted rows; tenant scoping it owns (§7)                                               | Reading config, calling adapters, emitting events → service/use-case                                                            |
| `logger.debug` tracing via the [@core/logger](./14-observability-and-logging.md) adapter               | `console.*`; cross-module repository imports                                                                                    |

> Repositories return data or `null`. They never decide; they never throw a domain error. A not-found is `null`, an empty list is `[]` — the service translates that into a `messageKey`.

---

## 2. ORM-agnostic: same contract, swappable engine

The repository **is** the swap surface. Business code depends on the repository's typed method signatures, never on the ORM. The same `findById(id): Promise<Order | null>` contract is satisfied identically by any engine:

```ts
// Prisma — same signature, different engine, still persistence-only
@Injectable()
export class OrderRepository {
  constructor(private readonly db: PrismaService) {}

  async findById(id: string): Promise<Order | null> {
    return this.db.order.findFirst({ where: { id, deletedAt: null } });
  }
}
```

```ts
// Mongoose — same signature again
@Injectable()
export class OrderRepository {
  constructor(@InjectModel(Order.name) private readonly model: Model<Order>) {}

  async findById(id: string): Promise<Order | null> {
    return this.model
      .findOne({ _id: id, deletedAt: null })
      .lean<Order>()
      .exec();
  }
}
```

Rules that hold for **every** engine:

- The ORM client/model is imported **only** here (or inside an adapter) — the architecture ESLint plugin forbids it elsewhere. See [12-library-wrapping-and-adapters.md](./12-library-wrapping-and-adapters.md).
- Use the ORM's typed query builders. **No raw SQL string interpolation** ([08](./08-database-and-injection-safety.md)).
- Type every result with a generic — no `any`, no non-null assertions (rules 3, 7).
- Methods are `async` with an explicit return type that is the entity / `{ items, total }` / `null` — never a DTO.

---

## 3. Parameterized queries only

The find API (`where`, `order`, `In`, `LessThan`, `IsNull`, …) is parameterized by construction — prefer it. When you drop to a query builder, **every** runtime value is a bound parameter.

```ts
// Do — bound parameters, typed raw result
const summary = await this.orders
  .createQueryBuilder('o')
  .select('MAX(o.revision)', 'maxRevision')
  .where('o.account_id = :accountId', { accountId })
  .andWhere('o.deleted_at IS NULL')
  .getRawOne<{ maxRevision: number | null }>();
```

```ts
// Don't — interpolation is SQL injection; unbound identifier from the client
.where(`o.account_id = '${accountId}'`)   // ❌ never interpolate values
.orderBy(query.sortBy)                      // ❌ never feed a client string into orderBy/select
```

**Identifiers are not parameterizable.** Column/table names in `orderBy`/`select` can never come from the client directly. Whitelist them through a `Record<string, string>` map in `model/<feature>.constants.ts`; the DTO validates the key, the constant resolves the safe column. Detail in [08-database-and-injection-safety.md](./08-database-and-injection-safety.md) and [05-dto-and-validation.md](./05-dto-and-validation.md).

---

## 4. Pagination is mandatory and bounded (max 100)

**No list method returns an unbounded result set.** Every list query takes `page`/`limit`, clamps `limit` to a hard max of **100**, requires a stable `ORDER BY`, and returns the total so the caller can paginate.

```ts
// Do — bounded, ordered, returns { items, total }; query DTO already capped, repo defends again
async listByAccount(
  accountId: string,
  options: ListOptions,
): Promise<{ items: Order[]; total: number }> {
  const page = options.page ?? DEFAULT_PAGE;
  const limit = Math.min(options.limit ?? DEFAULT_LIMIT, MAX_LIST_LIMIT); // MAX_LIST_LIMIT = 100
  const [items, total] = await this.orders.findAndCount({
    where: { accountId, deletedAt: IsNull() },
    order: { createdAt: 'DESC' },
    skip: (page - 1) * limit,
    take: limit,
  });
  return { items, total };
}
```

```ts
// Don't — unbounded scan, no cap, no order, no total
async listByAccount(accountId: string): Promise<Order[]> {
  return this.orders.find({ where: { accountId } }); // ❌ grows to the whole table
}
```

- `MAX_LIST_LIMIT`, `DEFAULT_PAGE`, `DEFAULT_LIMIT` are named constants in a `*.constants.ts` (rule 8) — never inline literals.
- The cap is enforced **twice**: in the query DTO ([05](./05-dto-and-validation.md)) **and** defensively in the repository. Defense in depth.
- Prefer one round-trip that returns the count (`findAndCount`, `count` alongside `findMany`) over two separate calls.
- **`order` is required** — paging without a deterministic sort yields unstable pages.
- Pagination + filter shaping is the repository's job; computing/clamping happens once and is reused. See [09-performance-and-scalability.md](./09-performance-and-scalability.md) for keyset pagination on hot paths.

---

## 5. Soft delete, filtering, and indexing the query patterns you add

- **Every read filters out soft-deleted rows** (`deletedAt: IsNull()` / `deletedAt: null`) on **every** branch — a missing filter silently resurrects deleted data.
- **Deletes are soft by default** (`softDelete` / set `deletedAt`); reserve hard delete for genuinely transient rows and call it out in review.
- **Index every new query shape in the same change.** Most ORMs do not auto-index foreign keys. Before merging a new repository method:

  - [ ] Every column in the new `WHERE` is indexed.
  - [ ] Every FK column you filter or join on is indexed.
  - [ ] Every `ORDER BY` column is indexed (or part of a composite covering filter + sort).
  - [ ] Common multi-column filters use a **composite** index in matching column order (e.g. `[accountId, status]`).
  - [ ] The soft-delete predicate is covered (partial index or composite member) so the live-row hot path stays fast.

Declare indexes on the entity/schema (or in a migration when a decorator can't express it). Leave a one-line `// WHY` comment naming the query a non-obvious index serves. Migrations are owned by the [add-migration-backfill.md](../skills/add-migration-backfill.md) skill and planned via [migration-plan.md](../skills/migration-plan.md).

---

## 6. No N+1; transactions are owned by the caller

### No N+1

Load relations in one query, or batch ids with an `In([...])` clause. Never loop a `findOne` per row.

```ts
// Do — single batched read
await this.orders.find({ where: { id: In(ids), deletedAt: IsNull() } });
```

```ts
// Don't — N round-trips
for (const id of ids) {
  await this.orders.findOne({ where: { id } }); // ❌ N+1 + await-in-loop
}
```

### The transaction handle is passed in, never created here

Multi-write invariants run in **one** transaction — but the boundary is owned by the **use case** ([03](./03-application-services-and-use-cases.md)), not the repository. The use case opens the transaction, threads the handle (`EntityManager` / `Prisma.TransactionClient` / `ClientSession`) into each repository method, and guarantees commit/rollback/release.

```ts
// Do — repository accepts an optional transaction handle; falls back to the default client
async save(order: Order, manager?: EntityManager): Promise<Order> {
  const repo = manager ? manager.getRepository(Order) : this.orders;
  return repo.save(order);
}
```

```ts
// Use case owns the boundary (illustrative): one transaction, always released
await this.uow.runInTransaction(async manager => {
  await this.orderRepository.save(order, manager);
  await this.invoiceRepository.save(invoice, manager);
}); // commit on success, rollback + release on throw — inside the use case, not the repo
```

- A repository must **not** open a transaction, call `commit`/`rollback`, or manage connection lifecycle — that lives in the use case ([03](./03-application-services-and-use-cases.md)).
- Single-statement writes are atomic; they need no explicit transaction.
- Keep transactions small: no adapter/network calls, no read-only padding inside the boundary.

---

## 7. Tenant scoping the repository owns

When the data model is multi-tenant and the repository is the layer responsible for scoping, **every** query is scoped by the tenant key — and that key comes from the caller (derived from the verified token upstream, never the client body). This is defense in depth alongside the application-layer ownership check in [07-security-authn-authz.md](./07-security-authn-authz.md).

```ts
// Do — tenant key is a required parameter on every query that touches tenant data
async findByIdForTenant(id: string, tenantId: string): Promise<Order | null> {
  return this.orders.findOne({ where: { id, tenantId, deletedAt: IsNull() } });
}
```

```ts
// Don't — un-scoped lookup invites cross-tenant reads (IDOR)
async findById(id: string): Promise<Order | null> {
  return this.orders.findOne({ where: { id } }); // ❌ any tenant can read any row by id
}
```

- Make `tenantId` a non-optional parameter so the compiler refuses an un-scoped call.
- The repository **enforces** the scope; the application layer **also** verifies ownership. Two independent checks; neither replaces the other.
- Where to record the project's tenant key and scoping strategy: [/memory/security-decisions.md](../memory/security-decisions.md).

---

## 8. Repository PR checklist

- [ ] Class is `@Injectable`, wraps **one** entity/model from injected DI, lives at `infrastructure/<feature>.repository.ts`.
- [ ] No authorization, no `messageKey` throws, no DTO mapping, no adapter/event side effects.
- [ ] Returns raw entity / `{ items, total }` / `null` — never a DTO, never throws a domain error.
- [ ] Engine-specific code stays here; signatures are ORM-agnostic (rule 32).
- [ ] All runtime values are bound parameters; identifiers come from a whitelist constant — no interpolation (rule 31).
- [ ] Every list method is paginated, `order`ed, and `limit`-capped at ≤ 100, returning a total (rule 37).
- [ ] Every read filters soft-deleted rows; deletes are soft unless justified.
- [ ] New `WHERE` / `ORDER BY` / FK columns are indexed; soft-delete predicate covered.
- [ ] No N+1; transaction handles are passed in from the use case, never created here.
- [ ] Tenant-scoped queries take a required tenant key derived from the verified token (rule 35).
- [ ] No inline types/enums/constants (rules 10–16); no `any`/`!` (rules 3, 7).
- [ ] `npm run lint` · `npm run typecheck` · `npm run test` green; `npm run test:coverage` ≥ 95% on the touched repository.

Related: [03-application-services-and-use-cases.md](./03-application-services-and-use-cases.md) · [08-database-and-injection-safety.md](./08-database-and-injection-safety.md) · [09-performance-and-scalability.md](./09-performance-and-scalability.md) · [/skills/create-repository.md](../skills/create-repository.md) · [/memory/database-decisions.md](../memory/database-decisions.md) · [/memory/known-pitfalls.md](../memory/known-pitfalls.md)
