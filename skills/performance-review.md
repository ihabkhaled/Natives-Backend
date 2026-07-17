# Skill: Performance Review

> Audit a change set for the patterns that break at scale — N+1 fetches, missing indexes, unbounded queries, pagination gaps, await-in-loop, over-fetching, and hot-path CPU — and fix them. Implements the canon ([/context/architecture-map.md](../context/architecture-map.md), [/rules/00-non-negotiable-rules.md](../rules/00-non-negotiable-rules.md), [/rules/09-performance-and-scalability.md](../rules/09-performance-and-scalability.md)).

**Rules this skill enforces:** no unbounded query/pagination — hard cap **100** (rule 37); index every FK / `WHERE` / `ORDER BY`; no N+1; whitelist sort & filter (also a security gate); `Promise.all|allSettled|any|race` in use cases/`lib/`, never services (rule 21, ESLint-enforced); project only needed columns; cache read-heavy data with correct invalidation; keep CPU off the request path; services stateless.

Use this for repositories, list/search endpoints, filters, sorts, migrations, and any hot query. Treat an unbounded read or a missing index on a large table as a **BLOCKER**, not a nit.

---

## 1. Scope the review

Diff only the layers that touch data and the request path; then grep for the tell-tale shapes.

```bash
git diff origin/main...HEAD -- \
  'src/modules/**/infrastructure/**' \
  'src/modules/**/application/**' \
  'src/**/migrations/**'
```

Grep patterns (use the Grep tool):

| Pattern                                   | What you are hunting                            |
| ----------------------------------------- | ----------------------------------------------- |
| `\.find\(` / `\.findMany\(`               | reads missing `where` / `take` / pagination     |
| `findAndCount\|skip\|take\|cursor`        | confirm list endpoints actually bound results   |
| `for \(.*of` near `await`                 | await-in-loop → likely N+1                      |
| `relations:\|leftJoinAndSelect\|include:` | eager joins (needed vs over-fetch)              |
| `Promise\.(all\|allSettled\|any\|race)`   | concurrency in the wrong layer                  |
| `ORDER BY\|order:\|sort`                  | sort columns that must be whitelisted + indexed |

---

## 2. Tests FIRST

Before changing anything, lock the regression with failing tests (see [write-integration-tests.md](./write-integration-tests.md)):

```ts
// integration — a list endpoint must NOT return more than the hard cap
it('caps results at MAX_PAGE_SIZE and returns a total', async () => {
  await seedRows(150); // example: more than the cap
  const res = await request(app.getHttpServer())
    .get('/orders?limit=500')
    .expect(200);
  expect(res.body.items).toHaveLength(MAX_PAGE_SIZE); // 100
  expect(res.body.total).toBe(150);
});
```

```ts
// unit — the shared pagination helper clamps the limit
it('clamps limit above the cap to MAX_PAGE_SIZE', () => {
  expect(parsePagination({ page: 1, limit: 9_999 }).limit).toBe(MAX_PAGE_SIZE);
});
```

For an N+1 fix, add a query-count assertion (spy/count the repository call) proving one round-trip, not N.

---

## 3. Pagination — every list endpoint is bounded

The cap (`MAX_PAGE_SIZE = 100`) lives in `@shared/constants`, is validated in the DTO, and is re-clamped in a shared helper so neither the controller nor the service trusts raw query strings.

```ts
// DTO (api/dto) — class-validator primary
@IsInt() @Min(1) @Max(MAX_PAGE_SIZE) @IsOptional() readonly limit?: number;
// Zod alternative: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE)
```

```ts
// DO — bounded read with a total, inside the repository
async listByAccount(accountId: string, p: Pagination): Promise<Page<Order>> {
  const [items, total] = await this.repo.findAndCount({
    where: { accountId },
    order: { createdAt: 'DESC' },
    skip: p.offset,
    take: p.limit, // bounded — never the whole table
  });
  return { items, total, page: p.page, limit: p.limit };
}

// DON'T — unbounded full-table read (BLOCKER, rule 37)
const all = await this.repo.find();                    // no where, no take
const all = await this.repo.find({ where: { accountId } }); // no take → everything
```

