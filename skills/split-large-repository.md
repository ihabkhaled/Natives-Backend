# Skill: Split a Large Repository

## Intent

Restore persistence-only ownership, safe query construction, and bounded/scoped results before splitting by real persistence concern.

## When to use

Use for business logic in repositories, repeated query building, unsafe dynamic identifiers, unbounded/incorrectly scoped lists, or several persistence concerns.

## When not to use

Use [create-repository.md](./create-repository.md) for a healthy new method, another split skill for another layer, or [sql-injection-review.md](./sql-injection-review.md) for audit-only work.

---

## Rules this skill enforces

- **Persistence only.** No business rules, no authorization, no `messageKey` throws, no DTO mapping — a not-found is `null` ([04-repositories-and-persistence.md](../rules/04-repositories-and-persistence.md), rules 19–20).
- **Parameterized only.** Every runtime value is a bound parameter; never interpolate input into query text ([08 §1](../rules/08-database-and-injection-safety.md), rule 31).
- **Identifiers come from an allowlist.** Sort/filter columns resolve through a constant map of named columns — never client strings ([08 §2](../rules/08-database-and-injection-safety.md)).
- **Bounded + paginated.** Every list clamps `limit` to a hard max of **100** via named constants in `model/` ([04 §4](../rules/04-repositories-and-persistence.md), rule 37).
- **Split by ownership, never randomly.** One persistence concern per file; public behavior byte-for-byte stable ([23 §5](../rules/23-function-service-file-size-discipline.md)).
- **Minimal means minimum SAFE code.** The split never cuts DTO validation, auth/permission/ownership checks, `AppError`/`messageKey`, adapters, parameterized/bounded queries, tests, or docs (rule 46).

---

## Step 1 — Query-behavior tests FIRST

Characterize what the repository does **before** touching it: result shape (entity / `{ items, total }` / `null`), bounds, filters, soft-delete branches. These tests must stay green through every following step.

```ts
// src/modules/article/infrastructure/article.repository.spec.ts
it('lists published articles bounded, ordered, soft-delete filtered, with a total', async () => {
  await repository.listPublished(ownerId, { page: 1, limit: 999 });

  expect(findAndCount).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { ownerId, status: ArticleStatus.Published, deletedAt: IsNull() },
      order: { createdAt: 'DESC' },
      take: ARTICLE_LIST_MAX_LIMIT, // 999 clamps to 100
    }),
  );
});
```

See [write-unit-tests.md](./write-unit-tests.md); mock only at the ORM boundary.

## Step 2 — Move business rules OUT — never deeper in

Decisions travel **up**: status rules and predicates → `domain/article.policy.ts`; not-found and ownership translation → the service. Relocate, never delete — the guard must land in the service in the same change before the repo copy goes (rule 46).

```ts
// Don't — the repo decides readiness and speaks the user's error language
async findPublishable(id: string): Promise<Article> {
  const row = await this.articles.findOne({ where: { id } });
  if (!row) throw new ArticleNotFoundError();                    // ❌ errors.article.notFound → service
  if (!canPublishArticle(row)) throw new ArticleNotReadyError(); // ❌ domain policy → domain/
  return row;
}

// Do — the repo returns data; the service decides
async findById(id: string): Promise<Article | null> {
  return this.articles.findOne({ where: { id, deletedAt: IsNull() } });
}
```

DTO shaping goes to `lib/article.mappers.ts` — the repository returns raw entities only.

## Step 3 — Parameterize every query

While code is moving, prove no runtime value rides in query text. Prefer the structured `where` API — it binds by construction; in the query builder every value is a `:name` placeholder.

```ts
// Don't — interpolation is SQL injection
.where(`a.owner_id = '${ownerId}'`)

// Do — bound parameter, two-arg form
.where('a.owner_id = :ownerId', { ownerId })
```

## Step 4 — Extract repeated fragments to allowlisted sort/filter helpers

Duplicated `orderBy`/filter blocks become one helper that resolves identifiers through a constant map — named columns only, never client strings — and adds filters as explicit per-column branches, never a reflective loop.

```ts
// src/modules/article/model/article.constants.ts
export const ARTICLE_SORT_COLUMNS = {
  createdAt: 'a.created_at',
  title: 'a.title',
} as const;
export const ARTICLE_LIST_DEFAULT_LIMIT = 20;
export const ARTICLE_LIST_MAX_LIMIT = 100;
```

