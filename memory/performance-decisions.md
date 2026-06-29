# Performance Decisions

> Durable performance conventions for any NestJS backend in this workspace, with rationale. It implements the canon ([/context/architecture-map.md](../context/architecture-map.md), [/rules/00-non-negotiable-rules.md](../rules/00-non-negotiable-rules.md)) and pins the standing decisions behind [/rules/09-performance-and-scalability.md](../rules/09-performance-and-scalability.md). Treat these as defaults: deviate only with a recorded "Project records:" entry and a reason.

These decisions are **stack- and domain-agnostic**. The layering is the constant; the ORM (TypeORM / Prisma / Mongoose / Sequelize), the cache, and the business domain are the variable — keep all three behind a repository or an adapter so a swap never touches business code ([/rules/12-library-wrapping-and-adapters.md](../rules/12-library-wrapping-and-adapters.md)).

---

## D1 — Pagination is mandatory and bounded (hard cap 100)

**Decision.** Every list/collection read is paginated. The page size is clamped to a hard maximum of **100** in two places: the DTO (`@Max(100)`) and a shared `parsePagination` helper. No layer trusts a raw query string. The ceiling lives in `@shared/constants`, never inline.

**Rationale.** An unbounded `find()` is an out-of-memory incident and a denial-of-service vector waiting on the largest tenant. Clamping twice means a bypassed DTO (internal caller) still can't fetch the whole table. List endpoints always return a paged envelope `{ items, total, page, limit }` so clients can iterate deterministically.

**Default.** Offset paging for shallow pages; **keyset/cursor** paging for hot tables or deep pages — `OFFSET 100000` still scans 100k rows. Cursor on an indexed, monotonic column.

```ts
// DON'T — unbounded read; OOM at scale, no total
const all = await this.repo.find({ where: { accountId } }); // ❌

// DO — bounded inside the repository (Order shown illustratively)
const [items, total] = await this.repo.findAndCount({
  where: { accountId },
  order: { createdAt: 'DESC' },
  skip: page.offset,
  take: page.limit, // clamped ≤ MAX_PAGE_SIZE
});
```

**Project records:** the concrete `MAX_PAGE_SIZE` / `DEFAULT_LIMIT`, any endpoint granted a documented exception, and which tables use cursor vs. offset.

---

## D2 — Index every FK, `WHERE`, and `ORDER BY` column

**Decision.** Each foreign key, filter column, and sort column is indexed; common multi-column access patterns get a composite (equality columns first, range/sort last). Soft-delete predicates fold into composites or a partial index. Every `@Index` is backed by a migration — schema auto-sync stays off ([/skills/add-migration-backfill.md](../skills/add-migration-backfill.md)).

**Rationale.** Most ORMs do **not** auto-create FK indexes, so the default is a silent sequential scan that only hurts once the table is large in production. Verify hot queries with `EXPLAIN ANALYZE` — no seq scan on big tables.

```ts
@Index(['accountId'])                                   // FK
@Index(['status'])                                      // WHERE
@Index(['createdAt'])                                   // ORDER BY
@Index(['accountId', 'status'])                         // composite, equality first
@Index(['deletedAt'], { where: 'deleted_at IS NULL' })  // soft-delete-aware partial
```

**Project records:** the chosen database, its partial-index support, and the composite/partial indexes added per table.

---

## D3 — No N+1; batch over loop

**Decision.** Parent → child reads use an explicit join / eager relation, or a single batched `IN` query — never an `await` inside a loop over independent rows. Paginate the **parent** (distinct ids / subquery) before joining so `take` counts parents, not multiplied join rows.

**Rationale.** An N+1 turns one page view into N+1 round-trips; latency grows with data and is invisible in small-dataset tests. `no-await-in-loop` is on (warn) precisely because a loop-await is usually a hidden N+1.

```ts
// DON'T — N+1
for (const order of orders) {
  order.lines = await this.lineRepo.find({ where: { orderId: order.id } }); // ❌
}

// DO — one IN query, group in memory
const lines = await this.lineRepo.find({ where: { orderId: In(orderIds) } }); // ✅
```

**Project records:** known fan-out hotspots and the strategy chosen for each (join vs. batched `IN`).

---

## D4 — Project narrow; aggregate in the database

**Decision.** Select only the columns the response DTO needs; don't eager-join heavy relations you won't return; don't load wide `JSON`/`text`/blob columns in list views when a detail endpoint can fetch them. Counts, sums, and maxes run as database aggregates, not by hydrating rows and reducing in Node.

