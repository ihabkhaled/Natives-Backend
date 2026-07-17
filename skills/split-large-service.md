# Skill: Split a Large Service

## Intent

Turn a god service into focused capabilities by moving bloat to its true owner and preserving the public surface behind a justified facade.

## When to use

Use when one service owns multiple capabilities, trips the 20-line method cap, mixes layers, requires huge test setup, or cannot change in isolation.

## When not to use

Do not split one cohesive short capability by line count. Use [decompose-large-file.md](./decompose-large-file.md) for mechanical facade moves, or the use-case/repository/adapter split skill for another layer.

---

## Rules this skill enforces

- **One responsibility per method, one concern per file — split by ownership, never randomly.** A split without a responsibility seam makes code worse ([23 §1–2, §5](../rules/23-function-service-file-size-discipline.md)).
- **Services orchestrate one focused capability, ≤ 20 lines/method.** Longer ⇒ extract to `lib/` / `domain/` ([03](../rules/03-application-services-and-use-cases.md), rule 21).
- **The facade preserves the public surface.** Same provider token, method names, signatures, return types — one-line delegations only ([03 facade decomposition](../rules/03-application-services-and-use-cases.md)).
- **A forwarding-only class is not a layer.** Pass-through indirection is speculative abstraction — delete it ([21-yagni-and-minimalism.md](../rules/21-yagni-and-minimalism.md), rule 44).
- **One-way dependency direction.** Use cases call services; services never call use cases ([03](../rules/03-application-services-and-use-cases.md), rule 22).
- **Minimal means minimum SAFE code.** The split never cuts DTO validation, auth/permission/ownership checks, `AppError`/`messageKey`, adapters, parameterized/bounded queries, tests, or docs (rule 46).

---

## Step 1 — Tests FIRST

Run the existing suite and capture the green baseline — that suite is your contract. Add **characterization tests** for any branch the move will surface (a guard that only ran deep inside the monolith), in the existing style ([write-unit-tests.md](./write-unit-tests.md)). Existing tests must pass **unchanged** after the split; never weaken an assertion to make a refactor pass.

## Step 2 — Inventory the capabilities the service actually owns

List every public method and cluster by capability: `ArticleService` doing create/update **+** publish/archive **+** search **+** notification fan-out owns four capabilities — four reasons to change. Each cluster is a split candidate. One cohesive capability that is merely _long_ is **not** — that is phase-helper extraction per [decompose-large-file.md](./decompose-large-file.md), not this skill.

## Step 3 — Route each kind of bloat to its true owner

Drain the service before splitting it — most "large services" shrink below the threshold once each concern moves home ([23 §3](../rules/23-function-service-file-size-discipline.md)):

| Bloat inside the service                    | Route to                                                          |
| ------------------------------------------- | ----------------------------------------------------------------- |
| Business decisions / invariants / state law | `domain/<feature>.policy.ts` — pure, unit-tested                  |
| Data shaping / string building              | `lib/<feature>.mappers.ts` / `lib/<feature>.formatters.ts`        |
| Constants / types / enums                   | `model/*.constants.ts` / `model/*.types.ts` — never inline        |
| Query building / persistence                | `infrastructure/<feature>.repository.ts` — parameterized, bounded |
| Vendor SDK calls                            | `adapters/*.adapter.ts` — never a raw SDK in a service            |

```ts
// Don't — decision + shaping + persistence tangled in one 40-line method
// (also a raw status literal — rule 9)
if (
  article.status === 'draft' &&
  article.body.length > 0 &&
  !article.deletedAt
) {
  /* … */
}

// Do — each concern with its owner; the method reads like a recipe
const article = await this.articleRepo.findById(id); // repo returns null — it never throws (rules/04)
if (article === null) {
  throw new NotFoundError(
    ARTICLE_NOT_FOUND_MESSAGE,
    ARTICLE_NOT_FOUND_MESSAGE_KEY,
  );
}
assertOwnership(article.ownerId, actorId); // guard STAYS — rule 46
ArticlePolicy.assertPublishable(article); // domain/ decides
const published = await this.articleRepo.update(id, {
  status: ArticleStatus.Published,
});
return toArticleResponse(published); // lib/<feature>.mappers.ts
```

> **The repository never throws a domain error.** A miss is `null`; the **service** translates it into a typed `AppError` with a `messageKey` ([04-repositories-and-persistence.md](../rules/04-repositories-and-persistence.md), rules 19–20). A `findByIdOrThrow` convenience belongs on the service, never on the repository ([create-use-case.md](./create-use-case.md)).

