# Database Decisions

> Durable persistence conventions for a NestJS backend in this workspace: an ORM-agnostic repository boundary, migration discipline, bounded pagination, tenant scoping, and transaction ownership. Implements the canon in [/context/architecture-map.md](../context/architecture-map.md) and the hard rules in [00-non-negotiable-rules.md](../rules/00-non-negotiable-rules.md). Layer detail: [04-repositories-and-persistence.md](../rules/04-repositories-and-persistence.md), [08-database-and-injection-safety.md](../rules/08-database-and-injection-safety.md), [09-performance-and-scalability.md](../rules/09-performance-and-scalability.md).

This file states **decisions and rationale**, not a product schema. Every place a concrete codebase must record its own choices is marked **`Project records:`**. The constants here (the layering, the bounds, the discipline) hold across stacks; the variables (engine, ORM, table names) are the project's to fill in.

---

## Decision 1 — The ORM is an implementation detail, hidden behind the repository

**Decision.** The chosen ORM lives **only** inside `infrastructure/<feature>.repository.ts` (or an adapter). No service, use case, controller, domain file, or DTO imports the ORM client, its query builder, or its entity decorators. Business code depends on the repository's typed methods, never on the vendor.

**Rationale.** TypeORM, Prisma, Mongoose, and Sequelize are interchangeable behind this boundary. Swapping engines must change one directory, not hundreds of call sites. The ESLint rule `architecture/no-restricted-layer-imports` mechanically blocks vendor imports outside adapter/infrastructure paths — treat a violation as an architecture bug, not a style nit.

```ts
// DO — repository owns the ORM; returns domain shapes
@Injectable()
export class OrderRepository {
  constructor(@InjectRepository(OrderEntity) private readonly repo: Repository<OrderEntity>) {}

  findById(id: string, tenantId: string): Promise<OrderEntity | null> {
    return this.repo.findOne({ where: { id, tenantId } });
  }
}
```

```ts
// DON'T — service reaches into the ORM and leaks vendor types upward
async getOrder(id: string): Promise<OrderEntity> {
  return this.dataSource.getRepository(OrderEntity).findOneOrFail({ where: { id } }); // ORM in the service
}
```

> **Project records:** the engine (e.g. PostgreSQL / MySQL / MongoDB), the ORM and version, the connection/config file, and any secondary stores (cache, log store, search index) with their owning adapters in [library-boundaries.md](./library-boundaries.md).

---

## Decision 2 — Repositories persist; nothing else

A repository exposes find / save / update / delete / query-building with **stable, typed contracts**. It holds **no** business policy, **no** branching beyond query construction, **no** user-facing transformation. It returns raw entities; mapping to response shapes happens in `lib/<feature>.mappers.ts`, decisions happen in `domain/`, orchestration happens in services/use cases.

If a repository method fills with `if/else` business branches, the ownership model is wrong — push the decision up to the domain or service layer. See [04-repositories-and-persistence.md](../rules/04-repositories-and-persistence.md).

---

## Decision 3 — Schema changes ship as migrations, never auto-sync

**Decision.** Schema evolution is **migration-only**. Auto-synchronize / auto-DDL features are **disabled in every environment**, including local. The schema is a reviewable, ordered, version-controlled sequence.

**Conventions.**

- Migrations live in a dedicated directory and are **ordered by a numeric prefix** (`0001-…`, `0002-…`) so they sort and apply deterministically. The prefix, not the filename mood, defines order.
- **Never edit a migration that has shipped.** Forward-fix with a new additive migration. An applied migration is immutable history.
- Migrations are **discovered**, not hand-listed, where the toolchain supports a glob — adding a file is enough; no central registry to forget.
- Generation, application, and rollback run through documented commands, not ad-hoc shell. See [add-migration-backfill.md](../skills/add-migration-backfill.md) and [migration-plan.md](../skills/migration-plan.md).
- Each migration declares **up and down**; a change without a tested rollback path is incomplete ([10-reliability-and-durability.md](../rules/10-reliability-and-durability.md)).

```ts
// DON'T — synchronize on; schema drifts silently, no audit trail, data loss risk
TypeOrmModule.forRoot({ type: 'postgres', synchronize: true });
```

> **Project records:** migrations directory + prefix scheme, the generate/run/revert commands, how migrations run on startup vs. CI vs. release, and any glob/path quirks for the host OS in [known-pitfalls.md](./known-pitfalls.md).

---

## Decision 4 — Indexing is part of the schema change, not a later cleanup

Indexes ship **with** the migration that introduces the access pattern. Standing rules enforced on new schema:

