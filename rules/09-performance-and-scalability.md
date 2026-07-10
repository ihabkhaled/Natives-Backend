# 09 — Performance & Scalability

> Implements the canon ([/context/architecture-map.md](../context/architecture-map.md), [00-non-negotiable-rules.md](./00-non-negotiable-rules.md)): make every query bounded and indexed, every endpoint non-blocking, and every service stateless so the app scales horizontally without rewrites. Performance is a design constraint, not a later optimization.

**Rules enforced here:** no unbounded queries/pagination — hard cap 100 (rule 37); index every FK / `WHERE` / `ORDER BY`; no N+1; whitelist sort & filter (also a security gate, see [08-database-and-injection-safety.md](./08-database-and-injection-safety.md)); concurrency lives in use cases/helpers, never services (rule 21, ESLint-enforced).

---

## 0. Non-negotiables

1. **Every list endpoint is paginated** with a hard max page size of **100**.
2. **Every FK, every `WHERE` column, every `ORDER BY` column is indexed** (composite for common multi-column patterns).
3. **No N+1** — load relations explicitly or batch with a single `IN` query.
4. **No unbounded reads into memory** — count + page, or stream.
5. **No synchronous CPU-heavy work on the request path** — offload to a background job.
6. **`Promise.all`/`allSettled` belong in use cases or `lib/` helpers, never in services** (ESLint bans them in `*.service.ts`).
7. **Services are stateless** — no request state on instance fields; horizontal scale must be a config change, not a refactor.

---

## 1. Mandatory pagination + max page size {#pagination}

Pagination is validated in the DTO and clamped in a shared helper, so neither the controller nor the service trusts raw query strings. The hard ceiling of 100 lives in `@shared/constants`, never inline.

```ts
// shared/utils/pagination.util.ts — page ≥ 1, limit ∈ [1, MAX_PAGE_SIZE], offset computed
export function parsePagination(query: PaginationQuery): Pagination {
  const page = Math.max(1, query.page ?? DEFAULT_PAGE);
  const limit = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, query.limit ?? DEFAULT_LIMIT),
  );
  return { page, limit, offset: (page - 1) * limit };
}
```

```ts
// DO — bounded read with a total, inside a repository (Order shown as an example)
async listByAccount(accountId: string, p: Pagination): Promise<Page<Order>> {
  const [items, total] = await this.repo.findAndCount({
    where: { accountId },
    order: { createdAt: 'DESC' },
    skip: p.offset,
    take: p.limit, // bounded — never the whole table
  });
  return { items, total, page: p.page, limit: p.limit };
}

// DON'T — unbounded fetch (rule 37): loads the whole table, OOM at scale, no total
const all = await this.repo.find({ where: { accountId } }); // ❌
```

- Always return a paged envelope (`{ items, total, page, limit }`) so the client can iterate.
- Validate `page`/`limit` in the DTO (class-validator: `@IsInt() @Min(1) @Max(100)`; Zod alt: `z.coerce.number().int().min(1).max(100)`) — see [05-dto-and-validation.md](./05-dto-and-validation.md).
- For deep paging on hot tables, prefer **keyset/cursor** pagination (`WHERE created_at < :cursor ORDER BY created_at DESC LIMIT :n`) over large `OFFSET` — `OFFSET 100000` still scans 100k rows.
- These limits stay ORM-agnostic — TypeORM / Prisma / Mongoose / Sequelize are interchangeable; the cap lives behind the repository ([04-repositories-and-persistence.md](./04-repositories-and-persistence.md)).

## 2. Whitelist sort & filter {#whitelist}

An un-indexed sort or filter column is a full table scan — and accepting an arbitrary column name is also an injection vector ([08-database-and-injection-safety.md](./08-database-and-injection-safety.md)).

- Sort against an explicit `ALLOWED_SORT_FIELDS` constant; **every allowed sort field must be indexed.**
- Filters are explicit per-column branches, each on an indexed column. No "filter by any column" loops.
- Reject unknown sort/filter keys with a typed `AppError` (`errors.<feature>.invalid_sort`) instead of silently ignoring them.

## 3. Indexes {#indexes}

