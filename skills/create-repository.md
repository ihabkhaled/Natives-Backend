# Skill: Add a repository method

> Add a persistence-only method to a feature repository — parameterized, bounded, paginated, ORM-agnostic, zero business logic. Implements the persistence layer of the canon in [/context/architecture-map.md](../context/architecture-map.md) and [04-repositories-and-persistence.md](../rules/04-repositories-and-persistence.md).

A repository does **one** thing: parameterized, bounded data access — `find` / `findOne` / `findAndCount` / `save` / `insert` / `update` / `softDelete` / `count` / `exists`. It returns a raw entity, `{ items, total }`, or `null`. It never decides, never authorizes, never transforms, never throws a domain error — the service/use-case does all of that.

---

## Rules this skill enforces

- **Persistence only.** No business rules, no authorization, no `messageKey` throws, no DTO mapping. A not-found is `null`; an empty list is `[]`. ([rules 19, 20](../rules/00-non-negotiable-rules.md))
- **ORM-agnostic contract.** The ORM client/model is imported **only** here (or in an adapter); the method signature is the swap surface (TypeORM / Prisma / Mongoose / Sequelize are interchangeable). ([12-library-wrapping-and-adapters.md](../rules/12-library-wrapping-and-adapters.md))
- **Parameterized only.** Every runtime value is a bound parameter; never interpolate input into a query string. Identifiers (sort columns) come from a whitelist constant. ([rule 31](../rules/08-database-and-injection-safety.md))
- **Bounded + paginated.** Every list takes `page`/`limit`, clamps `limit` to a hard max of **100**, requires a stable `order`, and returns the total. ([rule 37](../rules/09-performance-and-scalability.md))
- **Soft-delete aware.** Every read filters soft-deleted rows on every branch; deletes are soft by default.
- **Tenant-scoped** where the repo owns scoping: tenant key is a required parameter derived upstream from the verified token. ([rule 35](../rules/07-security-authn-authz.md))
- **No inline declarations**, no `any`, no `!`, explicit return types. ([rules 3, 7, 10–16](../rules/00-non-negotiable-rules.md))

---

## Step 1 — Locate the repository and its constants

The repository lives at `infrastructure/<feature>.repository.ts`, is `@Injectable`, wraps **one** entity/model received by constructor DI. Pagination/limit constants live in `model/<feature>.constants.ts` — search for the existing owner and extend it; never inline a literal or ship a duplicate constants file ([rule 13](../rules/00-non-negotiable-rules.md)).

```ts
// model/<feature>.constants.ts
export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIST_LIMIT = 100;
```

```ts
// infrastructure/<feature>.repository.ts  (TypeORM example — engine is interchangeable)
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Article } from '../domain/article.entity';

@Injectable()
export class ArticleRepository {
  constructor(
    @InjectRepository(Article) private readonly articles: Repository<Article>,
  ) {}
}
```

## Step 2 — Simple finds (typed, soft-delete filtered)

Prefer the parameterized find API; it binds values by construction. Return the raw entity or `null` — `noUncheckedIndexedAccess` makes index access `T | undefined`, so narrow, never `!`.

```ts
async findById(id: string): Promise<Article | null> {
  return this.articles.findOne({ where: { id, deletedAt: IsNull() } });
}
```

```ts
// Don't — authorization + user-facing error + mapping inside the repo
async findOwned(id: string, userId: string): Promise<ArticleResponseDto> {
  const row = await this.articles.findOneBy({ id });
  if (!row) throw new ArticleNotFoundError();        // ❌ messageKey throw → service (rule 26)
  if (row.ownerId !== userId) throw new ForbiddenError(); // ❌ ownership decision → service (rule 35)
  return toArticleResponse(row);                     // ❌ mapping → lib/<feature>.mappers.ts
}
```

## Step 3 — Paginated lists (bounded, ordered, returns the total)

Clamp the limit, require a deterministic `order`, return `{ items, total }`. The cap is enforced twice — in the query DTO ([05-dto-and-validation.md](../rules/05-dto-and-validation.md)) **and** here. Defense in depth.

```ts
import { ListOptions } from '../model/article.types';

async listByOwner(
  ownerId: string,
  options: ListOptions,
): Promise<{ items: Article[]; total: number }> {
  const page = options.page ?? DEFAULT_PAGE;
  const limit = Math.min(options.limit ?? DEFAULT_LIMIT, MAX_LIST_LIMIT);
  const [items, total] = await this.articles.findAndCount({
    where: { ownerId, deletedAt: IsNull() },
    order: { createdAt: 'DESC' }, // column MUST be indexed; required for stable paging
    skip: (page - 1) * limit,
    take: limit,
  });
  return { items, total };
}
```

```ts
// Don't — unbounded scan, no cap, no order, no total
async listByOwner(ownerId: string): Promise<Article[]> {
  return this.articles.find({ where: { ownerId } }); // ❌ grows to the whole table
}
```

> `ListOptions` is a typed shape in `model/<feature>.types.ts`, not inline ([rule 10](../rules/00-non-negotiable-rules.md)).

## Step 4 — Complex queries via the query builder (bound params, whitelisted identifiers)