- Return a paged envelope (`{ items, total, page, limit }`) — or a cursor — so clients iterate instead of fetching blindly.
- For deep paging on hot tables, prefer **keyset/cursor** (`WHERE createdAt < :cursor ... LIMIT :n`) over large `OFFSET`; `OFFSET 100000` still scans 100k rows.
- The cap stays behind the repository — ORM-agnostic (TypeORM / Prisma / Mongoose / Sequelize are interchangeable examples).

---

## 4. Indexes — every FK / WHERE / ORDER BY column is indexed

Most ORMs do **not** auto-create FK indexes. Declare them, and back each declaration with a migration (`synchronize` is off — see [add-migration-backfill.md](./add-migration-backfill.md)).

```ts
// infrastructure/order.entity.ts — illustrative; mirror the equivalent in your ORM
@Index(['accountId'])                                   // FK → indexed
@Index(['status'])                                      // WHERE filter
@Index(['createdAt'])                                   // ORDER BY
@Index(['accountId', 'status'])                         // composite: equality column first
@Index(['deletedAt'], { where: 'deleted_at IS NULL' })  // soft-delete-aware partial index
```

Cross-check each new/changed query against the schema:

- [ ] Every column in a new `WHERE` has a supporting index.
- [ ] Every FK column the diff queries on is indexed.
- [ ] Every `ORDER BY` column is indexed.
- [ ] Composite indexes follow the **leading-column** rule: `[accountId, status]` serves `WHERE accountId=?` and `WHERE accountId=? AND status=?`, not `WHERE status=?` alone.
- [ ] Soft-delete reads (`deletedAt IS NULL`) use a partial index on large tables.
- [ ] The index ships in a numbered migration with a `down()` that drops it.

> Verify with the database's plan tool (e.g. `EXPLAIN (ANALYZE, BUFFERS) <query>`) against a representative dataset — expect an **index scan**, not a sequential scan, on large tables. Paste the plan into the PR notes for risky queries.

---

## 5. N+1 and await-in-loop — batch or join

```ts
// DON'T — N+1: one query per id (and trips no-await-in-loop)
const orders: Order[] = [];
for (const id of ids) {
  orders.push(await this.orderRepo.findOne({ where: { id } })); // ❌ N round-trips
}

// DO — one batched query
const orders = await this.orderRepo.find({ where: { id: In(ids) } });
```

```ts
// DON'T — lazy per-row relation fetch in a loop
for (const order of orders) {
  order.lines = await this.lineRepo.find({ where: { orderId: order.id } }); // ❌
}

// DO (A) — join once, paginate the parent so `take` counts parents, not joined rows
await this.orderRepo.find({ where, relations: { lines: true }, skip, take });

// DO (B) — batch children with one IN query, then group in memory
const lines = await this.lineRepo.find({ where: { orderId: In(orderIds) } });
```

- No query inside a loop over a collection — batch with `In(...)` or load via `relations`/join.
- `no-await-in-loop` flags serial awaits over independent data; that is usually a hidden N+1 — batch it.
- Don't over-correct into eager-join over-fetch: join only what the response needs; beware join + pagination row multiplication (paginate the parent via distinct ids / subquery).

---

## 6. Concurrency lives in use cases / helpers, never services

Independent async work runs in parallel — but **batch beats parallel** (one `IN` round-trip beats N concurrent ones), and the orchestration is structural, so ESLint bans `Promise.all|allSettled|any|race` inside `*.service.ts`.

```ts
// DON'T — concurrency inside a service (architecture/no-restricted-syntax + 20-line cap)
async enrich(ids: string[]): Promise<Profile[]> {
  return Promise.all(ids.map(id => this.profileService.getById(id))); // ❌ wrong layer
}

// DO — one batched query (prefer this)
const profiles = await this.profileRepo.findByIds(ids); // ✅

// DO — genuinely independent calls parallelized in a USE CASE / lib helper, fan-out bounded
const [account, catalog] = await Promise.all([
  this.accountService.getById(input.accountId),
  this.catalogService.getActive(),
]);
```