Most ORMs do **not** auto-create FK indexes — declare them, and back the declaration with a migration (`synchronize` is off; see [add-migration-backfill.md](../skills/add-migration-backfill.md)).

```ts
// infrastructure/order.entity.ts — illustrative; mirror the equivalent in your ORM
@Index(['accountId'])                                   // FK → indexed
@Index(['status'])                                      // WHERE filter
@Index(['createdAt'])                                   // ORDER BY
@Index(['accountId', 'status'])                         // common composite (equality first)
@Index(['deletedAt'], { where: 'deleted_at IS NULL' })  // soft-delete-aware partial index
```

Index checklist for every new entity/column:

- [ ] **Every FK column** has an index.
- [ ] **Every column used in a `WHERE`** has an index.
- [ ] **Every `ORDER BY` column** has an index.
- [ ] **Composite indexes** for common multi-column patterns — equality columns first, range/sort last.
- [ ] **Soft-delete (`deletedAt`)** folded into composites or expressed as a partial index.
- [ ] **Unique / partial indexes** where the data model allows (e.g. one active row per parent) — these also enforce idempotency (§13).
- [ ] The `@Index` is backed by a **migration**.
- [ ] Verify with `EXPLAIN ANALYZE` that hot queries hit an index — **no sequential scan on large tables.**

## 4. No N+1 queries {#n-plus-1}

```ts
// DON'T — N+1: one query for orders, then one per order for its lines
const orders = await this.orderRepo.find({ where: { accountId } });
for (const order of orders) {
  order.lines = await this.lineRepo.find({ where: { orderId: order.id } }); // ❌ N round-trips
}

// DO (A) — single join, paginate the parent
const orders = await this.orderRepo.query.withLines(accountId, pagination);

// DO (B) — eager relation on the read
await this.orderRepo.find({
  where: { accountId },
  relations: { lines: true },
  skip: pagination.offset,
  take: pagination.limit,
});

// DO (C) — batch children with one IN query, then group in memory
const lines = await this.lineRepo.find({ where: { orderId: In(orderIds) } });
```

- Use eager relations / joins for parent → child; switch to a **batched `IN`** when join fan-out would multiply rows.
- Beware join + pagination row multiplication: paginate the parent (distinct ids / subquery), then join — so `take` counts parents, not joined rows.
- `no-await-in-loop` is on (warn): an `await` inside a loop over independent data is usually a hidden N+1 — batch it (§5) instead of looping.

## 5. Safe concurrency — batch independent work {#concurrency}

Independent async work runs in parallel; **never serialize it in a loop**. But concurrency orchestration is structural, so it lives where the architecture allows it: a **use case** or a `lib/` helper, **not a service** (ESLint bans `Promise.all|allSettled|any|race` in `*.service.ts`).

```ts
// DON'T — await-in-loop over independent fetches (serial latency = N × round-trip)
const profiles: Profile[] = [];
for (const id of accountIds) {
  profiles.push(await this.profileService.getById(id)); // ❌ N sequential awaits
}

// DON'T — concurrency inside a service (architecture/no-restricted-syntax)
async enrich(ids: string[]): Promise<Profile[]> {
  return Promise.all(ids.map(id => this.profileService.getById(id))); // ❌ not in a service
}

// DO — prefer a single batched query (one round-trip beats N parallel ones)
const profiles = await this.profileRepo.findByIds(accountIds); // ✅

// DO — when calls are genuinely independent, parallelize in a USE CASE / helper
@Injectable()
export class PublishOrderUseCase {
  async execute(input: PublishOrderInput): Promise<PublishOrderResult> {
    const [account, catalog] = await Promise.all([
      this.accountService.getById(input.accountId),
      this.catalogService.getActive(),
    ]);
    return this.compose(account, catalog);
  }
}
```

- **Batch beats parallel:** one `IN`/`findByIds` round-trip is cheaper than N concurrent ones — reach for the query first, `Promise.all` second.
- **Bound the fan-out.** A `Promise.all` over an unbounded array can exhaust the DB pool or a downstream rate limit — chunk large inputs and process chunk-by-chunk.
- Use `allSettled` when one failure must not abort the rest, and **handle every settled rejection** — no silently dropped errors ([18-error-handling-and-exceptions.md](./18-error-handling-and-exceptions.md)).