| Rule | Why |
| --- | --- |
| Every foreign-key column gets an index | Many ORMs do **not** auto-create FK indexes; unindexed FKs cause scans on join and on cascade |
| Index every column used in `WHERE` and `ORDER BY` | Bound query cost; avoid full scans |
| Composite indexes for common multi-column filters (`[tenantId, status]`, `[ownerId, createdAt]`) | Match real query shape, leftmost-prefix aware |
| Include the soft-delete column in composites where queries filter by it | A live-rows query must stay index-covered |
| Partial index `WHERE <soft_delete_col> IS NULL` for hot live-row lookups | Smaller, faster index on the common case |

No feature ships a list/lookup path that produces a full table scan. Use the ORM's index declaration on the entity **or** a dedicated index migration; either is fine, both are reviewed. See [performance-review.md](../skills/performance-review.md).

> **Project records:** the composite/partial indexes that match this product's real query patterns and the migration that established the indexing precedent.

---

## Decision 5 — Pagination is mandatory and hard-bounded

**Decision.** Every list endpoint paginates. The **hard maximum page size is 100** items; a larger requested limit is clamped, not honored. There are no unbounded queries — a query that can return "all rows" is a defect.

- Cursor/keyset pagination is preferred for large or high-churn collections; offset pagination is acceptable for small, stable sets.
- Pagination shaping (limit clamping, sort whitelisting, default page size) lives in **shared utilities** consumed by the repository — defined once, not re-implemented per feature.
- Sort fields are validated against an allowlist of indexed columns; arbitrary client-supplied `ORDER BY` is rejected.

```ts
// DO — limit clamped to the documented cap before it reaches the DB
const take = Math.min(query.limit ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE); // MAX_PAGE_SIZE = 100
return this.repo.find({ where: { tenantId }, take, skip: query.offset });
```

```ts
// DON'T — caller controls the bound; one request can scan the table
return this.repo.find({ where: { tenantId }, take: query.limit }); // unbounded
```

See [09-performance-and-scalability.md](../rules/09-performance-and-scalability.md). `DEFAULT_PAGE_SIZE` / `MAX_PAGE_SIZE` are named constants per [06-types-enums-constants.md](../rules/06-types-enums-constants.md).

> **Project records:** the pagination utility location, default page size, cursor encoding, and the per-endpoint sort allowlists.

---

## Decision 6 — Tenant / ownership scoping is enforced in the data path, from verified identity

**Decision.** In a multi-tenant or owner-scoped system, **every** repository read and write that touches scoped data is filtered by `tenantId` (and/or `ownerId`) as a non-optional parameter. The scope value comes from the **verified token**, passed down by the application layer — **never** from the client body, query string, or a header the caller controls.

This is defense-in-depth, layered with the ownership guard ([07-security-authn-authz.md](../rules/07-security-authn-authz.md)): the guard rejects at the edge; the repository filter guarantees that even a bug upstream cannot return another tenant's row. Together they close IDOR and cross-tenant leakage.

```ts
// DO — scope is a required argument, applied in the WHERE clause
findInvoice(id: string, tenantId: string): Promise<InvoiceEntity | null> {
  return this.repo.findOne({ where: { id, tenantId } });
}
```

```ts
// DON'T — scope optional / trusted from input; a missing filter leaks across tenants
findInvoice(id: string): Promise<InvoiceEntity | null> {
  return this.repo.findOne({ where: { id } }); // any tenant's invoice
}
```

Tenant isolation is **testable behavior**: every scoped repository has a test proving a foreign-tenant id returns nothing. See [security-decisions.md](./security-decisions.md) and [testing-strategy.md](./testing-strategy.md).

> **Project records:** the scoping model (single-tenant / row-level tenant column / schema-per-tenant), the scope key name(s), and where the verified scope is extracted from the token.

---

## Decision 7 — Transaction ownership lives in the use case, not scattered

**Decision.** A unit of work that mutates **multiple entities under one invariant** is wrapped in a single transaction owned by a **use case** (`application/<action>.use-case.ts`). Services perform focused single-write capabilities; they do not open ad-hoc transactions that span other services' concerns. **Use cases call services; services never call use cases.**

**Conventions.**

