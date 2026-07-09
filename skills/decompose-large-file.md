# Skill: Decompose a Large File or Method

> Split an overgrown controller / service / use-case into focused collaborators behind a thin facade that preserves the public API, or split a long method into private phase-helpers — a pure, behavior-preserving structural refactor. Implements the canon in [/context/architecture-map.md](../context/architecture-map.md) and [00-non-negotiable-rules.md](../rules/00-non-negotiable-rules.md).

## Rules this skill enforces

- **Layer boundaries hold after the split.** A controller stays thin (one delegation/method); a service method stays ≤20 lines; a repository stays persistence-only. Collaborators inherit the SAME import restrictions as the file they came from — ESLint `architecture/*` does not relax. ([01-architecture-and-module-boundaries.md](../rules/01-architecture-and-module-boundaries.md), [13-eslint-and-typescript.md](../rules/13-eslint-and-typescript.md))
- **Zero inline declarations.** Moved types/enums/constants/maps go to `model/` or `@shared`, never inline in the new files. ([06-types-enums-constants.md](../rules/06-types-enums-constants.md))
- **Behavior is byte-identical.** Same DTOs, guards, transactions, `messageKey`s, event order, logging, return shapes. A behavior change is a separate, tested commit. ([00-non-negotiable-rules.md](../rules/00-non-negotiable-rules.md) rule 42)
- **No duplicated shared helpers.** A shared concern lives in one place and is imported/injected, never copy-pasted into each collaborator. ([03-application-services-and-use-cases.md](../rules/03-application-services-and-use-cases.md))

## When to use

- A controller carries many handlers across distinct concerns (`crud`, `lifecycle`, `search`).
- A service mixes several cohesive capabilities and is hard to navigate.
- A service method trips `max-lines-per-function` (20), or a use-case orchestration sprawls past ~80 lines.

Split on **cohesion, not raw line count.** A single cohesive file (one route surface, one state machine) is fine when large. The 20-line service-method ceiling is the hard limit; orchestrations should still read like a recipe.

---

## A. Controller -> handler collaborators

A controller may not hold logic, but a fat controller with many delegations is still worth grouping. Move each concern's delegations into a focused sub-controller (its own route prefix) — or, when one route surface must stay, push the work down into per-concern services and keep the controller as a pure delegating facade.

**Step 1 — group by cohesion.** Identify clusters (`<feature>` CRUD vs. lifecycle vs. search).

**Step 2 — create a service per cluster** (the controller has no logic to move, so the split happens one layer down). Each delegation in the facade points at the right service:

```typescript
// Don't — one controller delegating to one god-service
@Controller('articles')
export class ArticleController {
  constructor(private readonly articles: ArticleService) {} // ArticleService does everything
}

// Do — thin facade, one delegation per method, work split across focused services
@Controller('articles')
export class ArticleController {
  constructor(
    private readonly crud: ArticleService,
    private readonly lifecycle: ArticlePublishService,
    private readonly search: ArticleSearchService,
  ) {}

  @Post()
  create(@Body() dto: CreateArticleDto): Promise<ArticleResponseDto> {
    return this.crud.create(dto);
  }

  @Post(':id/publish')
  publish(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<ArticleResponseDto> {
    return this.lifecycle.publish(id, user);
  }
}
```

**Step 3 — keep route paths, guards, decorators, and OpenAPI metadata identical** so existing clients and e2e tests need zero edits.

## B. Service / use-case -> focused collaborators

Same shape, one layer down. Break a god-service into per-concern services behind a facade that keeps the public method names other modules and use-cases call.

**Step 1 — name each collaborator after its capability:** `<feature>.service.ts`, `<feature>-publish.service.ts`, `<feature>-search.service.ts`.

**Step 2 — wire them via constructor DI;** the facade delegates one line per method:

```typescript
// Do — facade preserves the public API; each method is a single delegation
@Injectable()
export class ArticleService {
  constructor(
    private readonly crud: ArticleCrudService,
    private readonly publishing: ArticlePublishService,
  ) {}

  findById(id: string): Promise<Article> {
    return this.crud.findById(id);
  }

  publish(id: string, user: AuthUser): Promise<Article> {
    return this.publishing.publish(id, user);
  }
}
```

**Step 3 — extract shared helpers ONCE.** A _pure_ helper -> a named export in `lib/<feature>.helpers.ts`. A _stateful_ helper (uses a repository/adapter) -> one collaborator service, constructor-injected into each consumer. Never leave a dangling `this.x` that no longer resolves; never duplicate.

```typescript
// Don't — same helper copied into two services
// Do — one shared collaborator injected where needed
@Injectable()
export class ArticleCrudService {
  constructor(private readonly support: ArticleSupportService) {}
  // ...uses this.support.assertEditable(article)
}
```