## 6. Project only the columns you need {#projection}

- For wide tables, `select` only the needed columns (`select: { id: true, status: true, createdAt: true }`).
- Don't eager-join heavy relations you won't return.
- Use raw aggregate reads for pure aggregates (`MAX`, `COUNT`, `SUM`), not fully hydrated entities you immediately discard.
- Response DTOs/mappers ([06-types-enums-constants.md](./06-types-enums-constants.md)) define the wire shape — narrow the query to match it; don't fetch the entity and strip fields in Node.

## 7. Cache read-heavy, rarely-changed data {#cache}

Cache through a **cache adapter** ([12-library-wrapping-and-adapters.md](./12-library-wrapping-and-adapters.md)) — the cache client (Redis, Memcached, in-memory) stays behind your interface; business code calls `cache.get/set`, never the SDK.

- **Cache:** roles/permissions, reference/lookup data, feature config, lists that change rarely and read constantly.
- **Invalidation is mandatory and correct.** On any change to the cached source — role/permission/profile update — call an explicit invalidation path. A stale authorization cache is a **security** bug (it grants revoked permissions); pair every cache write with its invalidation. See [07-security-authn-authz.md](./07-security-authn-authz.md).
- **Key + TTL from constants.** Stable prefixed keys (`account:<id>`) and TTLs live in `*.constants.ts`, never inline (rule 8).
- **Degrade gracefully.** Treat the cache as optional: on a cache miss or outage, fall through to the source of truth — never fail the request because the cache is down.
- Don't cache per-user, fast-changing, or sensitive data without a tight TTL and a clear invalidation trigger.

## 8. Don't materialize large datasets in memory {#no-buffer}

- No read without a `take`. No "fetch all, then filter/sort/paginate in JS" — push filtering, sorting, and the limit into the database.
- Aggregations (counts, sums, maxes) run in the database, not by loading rows and reducing in Node.
- Exports and reports over large data must **stream** (cursor / chunked queries), not buffer the whole result set.

## 9. Keep CPU-heavy work off the request path {#offload}

- Hashing, document/PDF generation, image processing, large parsing/serialization, compression, and heavy crypto stay off the hot path or run async and bounded.
- Never block the event loop with a synchronous loop over a large array — chunk and yield, or move it to a job.
- Slow side effects (email/SMS dispatch, fan-out notifications, content scanning, report generation) run **after commit** via the event bus and integration adapters ([19-async-events-and-jobs.md](./19-async-events-and-jobs.md)). Handlers **catch their own errors** so a side-effect failure never blocks the domain transition (rule 38):

```ts
@OnEvent(OrderEvent.Published)
async onPublished(event: OrderPublishedEvent): Promise<void> {
  try {
    await this.notificationService.notifyAccountOfPublish(event.orderId);
  } catch (error) {
    this.logger.error(LOG_PREFIX, { orderId: event.orderId, error }); // never rethrow
  }
}
```

## 10. Stream large request and response bodies {#streaming}

- **Body limits.** Configure a JSON/body size limit at bootstrap (from typed config); large binaries bypass the body parser via a streaming upload handler.
- **Uploads** stream to disk or object storage through the storage adapter — never buffered whole in memory.
- **Downloads/exports** of large objects stream from storage to the response (NestJS `StreamableFile`); don't read the object into a `Buffer` first.

## 11. Rate-limit expensive endpoints {#rate-limit}

- Global throttling fronts every route; search, analytics, export, and other costly endpoints get a **tighter, dedicated limiter** on top.
- Tune limits from config, not inline. See [07-security-authn-authz.md](./07-security-authn-authz.md) for the brute-force / abuse angle.

## 12. Connection pool & short transactions {#pool}