**Rationale.** Wide rows and full hydration waste I/O, memory, and serialization on data that's immediately discarded. The mapper ([/rules/06-types-enums-constants.md](../rules/06-types-enums-constants.md)) defines the wire shape — narrow the query to match it; don't fetch the entity and strip fields in application code.

**Project records:** which entities have a heavy column split between list and detail reads.

---

## D5 — Cache read-heavy, rarely-changed data behind an adapter (optional, graceful)

**Decision.** Caching goes through a **cache adapter** — the cache client (in-memory, distributed key-value store, or none) stays behind a typed interface; business code calls `cache.get/set`, never the SDK. Cache the read-heavy and slow-changing: roles/permissions, reference/lookup data, feature config, lists that change rarely and read constantly. Keys and TTLs come from `*.constants.ts`, never inline.

**Rationale.** The cache is an **optimization, never a source of truth**. A cache miss or a cache outage must recompute from the database and serve the request — never return a 5xx because the cache is down. Per-instance in-memory caches are best-effort and must rebuild on any instance ([/memory/reliability-patterns.md](./reliability-patterns.md)).

**Invalidation is a correctness and security gate.** Pair every cache write with an explicit invalidation path. A stale **authorization** cache grants revoked permissions — that is a security bug, not a performance nicety ([/rules/07-security-authn-authz.md](../rules/07-security-authn-authz.md)). Don't cache per-user, fast-changing, or sensitive data without a tight TTL and a clear invalidation trigger.

**Project records:** whether a cache exists, which provider backs the adapter, the cached key prefixes, their TTLs, and each invalidation trigger.

---

## D6 — Concurrency boundary: orchestrate parallelism in use cases/helpers, never services

**Decision.** Independent async work runs in parallel — but the orchestration primitive is structural and lives **only** in a use case or a `lib/` helper. `Promise.all | allSettled | any | race` is **ESLint-banned inside `*.service.ts`** (services also cap at 20 lines/method). Reach for a **single batched query first**, then `Promise.all` for genuinely independent collaborators.

**Rationale.** Keeping concurrency out of services keeps services thin, stateless, and testable, and concentrates fan-out reasoning where the transaction and event boundary already live ([/rules/03-application-services-and-use-cases.md](../rules/03-application-services-and-use-cases.md)). One `IN`/`findByIds` round-trip beats N concurrent ones; parallelism is the fallback, not the reflex.

```ts
// DON'T — concurrency inside a service (architecture/no-restricted-syntax)
async enrich(ids: string[]): Promise<Profile[]> {
  return Promise.all(ids.map((id) => this.profileService.getById(id))); // ❌
}

// DO — parallelize independent collaborators in a USE CASE
const [account, catalog] = await Promise.all([
  this.accountService.getById(input.accountId),
  this.catalogService.getActive(),
]);
```

**Bound the fan-out.** An unbounded `Promise.all` can exhaust the connection pool or trip a downstream rate limit — chunk large inputs and process chunk-by-chunk. Use `allSettled` when one failure must not abort the rest, and **handle every settled rejection** — no silently dropped errors ([/rules/18-error-handling-and-exceptions.md](../rules/18-error-handling-and-exceptions.md)).

**Project records:** the chunk size for bounded fan-out and the downstream rate limits that constrain it.

---

## D7 — Keep CPU/IO-heavy work and slow side effects off the request path

**Decision.** Hashing, document/PDF generation, image processing, large parse/serialize, compression, and heavy crypto stay off the hot path or run async and bounded. Slow side effects — email/SMS dispatch, fan-out notifications, content scanning, report generation — run **after commit** via the event bus and integration adapters ([/rules/19-async-events-and-jobs.md](../rules/19-async-events-and-jobs.md)).

**Rationale.** Synchronous heavy work blocks the event loop and inflates p99 for every other request on the instance. Post-commit handlers **catch their own errors** so a side-effect failure never blocks or reverses the domain transition.

```ts
@OnEvent(OrderEvent.PUBLISHED)
async onPublished(event: OrderPublishedEvent): Promise<void> {
  try {
    await this.notificationService.notifyAccountOfPublish(event.orderId);
  } catch (error) {
    this.logger.error(LOG_PREFIX, { orderId: event.orderId, error }); // never rethrow
  }
}
```

**Project records:** which operations are offloaded, to what mechanism (in-process events vs. external queue), and their retry/dead-letter policy.

---

## D8 — Stream large bodies; never materialize big datasets in memory

**Decision.** No read without a `take`; no "fetch all, then filter/sort/paginate in JS". Configure a JSON/body size limit at bootstrap from typed config. Large uploads stream to disk/object storage through the storage adapter; large exports/downloads stream from storage to the response (`StreamableFile`) — never buffered whole.

