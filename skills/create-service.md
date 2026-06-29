# Skill: Add an Application Service Method

> Add a focused `@Injectable` service method that **orchestrates only** — coordinate repositories, adapters, and domain rules; return a typed result; throw `messageKey`'d `AppError`s; keep the body ≤ 20 lines. Implements the canon in [/context/architecture-map.md](../context/architecture-map.md) and [00-non-negotiable-rules.md](../rules/00-non-negotiable-rules.md).

A service is the **default** application building block: a focused, reusable capability (CRUD, a read/projection, a single-write flow with fail-safe side effects). If the method must mutate **multiple entities under one transaction** plus emit **ordered post-commit events**, stop — that is a use case, not a service ([create-use-case.md](./create-use-case.md)).

---

## Rules this skill enforces

- **Orchestration only.** No transformation, formatting, validation, or branch-heavy business logic in the body. Extract it:
  - mapping/shaping → `lib/<feature>.mappers.ts`
  - formatting → `lib/<feature>.formatters.ts`
  - business rules/invariants → `domain/<feature>.policy.ts`
  - payload building → `lib/<feature>.helpers.ts`
- **≤ 20 lines per method** (`max-lines-per-function` on `*.service.ts`). Longer ⇒ extract.
- **Zero inline declarations.** No inline types/interfaces/enums/constants — import from `model/` or `@shared`.
- **Typed return** on every method; never inferred `any`.
- **No vendor SDKs.** Persistence via the repository; external libraries via an adapter ([12-library-wrapping-and-adapters.md](../rules/12-library-wrapping-and-adapters.md)).
- **No concurrency primitives in services** — `Promise.all|allSettled|any|race` are banned here; batch in the repository instead.
- **Every user-facing failure** is a typed `AppError` with `errors.<feature>.<key>`.
- **Ownership/tenant** comes from the verified caller identity, never a client-supplied id.

---

## Step 1 — Tests FIRST

Before touching the service, write/extend the spec. Mock the repository and any adapter; assert the orchestration order, the mapped result shape, and the thrown error type **and** `messageKey` for **every** failure branch. Touched-module floor is **95%**; critical paths near 100%. See [write-unit-tests.md](./write-unit-tests.md).

```ts
it('throws a typed conflict when the slug already exists', async () => {
  repository.findBySlug.mockResolvedValue(existingArticle);
  await expect(service.publish(authorId, dto)).rejects.toMatchObject({
    messageKey: 'errors.article.duplicateSlug',
  });
});
```

## Step 2 — Declare the result type in `model/`

Never inline the return shape. Put it where the feature owns its types.

```ts
// model/article.types.ts
export interface ArticleSummary {
  id: string;
  slug: string;
  status: ArticleStatus; // from model/article.enums.ts
}
```

## Step 3 — The provider: constructor DI, `private readonly` deps

The repository and adapters are injected, never instantiated. No `process.env`, no `console.*`.

```ts
@Injectable()
export class ArticleService {
  constructor(
    private readonly repository: ArticleRepository,
    private readonly logger: AppLogger, // @core/logger adapter
  ) {}
}
```

## Step 4 — Write the method: guard → act → return

The canonical shape: **validate preconditions → call the repo/adapter/policy → return a mapped, typed result.** Keep it readable as a recipe.

```ts
// Don't — logic, transformation, magic strings, vendor leak, >20 lines
async publish(authorId: string, dto: PublishArticleDto): Promise<ArticleSummary> {
  const a = await this.repo.findById(dto.id);
  if (!a) throw new NotFoundException();          // untyped, no messageKey
  if (a.authorId !== authorId) throw new Error('no'); // raw throw
  if (a.status === 'draft') a.status = 'published';    // magic string, mutation
  await mailer.send(a.authorEmail, 'Published!');       // raw SDK in service
  return { id: a.id, slug: a.slug, status: a.status };  // inline shaping
}
```

```ts
// Do — thin orchestration, typed, messageKey'd, mapped, fail-safe
async publish(authorId: string, dto: PublishArticleDto): Promise<ArticleSummary> {
  this.logger.debug('publish', { authorId, articleId: dto.id });
  const article = await this.repository.findById(dto.id);
  assertArticleOwnedBy(article, authorId); // domain/ policy: throws typed AppError
  const published = await this.repository.save(applyPublish(article)); // lib/ helper
  this.notifyAuthor(published); // fire-and-forget, swallows its own errors
  return toArticleSummary(published); // lib/article.mappers.ts
}
```