- Size the database pool intentionally from typed config (`min`/`max`, idle timeout, connection timeout) for expected concurrency and the database's connection ceiling — account for replicas and an external pooler.
- Keep transactions **short**: do reads/validation before opening the transaction, mutate inside, emit events after commit (the use-case shape — [03-application-services-and-use-cases.md](./03-application-services-and-use-cases.md)). Long transactions hold connections and serialize writers.
- A scaled fleet multiplies pools — front the database with an external connection pooler before scaling instances horizontally.

## 13. Idempotent, retryable writes {#idempotency}

- Background-processed and client-retried writes must be **idempotent** — guard with a unique key / unique index so a retry can't create duplicates.
- Conflicting unique writes surface as a constraint violation → map to a `409` via a typed `AppError` (`errors.<feature>.conflict`), never an unhandled crash.
- Prefer conditional updates (`update({ id, status: PENDING }, …)`) over read-modify-write races. See [10-reliability-and-durability.md](./10-reliability-and-durability.md).

## 14. Statelessness for horizontal scale {#stateless}

The architecture is horizontally scalable only if instances are interchangeable. Any instance must be able to serve any request.

- **No request/session state on instance memory.** Sessions, locks, counters, and rate-limit budgets live in a shared store behind an adapter — not on a provider field or a module-level variable.
- **Streaming/long-lived connections (SSE/WebSocket) need a fan-out plan:** sticky sessions or a shared pub/sub channel so an event produced on instance B reaches a client connected to instance A. Document the choice in [reliability-patterns.md](../memory/reliability-patterns.md).
- **In-memory caches are per-instance and best-effort** — they must rebuild on any instance and never be the source of truth.
- **Graceful shutdown:** drain in-flight requests, stop consuming jobs, close pools on `SIGTERM` so rolling deploys and autoscaling don't drop work.
- **Externalize all shared state** (cache, queue, locks, files) so adding an instance is a config/replica change, never a code change.

## 15. Document the performance impact of a change {#document}

Every PR that adds a query or endpoint states, in the description: indexes added/used, pagination + max limit, expected row counts, caching + invalidation, any background offload, and any new shared-state dependency. Record durable decisions in [performance-decisions.md](../memory/performance-decisions.md); update tests and docs in the same change (rule 42).

---

## Review checklist

- [ ] List endpoints paginated; `limit` clamped to ≤ 100 in the DTO and the shared helper.
- [ ] Sort/filter columns whitelisted **and** indexed; unknown keys rejected with a `messageKey`.
- [ ] New FK / `WHERE` / `ORDER BY` columns have an index + migration; verified with `EXPLAIN ANALYZE` (no seq scan on big tables).
- [ ] No N+1 (eager relations / join / batched `IN`); no `await`-in-loop over independent work.
- [ ] Concurrency (`Promise.all`/`allSettled`) lives in a use case or helper, never a service; fan-out is bounded; rejections handled.
- [ ] Queries project only needed columns; aggregates run in the database.
- [ ] No unbounded reads materialized in memory; large results stream.
- [ ] Read-heavy data cached behind the cache adapter with correct, explicit invalidation; cache outage degrades gracefully.
- [ ] CPU/IO-heavy work offloaded to background; event handlers catch their own errors.
- [ ] Body limits set; large uploads/downloads streamed.
- [ ] Retryable writes are idempotent (unique key/index); conflicts map to a typed error.
- [ ] Services are stateless; shared state externalized; graceful shutdown handled.

## Quality gates

```bash
npm run lint            # 0 errors AND 0 warnings (architecture + no-await-in-loop + no Promise.all in services)
npm run typecheck       # tsc --noEmit (TypeScript 7)
npm run test            # vitest
npm run test:coverage   # ≥ 95% on touched modules
npm run build           # compiles clean
```

**Related:** [08-database-and-injection-safety.md](./08-database-and-injection-safety.md) · [04-repositories-and-persistence.md](./04-repositories-and-persistence.md) · [10-reliability-and-durability.md](./10-reliability-and-durability.md) · [19-async-events-and-jobs.md](./19-async-events-and-jobs.md) · [12-library-wrapping-and-adapters.md](./12-library-wrapping-and-adapters.md) · [skills/performance-review.md](../skills/performance-review.md) · [memory/performance-decisions.md](../memory/performance-decisions.md)