Drop to the query builder only when the find API can't express the query. Every runtime **value** is bound; every **identifier** (sort/select column) resolves through a whitelist map — never a client string.

```ts
import { ARTICLE_SORT_COLUMNS } from '../model/article.constants';

async searchByTitle(
  ownerId: string,
  term: string,
  sortKey: keyof typeof ARTICLE_SORT_COLUMNS,
): Promise<Article[]> {
  return this.articles
    .createQueryBuilder('a')
    .where('a.owner_id = :ownerId', { ownerId })          // ✅ bound value
    .andWhere('a.title ILIKE :term', { term: `%${term}%` }) // ✅ bound value
    .andWhere('a.deleted_at IS NULL')
    .orderBy(ARTICLE_SORT_COLUMNS[sortKey], 'DESC')         // ✅ identifier from whitelist constant
    .take(MAX_LIST_LIMIT)
    .getMany();
}
```

```ts
// Don't — interpolation is SQL injection; client string fed straight into orderBy
.where(`a.owner_id = '${ownerId}'`)  // ❌ never interpolate a value
.orderBy(query.sortBy)               // ❌ never feed a client identifier into orderBy/select
```

## Step 5 — Tenant scoping the repository owns

When the repo is responsible for scoping, make the tenant key a **required** parameter so the compiler refuses an un-scoped call. The application layer still verifies ownership independently ([07-security-authn-authz.md](../rules/07-security-authn-authz.md)).

```ts
async findByIdForTenant(id: string, tenantId: string): Promise<Article | null> {
  return this.articles.findOne({ where: { id, tenantId, deletedAt: IsNull() } });
}
```

## Step 6 — Mutations and the transaction handle

Mutations return primitives (`affected > 0`), not decisions. Multi-write transactions are owned by the **use case** ([03-application-services-and-use-cases.md](../rules/03-application-services-and-use-cases.md)); the repository only **accepts** an optional handle and falls back to the default client. A repository never opens, commits, or rolls back a transaction.

```ts
import { EntityManager } from 'typeorm';

async save(article: Article, manager?: EntityManager): Promise<Article> {
  const repo = manager ? manager.getRepository(Article) : this.articles;
  return repo.save(article);
}

async softDelete(id: string): Promise<boolean> {
  const result = await this.articles.update(
    { id, deletedAt: IsNull() },
    { deletedAt: new Date() },
  );
  return (result.affected ?? 0) > 0;
}
```

Batch ids with `In([...])` — never loop a `findOne` per row (no N+1, no await-in-loop).

## Step 7 — Index every new query path (same change)

Most ORMs do not auto-index foreign keys. Before merging, confirm on the entity/schema (or a migration):

- [ ] every column in the new `WHERE` is indexed;
- [ ] every FK column you filter or join on is indexed;
- [ ] every `ORDER BY` column is indexed;
- [ ] common multi-column filters use a **composite** index in matching column order (e.g. `[ownerId, status]`, `[ownerId, createdAt]`);
- [ ] the soft-delete predicate (`deletedAt`) is covered so the live-row hot path stays fast.

Leave a one-line `// WHY` comment naming the query a non-obvious index serves. Schema changes go through [migration-plan.md](./migration-plan.md) → [add-migration-backfill.md](./add-migration-backfill.md).

---

## Tests FIRST

Write or extend `<feature>.repository.spec.ts` **before** the method. With a mocked ORM client, assert the exact `where` / `order` / `skip` / `take` passed in, the `deletedAt: IsNull()` filter on every branch, the pagination math, and the `MAX_LIST_LIMIT` clamp. Because the method touches the DB, also add an **integration** test against a real engine to prove the query and indexes behave. Coverage floor is 95% on the touched repository; critical query paths near 100%. See [write-unit-tests.md](./write-unit-tests.md) and [write-integration-tests.md](./write-integration-tests.md).

## Quality gates

```bash
npm run lint
npm run typecheck
npm run test
npm run test:coverage
npm run build
```

All green, no warnings. Never bypass Husky hooks with `--no-verify`.

## Pitfalls

- Putting a domain decision (`if (status === ...) throw`) in the repo — move it to the service/domain.
- Returning a transformed DTO instead of the raw entity — mapping belongs in `lib/<feature>.mappers.ts`.
- Forgetting `deletedAt: IsNull()` on one branch — silently resurrects soft-deleted rows.
- An unbounded list, a missing `order`, or no returned total — unstable, unpaginated pages.
- Interpolating a value, or feeding a client string into `orderBy`/`select` — SQL injection.
- An un-scoped `findById` on tenant data — cross-tenant read (IDOR).
- Opening a transaction inside the repo, or looping `findOne` (N+1 + await-in-loop).
- Importing the ORM outside `infrastructure/`/adapters, or inlining a type/constant — ESLint blocks both.

## Related

[create-service.md](./create-service.md) · [create-use-case.md](./create-use-case.md) · [create-module.md](./create-module.md) · [add-migration-backfill.md](./add-migration-backfill.md) · [sql-injection-review.md](./sql-injection-review.md) · [/rules/04-repositories-and-persistence.md](../rules/04-repositories-and-persistence.md) · [/memory/database-decisions.md](../memory/database-decisions.md) · [/memory/known-pitfalls.md](../memory/known-pitfalls.md)