**Step 4 — if the split reveals genuine multi-entity, multi-step, transactional work, escalate to a use-case** (it owns the transaction + ordered post-commit events; it calls services, never the reverse). See [create-use-case.md](./create-use-case.md).

## C. Oversized method -> private phase-helpers

When one service method exceeds 20 lines (or a use-case orchestration sprawls), extract sequential phases into `private` helpers on the same class; the public method becomes a thin orchestrator.

**Step 1 — extract whole return/throw-terminated phases,** not arbitrary line ranges.

**Step 2 — preserve control flow exactly.** A `return`/`throw` inside an extracted phase must still exit the public method — the orchestrator does `return await this.<phase>(...)`. Thread every read variable in as a parameter; return every value later code needs; keep `await` ordering identical.

```typescript
// Don't — one >20-line method doing validate + load + mutate + persist + notify
// Do — orchestrator + named phases (each ≤20 lines)
@Injectable()
export class ArticlePublishService {
  async publish(id: string, user: AuthUser): Promise<Article> {
    const article = await this.loadOwned(id, user);
    this.assertPublishable(article);
    return this.persistPublished(article);
  }

  private async loadOwned(id: string, user: AuthUser): Promise<Article> {
    const article = await this.repo.findById(id);
    if (!article) throw new ArticleNotFoundError(id);
    this.ownership.assertOwner(article, user); // throw still exits publish()
    return article;
  }

  private assertPublishable(article: Article): void {
    ArticlePolicy.assertCanPublish(article); // domain decides; messageKey unchanged
  }

  private persistPublished(article: Article): Promise<Article> {
    return this.repo.update(article.id, { status: ArticleStatus.Published });
  }
}
```

Do not reorder side effects, change `messageKey`s, or alter logging during the move. Pure-logic phases (no `this`/no I/O) prefer a named export in `domain/` or `lib/`.

---

## Tests FIRST

- This is behavior-preserving, so **run the existing suite before touching anything** to capture the green baseline — that suite is your contract. Existing tests must pass **unchanged** after the split; they exercise the moved code through the facade, so coverage holds.
- Before extracting, add any **missing** characterization tests for branches the move will surface (e.g. a guard clause that only ran inside the old monolith), in the existing style — never weaken assertions to make a refactor pass.
- Verify byte-identical behavior by diffing each moved body against the original: same parsing, service/repository calls, DTOs, transactions, event order, status mapping, `messageKey`s, and logging.

## Quality gates

```bash
npm run lint          # architecture/* boundaries + max-lines-per-function (20 on services)
npm run typecheck     # tsgo --noEmit — no broken this.x / import after the move
npm run test          # existing suite passes UNCHANGED
npm run test:coverage # ≥95% floor still holds per touched module
npm run build
```

Never bypass a failing gate with `--no-verify`; a red gate means the refactor changed behavior — fix the root cause.

## Pitfalls

- **Renaming a public method, route path, or DTO** — breaks consumers, e2e tests, and other modules. The facade must preserve the surface exactly.
- **A handler or new service importing a repository it must not** (controller surface) **or a vendor SDK** (anything outside an adapter) — collaborators inherit the source layer's import boundary; ESLint will reject it.
- **Duplicating a shared helper** into each collaborator instead of one exported function or one injected support service.
- **A `return`/`throw` inside an extracted phase that no longer exits the public method** — the orchestrator forgot `return await`.
- **Inline declarations sneaking into the new files** — move types/enums/constants to `model/`/`@shared`, not inline. ([06-types-enums-constants.md](../rules/06-types-enums-constants.md))
- **"Improving" behavior mid-move** — keep it byte-identical; ship behavior changes as a separate, tested commit.
- **Leaving the facade as a god-class that just forwards 40 methods** — if delegations span unrelated concerns, split the module surface, don't paper over it.

## Definition of done

The facade preserves the public API byte-for-byte; no service method exceeds 20 lines and no method holds unowned logic; shared helpers live in exactly one place; layer import boundaries and zero-inline rules still pass; every consumer and test is untouched and green; all quality gates pass.

## Related

[create-controller.md](./create-controller.md) · [create-service.md](./create-service.md) · [create-use-case.md](./create-use-case.md) · [write-unit-tests.md](./write-unit-tests.md) · [fix-eslint-typecheck.md](./fix-eslint-typecheck.md) · [03-application-services-and-use-cases.md](../rules/03-application-services-and-use-cases.md) · [13-eslint-and-typescript.md](../rules/13-eslint-and-typescript.md) · [/context/architecture-map.md](../context/architecture-map.md) · [README.md](./README.md)