```ts
// Don't — client string drives the sort; the list is unbounded
.orderBy(query.sortBy)                             // ❌ identifier injection
return this.articles.find({ where: { ownerId } }); // ❌ grows to the whole table

// Do — allowlisted sort map + hard cap via named constants
.orderBy(ARTICLE_SORT_COLUMNS[sortKey], direction) // sortKey: keyof typeof ARTICLE_SORT_COLUMNS
.take(Math.min(options.limit ?? ARTICLE_LIST_DEFAULT_LIMIT, ARTICLE_LIST_MAX_LIMIT))
```

Follow [extract-helper-safely.md](./extract-helper-safely.md); the helper lives in `infrastructure/` beside its callers.

## Step 5 — Enforce pagination caps

Every list method clamps to `ARTICLE_LIST_MAX_LIMIT` (hard max **100**) from `model/article.constants.ts`, requires a stable `order`, and returns `{ items, total }`. The query DTO caps upstream too — the repository defends again; neither replaces the other.

## Step 6 — Split by persistence concern if multiple remain

If one repository (or one method) still mixes concerns — CRUD + search + reporting aggregations — split along those seams: `article.repository.ts` (row access), `article-search.repository.ts` (query-builder search), `article-stats.repository.ts` (aggregates). Each stays `@Injectable`, keeps its method signatures byte-for-byte, and registers in the module providers. Never split by line count ([23 §5](../rules/23-function-service-file-size-discipline.md)); mechanics in [decompose-large-file.md](./decompose-large-file.md).

## Step 7 — Re-audit any changed query text

If any query text moved or changed, run [sql-injection-review.md](./sql-injection-review.md) over the diff and add the malicious-payload tests it requires. Then rerun the Step 1 characterization suite — result shapes, bounds, and filters must be identical.

---

## Checklist

- [ ] Query behavior, bounds, scope, ordering, and result shape tested first.
- [ ] Business/error/DTO logic moved upward to owners.
- [ ] Values parameterized and identifiers allowlisted.
- [ ] Owner/tenant scope applied before count/pagination.
- [ ] Split follows a persistence seam and preserves contracts.

## Quality gates

```bash
npm run lint
npm run typecheck
npm run test
npm run test:coverage
npm run build
```

Never bypass Husky with `--no-verify`.

## Pitfalls

- **Business branching left "just this once".** The repo stays the hidden policy layer and the split re-runs next quarter ⇒ move every decision to `domain/` or the service now.
- **Deleting a guard while relocating it.** A missing ownership/not-found check is an IDOR or a 500, not a simplification ⇒ land the service-side check before removing the repo copy (rule 46).
- **A "flexible" generic filter loop.** Applying arbitrary client keys re-opens injection and mass assignment ⇒ explicit, named, parameterized per-column branches only.
- **Splitting by line count.** More files, same coupling, harder navigation ⇒ split only along persistence seams, one reason to change per file.
- **Clamping only in the DTO.** Internal callers bypass HTTP validation ⇒ clamp again in the repository with `ARTICLE_LIST_MAX_LIMIT` — defense in depth.
- **A helper that still interpolates.** Centralizing a splice centralizes the injection ⇒ helpers bind values and resolve identifiers from the allowlist, nothing else.
- **Skipping the re-audit because "queries only moved".** Moved text is changed text ⇒ Step 7 runs whenever query text differs in the diff.

## Related

[create-repository.md](./create-repository.md) · [sql-injection-review.md](./sql-injection-review.md) · [split-large-service.md](./split-large-service.md) · [split-large-use-case.md](./split-large-use-case.md) · [decompose-large-file.md](./decompose-large-file.md) · [extract-helper-safely.md](./extract-helper-safely.md) · [write-unit-tests.md](./write-unit-tests.md) · [../rules/23-function-service-file-size-discipline.md](../rules/23-function-service-file-size-discipline.md) · [../rules/04-repositories-and-persistence.md](../rules/04-repositories-and-persistence.md) · [../rules/08-database-and-injection-safety.md](../rules/08-database-and-injection-safety.md) · [../context/architecture-map.md](../context/architecture-map.md) · [../memory/known-pitfalls.md](../memory/known-pitfalls.md) · [README.md](./README.md)