**Rationale.** Buffering an unbounded result set or upload is a per-request memory cliff that scales linearly with the biggest input and takes the instance down under load. Push filtering, sorting, and the limit into the database; stream the rest.

**Project records:** the configured body limit and which export/upload endpoints stream.

---

## D9 — Idempotent retryable writes; short transactions; stateless instances

**Decision.** Background-processed and client-retried writes are **idempotent** — guarded by a unique key/index so a retry can't duplicate; unique-constraint conflicts map to a typed `AppError` (`errors.<feature>.conflict`, HTTP 409), never an unhandled crash. Transactions stay **short** (read/validate before opening, mutate inside, emit events after commit). Instances are **stateless** — sessions, locks, counters, and rate-limit budgets live in a shared store behind an adapter, so horizontal scale is a config/replica change, not a refactor.

**Rationale.** Idempotency makes retries safe; short transactions free pooled connections and avoid serializing writers; statelessness makes any instance interchangeable. A scaled fleet multiplies pools — front the database with an external connection pooler before scaling instances. See [/rules/10-reliability-and-durability.md](../rules/10-reliability-and-durability.md) and [/memory/reliability-patterns.md](./reliability-patterns.md).

**Project records:** the pool sizing (`min`/`max`, timeouts), the shared-state store, and any SSE/WebSocket fan-out plan (sticky sessions vs. shared pub/sub).

---

## D10 — Rate-limit expensive endpoints; document the perf impact of every change

**Decision.** Global throttling fronts every route; search, analytics, export, and other costly endpoints get a tighter dedicated limiter, tuned from config. Every PR that adds a query or endpoint states, in its description: indexes added/used, pagination + max limit, expected row counts, caching + invalidation, any background offload, and any new shared-state dependency.

**Rationale.** Costly endpoints are the cheapest place for an attacker or a runaway client to hurt everyone; a per-route limit caps the blast radius. Recording the impact at PR time keeps these decisions durable instead of re-litigated per review — update this file when a new standing decision emerges, alongside tests and docs in the same change.

**Project records:** the global and per-endpoint limits and the source of the tuning values.

---

## Decision summary

| ID | Decision | Default | Anchored in |
| --- | --- | --- | --- |
| D1 | Bounded pagination | hard cap 100, clamp twice, paged envelope | [/rules/09](../rules/09-performance-and-scalability.md) |
| D2 | Index FK / `WHERE` / `ORDER BY` | composite eq-first; partial for soft-delete; migration-backed | [/rules/08](../rules/08-database-and-injection-safety.md) |
| D3 | No N+1 | join / eager / batched `IN`; paginate parent | [/rules/04](../rules/04-repositories-and-persistence.md) |
| D4 | Narrow projection | select needed columns; aggregate in DB | [/rules/06](../rules/06-types-enums-constants.md) |
| D5 | Cache via adapter | read-heavy/slow-changing only; degrade gracefully; invalidate | [/rules/12](../rules/12-library-wrapping-and-adapters.md) |
| D6 | Concurrency boundary | batch first; `Promise.all` in use cases/helpers, never services | [/rules/03](../rules/03-application-services-and-use-cases.md) |
| D7 | Offload heavy work | post-commit events; handlers catch their own errors | [/rules/19](../rules/19-async-events-and-jobs.md) |
| D8 | Stream, don't buffer | body limits; stream uploads/exports | [/rules/09](../rules/09-performance-and-scalability.md) |
| D9 | Idempotent + stateless | unique-key guard; short tx; shared-state store | [/rules/10](../rules/10-reliability-and-durability.md) |
| D10 | Rate-limit + document | per-route limiter; PR perf note | [/rules/07](../rules/07-security-authn-authz.md) |

---

**Related:** [/rules/09-performance-and-scalability.md](../rules/09-performance-and-scalability.md) · [/rules/08-database-and-injection-safety.md](../rules/08-database-and-injection-safety.md) · [/rules/04-repositories-and-persistence.md](../rules/04-repositories-and-persistence.md) · [/rules/10-reliability-and-durability.md](../rules/10-reliability-and-durability.md) · [/rules/19-async-events-and-jobs.md](../rules/19-async-events-and-jobs.md) · [/memory/reliability-patterns.md](./reliability-patterns.md) · [/memory/database-decisions.md](./database-decisions.md) · [/memory/known-pitfalls.md](./known-pitfalls.md) · [/skills/performance-review.md](../skills/performance-review.md)