- **Not found** → throw from the policy/helper, e.g. `ArticleNotFoundError('errors.article.notFound')`.
- **Forbidden ownership** → `assertArticleOwnedBy` throws `ArticleForbiddenError('errors.article.forbidden')`.
- Compare enum fields against enum members (`status === ArticleStatus.DRAFT`), never raw literals.

## Step 5 — Extract everything that isn't orchestration

Mapping, transition rules, and payload building live outside the service.

```ts
// lib/article.mappers.ts
export const toArticleSummary = (article: Article): ArticleSummary => ({
  id: article.id,
  slug: article.slug,
  status: article.status,
});

// domain/article.policy.ts
export function assertArticleOwnedBy(article: Article | null, authorId: string): asserts article is Article {
  if (article === null) throw new ArticleNotFoundError('errors.article.notFound');
  if (article.authorId !== authorId) throw new ArticleForbiddenError('errors.article.forbidden');
}
```

Prefer `.map` / `for...of` over `.forEach`. For independent reads, do **not** reach for `Promise.all` in the service — add a single batched (`IN`-clause) method on the repository to avoid N+1.

## Step 6 — Adapters and fail-safe side effects

Call external services through their adapter ([add-library-adapter.md](./add-library-adapter.md)), never a raw SDK. A fire-and-forget side effect must swallow its own error so a delivery failure never blocks the request — if this method is itself an event handler, the same rule applies ([19-async-events-and-jobs.md](../rules/19-async-events-and-jobs.md)).

```ts
private notifyAuthor(article: Article): void {
  this.notificationAdapter
    .send(article.authorId, ARTICLE_PUBLISHED_TEMPLATE) // constant from model/
    .catch((error: unknown) => this.logger.error('notify failed', { error }));
}
```

## Step 7 — Errors & i18n

Every throw is a typed `AppError` subclass carrying `errors.<feature>.<key>`; the global exception filter maps it to an HTTP status + sanitized body — no stacks/SQL/secrets leak. Cover **every** scenario (not-found, conflict, forbidden, validation, business-rule) with a distinct key, and add a translation for each supported locale ([add-i18n-message-key.md](./add-i18n-message-key.md), [16-i18n-and-messaging.md](../rules/16-i18n-and-messaging.md)).

## Step 8 — Register the provider

Add the service to its module's `providers`; export it through `index.ts` only if another module consumes it via the public surface.

```ts
@Module({ providers: [ArticleService, ArticleRepository], exports: [ArticleService] })
export class ArticleModule {}
```

---

## Quality gates

```bash
npm run lint            # 0 errors AND 0 warnings (incl. architecture/* + max-lines-per-function)
npm run typecheck       # tsgo --noEmit, project-wide
npm run test            # vitest
npm run test:coverage   # touched-module floor 95%, critical paths ~100%
npm run build           # compiles clean
```

Never bypass Husky with `--no-verify`.

## Pitfalls

- Comparing an enum-typed field to a raw string (`status === 'draft'`) fails `no-unsafe-enum-comparison` — use the enum member ([known-pitfalls.md](../memory/known-pitfalls.md)).
- Reaching for `Promise.all` to parallelize reads inside a service is banned — batch in the repository.
- Passing `undefined` to an optional field violates `exactOptionalPropertyTypes` — use a conditional spread.
- A method creeping past 20 lines, or doing string/format/branch work, means an extraction was skipped.
- Multi-entity write + ordered post-commit events is **not** a service — escalate to a use case.
- Untyped `throw`/`NotFoundException()` without a `messageKey` will leak unsafely and fails review.

## Related

[create-use-case.md](./create-use-case.md) · [create-repository.md](./create-repository.md) · [create-controller.md](./create-controller.md) · [create-dto-validation.md](./create-dto-validation.md) · [create-error.md](./create-error.md) · [add-library-adapter.md](./add-library-adapter.md) · [decompose-large-file.md](./decompose-large-file.md) · [write-unit-tests.md](./write-unit-tests.md) · [README](./README.md)