- Keep transactions **short** — validate and prepare outside, commit the minimal mutation inside. Long transactions hold locks and starve the pool.
- **Never** wrap read-only queries in a transaction.
- The transaction handle (query runner / unit-of-work session) is **released in a `finally`** — no leaked connections on the error path.
- **Side effects fire after commit, not inside it.** Domain events, notifications, cache busts, and outbound calls happen post-commit so a delivery failure never rolls back committed business state. Fire-and-forget handlers catch their own errors ([10-reliability-and-durability.md](../rules/10-reliability-and-durability.md), [19-async-events-and-jobs.md](../rules/19-async-events-and-jobs.md), [event-notification-decisions.md](./event-notification-decisions.md)).
- For idempotent multi-row writes, prefer engine-native upsert / `ON CONFLICT DO NOTHING` (or the ORM's equivalent) over read-then-write races.

```ts
// DO — use case owns the boundary; events emitted only after commit
async execute(cmd: PlaceOrderCommand): Promise<OrderId> {
  const id = await this.unitOfWork.run(async (tx) => {
    const order = await this.orders.create(cmd, tx);
    await this.inventory.reserve(order.id, cmd.lines, tx);
    return order.id;
  });
  this.events.emit(new OrderPlacedEvent(id)); // post-commit, fail-safe
  return id;
}
```

> **Project records:** the transaction primitive used (query runner, `$transaction`, session), the unit-of-work wrapper if one exists, and the post-commit event dispatch mechanism.

---

## Decision 8 — Injection safety is absolute

Every value reaching the database is **bound as a parameter**. No string interpolation builds SQL/queries from input; no raw filter/sort/limit is concatenated. Dynamic clauses (sort column, filter field) are selected from a **server-side allowlist**, never echoed from the request. See [08-database-and-injection-safety.md](../rules/08-database-and-injection-safety.md) and [sql-injection-review.md](../skills/sql-injection-review.md).

```ts
// DO — bound parameter
this.repo.createQueryBuilder('o').where('o.status = :status', { status }).getMany();
```

```ts
// DON'T — interpolated input is an injection hole
this.repo.query(`SELECT * FROM orders WHERE status = '${status}'`);
```

---

## Decision 9 — Soft delete is a deliberate, indexed convention

When the product needs recoverable deletes or audit retention, soft-delete via a nullable timestamp column (the ORM's soft-delete feature where available), defined on a shared base entity so it is uniform. **Every** scoped query must account for the soft-delete column, and composites that filter live rows must include it (Decision 4). Hard delete is reserved for compliance erasure and runs through a documented, approved path.

> **Project records:** the soft-delete column name, the base entity, and which tables are soft-delete vs. hard-delete and why.

---

## Decision 10 — Performance hygiene the repository layer must hold

- **No N+1.** Resolve relations with eager joins / batched `IN` lookups / a dataloader at the boundary — not per-row queries in a loop.
- **Select only needed columns** on wide tables; avoid `SELECT *` projections for large rows.
- **Batch bulk writes** (one multi-row insert) instead of per-row insert loops.
- **Connection pool** sizing is configured and documented; pool exhaustion is a known failure mode to monitor ([observability-decisions.md](./observability-decisions.md), [reliability-patterns.md](./reliability-patterns.md)).
- Validation that a write **persisted** asserts on resulting DB state, not merely on request acceptance ([testing-strategy.md](./testing-strategy.md)).

> **Project records:** pool min/max and timeouts, slow-query thresholds, and any read-replica routing.

---

## Anti-patterns (never do these)

- Auto-synchronize / auto-DDL in any environment.
- Editing a shipped migration in place instead of forward-fixing.
- Importing the ORM client outside infrastructure/adapter directories.
- Business logic, transformation, or `if/else` policy inside a repository.
- An optional or client-supplied tenant/owner scope on a scoped query.
- Unbounded list queries or client-controlled page limits above the cap.
- Read-then-write where an idempotent upsert is race-safe.
- Inserting a placeholder/fake key to dodge a foreign-key constraint — fix the schema or the actor model instead.
- Side effects (events, notifications, outbound calls) inside the transaction.

---

## Related

[/context/architecture-map.md](../context/architecture-map.md) · [04-repositories-and-persistence.md](../rules/04-repositories-and-persistence.md) · [08-database-and-injection-safety.md](../rules/08-database-and-injection-safety.md) · [09-performance-and-scalability.md](../rules/09-performance-and-scalability.md) · [project-architecture.md](./project-architecture.md) · [security-decisions.md](./security-decisions.md) · [performance-decisions.md](./performance-decisions.md) · [reliability-patterns.md](./reliability-patterns.md) · [library-boundaries.md](./library-boundaries.md) · [known-pitfalls.md](./known-pitfalls.md) · [create-repository.md](../skills/create-repository.md) · [add-migration-backfill.md](../skills/add-migration-backfill.md) · [migration-plan.md](../skills/migration-plan.md)