Bound the fan-out (chunk large inputs so a `Promise.all` can't exhaust the connection pool or a downstream rate limit); when using `allSettled`, handle every rejection — no silently dropped errors.

---

## 7. Project only the columns you need; whitelist sort & filter

```ts
// DO — narrow the query to the response shape on wide tables
await this.repo.find({
  where,
  select: { id: true, status: true, createdAt: true },
  skip,
  take,
});
```

- Sort against an explicit `ALLOWED_SORT_FIELDS` constant — **every allowed sort field must be indexed**; reject unknown keys with a typed error (`errors.<feature>.invalid_sort`), never a raw user column (also an injection vector — see [sql-injection-review.md](./sql-injection-review.md)).
- Filters are explicit per-column branches on indexed columns — no "filter by any column" loop.
- Run aggregates (`COUNT`, `SUM`, `MAX`) in the database; never load rows and reduce in Node.
- Map to a response DTO; never spread a raw entity that may carry secrets or internal flags to the client.
- Large exports/reports must **stream** (cursor / chunked), not buffer the whole result set.

---

## 8. Cache read-heavy, rarely-changed data — through the adapter

Cache via the cache adapter ([add-library-adapter.md](./add-library-adapter.md)); business code calls `cache.get/set`, never the vendor SDK.

- [ ] Cache reference/lookup data, roles/permissions, feature config — not fast-changing or per-user data without a tight, scoped key + TTL.
- [ ] Key prefix and TTL come from `*.constants.ts`, never inline.
- [ ] **Invalidation is mandatory and correct** — every write to the cached source busts the cache in the same path. A stale authorization cache grants revoked permissions: that is a security bug.
- [ ] Degrade gracefully — a cache miss/outage falls through to the source of truth, never 500s (see [reliability-review.md](./reliability-review.md)).

---

## 9. Keep CPU/IO-heavy work off the request path

- Hashing, document/image processing, large parsing, compression, heavy crypto → off the hot path or async and bounded; never block the event loop with a synchronous loop over a large array.
- Slow side effects (email/SMS dispatch, fan-out notifications, content scanning, report generation) run **after commit** via the event bus; handlers catch their own errors so a side-effect failure never blocks the transition (rule 38).
- Keep transactions short: read/validate before opening, mutate inside, emit events after commit.

---

## 10. Document the impact

In the PR description, state: indexes added/used, pagination + max limit, expected row counts, caching + invalidation, any background offload, and any new shared-state dependency. Record durable choices in [/memory/performance-decisions.md](../memory/performance-decisions.md) and update tests + docs in the same change (rule 42).

---

## Quality gates

```bash
npm run lint            # 0 errors AND 0 warnings (architecture + no-await-in-loop + no Promise.all in services)
npm run typecheck       # tsc --noEmit (TypeScript 7)
npm run test            # vitest
npm run test:coverage   # ≥ 95% on touched modules
npm run build           # compiles clean
```

## Pitfalls

- **`find()` with no `take`.** The single most common scale bug — returns the whole table; reviewers skim past it. Always bound.
- **Composite index in the wrong column order.** `[status, accountId]` will not serve `WHERE accountId=?`; lead with the equality/selective column.
- **Eager `relations` everywhere "to be safe".** Over-fetch and join fan-out blow up payloads and row counts; join only what the response needs.
- **`Promise.all` to "fix" an await-in-loop inside a service.** ESLint blocks it and a single batched `IN` query is usually faster anyway — fix the query, or move concurrency to a use case.
- **Large `OFFSET` pagination on hot tables.** Still scans every skipped row; switch to keyset/cursor.
- **Caching without invalidation** — silent stale reads, and a stale auth cache is a security hole.
- **Sorting/filtering by a raw client-supplied column.** Full table scan and an injection vector at once — whitelist it.
- **Fixing the symptom in code, not the schema.** A missing index is fixed with a migration, not by paginating harder.

## Related

[/rules/09-performance-and-scalability.md](../rules/09-performance-and-scalability.md) · [/rules/08-database-and-injection-safety.md](../rules/08-database-and-injection-safety.md) · [/rules/04-repositories-and-persistence.md](../rules/04-repositories-and-persistence.md) · [sql-injection-review.md](./sql-injection-review.md) · [reliability-review.md](./reliability-review.md) · [add-migration-backfill.md](./add-migration-backfill.md) · [migration-plan.md](./migration-plan.md) · [write-integration-tests.md](./write-integration-tests.md) · [/agents/backend-performance-reviewer.md](../agents/backend-performance-reviewer.md) · [/agents/database-reviewer.md](../agents/database-reviewer.md) · [/memory/performance-decisions.md](../memory/performance-decisions.md)