## Step 4 — Facade-decompose what remains

If multiple capabilities still remain, split into per-capability sub-services (`article-publish.service.ts`, `article-search.service.ts`) behind a thin facade — mechanics per [decompose-large-file.md](./decompose-large-file.md): bodies move **verbatim**; the facade keeps the provider token and every public name/signature **byte-stable**; each public method is a **one-line delegation**. A shared _pure_ helper becomes ONE export in `lib/<feature>.helpers.ts`; a shared _stateful_ helper becomes ONE injected collaborator — never duplicated, never a dangling `this.x`.

```ts
// src/modules/article/application/article.service.ts — facade, surface unchanged
@Injectable()
export class ArticleService {
  constructor(
    private readonly crud: ArticleCrudService,
    private readonly publishing: ArticlePublishService,
  ) {}

  publish(id: string, user: AuthUser): Promise<Article> {
    return this.publishing.publish(id, user); // one line, signature preserved
  }
}
```

Register every sub-service in the module's providers in the same change.

## Step 5 — Delete any resulting pass-through class

If Step 3 drained a service down to pure forwarding — every method one delegation, no guard, no coordination — it is **not a layer** (rule 44): delete it and point consumers at the real owner. Keep a facade only while it aggregates **several** sub-services behind one stable token; a facade over one collaborator is indirection with no job.

## Step 6 — Keep the dependency direction intact

Services never call use cases — ESLint blocks the import. If the split exposes genuine multi-entity transactional work with ordered post-commit events, **escalate that method to a use case** ([create-use-case.md](./create-use-case.md)) and let it call the new sub-services; never pull orchestration downward to dodge the boundary.

## Step 7 — Gates

Run the full gate set below, then [final-validation.md](./final-validation.md). Update module docs in the same change — a split that consumers cannot navigate is unfinished.

---

## Checklist

- [ ] Characterization tests cover moved branches and safety behavior.
- [ ] Decisions/mapping/persistence/vendor calls routed to correct owners.
- [ ] Public methods/tokens remain stable or change explicitly with tests/docs.
- [ ] Facade represents multiple capabilities; one-collaborator pass-through removed.
- [ ] No duplicate helper, dependency inversion, or safety loss.

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

- **Splitting by line count instead of responsibility.** More files, same coupling, harder navigation ⇒ split only on capability seams ([23 §5](../rules/23-function-service-file-size-discipline.md)).
- **Renaming a public method or changing the provider token mid-split.** Breaks controllers, use cases, and e2e tests ⇒ keep the facade byte-stable; ship behavior changes as a separate, tested commit.
- **Dropping a guard, ownership check, or `messageKey` as "simplification".** Rule-46 violation, MUST FIX ⇒ safety code moves with its method — it never dies in a refactor.
- **Duplicating a shared private helper into each sub-service.** Two owners drift ⇒ one `lib/` export or one injected collaborator ([22-reuse-before-creating.md](../rules/22-reuse-before-creating.md)).
- **Keeping a facade that forwards to a single sub-service.** Pass-through layer, rule 44 ⇒ delete the shell and re-point consumers.
- **A sub-service importing a use case to "reuse orchestration".** Direction inverted, cycle risk ⇒ move the orchestration up into the use case instead.
- **Types, enums, or constants left inline in the new files.** Zero-inline violation ⇒ `model/` or `@shared` ([06-types-enums-constants.md](../rules/06-types-enums-constants.md)).

## Related

[decompose-large-file.md](./decompose-large-file.md) · [split-large-use-case.md](./split-large-use-case.md) · [split-large-repository.md](./split-large-repository.md) · [extract-helper-safely.md](./extract-helper-safely.md) · [create-service.md](./create-service.md) · [create-use-case.md](./create-use-case.md) · [write-unit-tests.md](./write-unit-tests.md) · [../rules/23-function-service-file-size-discipline.md](../rules/23-function-service-file-size-discipline.md) · [../rules/03-application-services-and-use-cases.md](../rules/03-application-services-and-use-cases.md) · [../rules/21-yagni-and-minimalism.md](../rules/21-yagni-and-minimalism.md) · [../context/architecture-map.md](../context/architecture-map.md) · [../memory/known-pitfalls.md](../memory/known-pitfalls.md) · [README.md](./README.md)
