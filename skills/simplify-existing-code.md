# Skill: Simplify Existing Code

> Take code that already works but is hard to read — long methods, mixed responsibilities, decisions buried in orchestration, AI-generated excess — and make it boring: **characterization tests first**, **delete before restructuring**, **every piece moves to its owning layer**, and **public behavior stays byte-for-byte identical**. Implements [20-simple-readable-code.md](../rules/20-simple-readable-code.md), [21-yagni-and-minimalism.md](../rules/21-yagni-and-minimalism.md), and [22-reuse-before-creating.md](../rules/22-reuse-before-creating.md) (rules **43–46** of [00-non-negotiable-rules.md](../rules/00-non-negotiable-rules.md)).

Use this skill when a file is hard to scan, a method runs long, a service owns several responsibilities, a use case contains decisions instead of orchestration, a repository contains business logic, an adapter leaks vendor types, test setup is unreadable, or an AI generated more code than the task needed. When the problem is purely structural size — a huge file that needs splitting behind a facade → use [decompose-large-file.md](./decompose-large-file.md); when the problem is cleverness rather than sprawl — nested ternaries, dense chains, type gymnastics → use [refactor-smart-code-to-boring-code.md](./refactor-smart-code-to-boring-code.md).

---

## Rules this skill enforces

- **The Simple Code Ladder applies to existing code too.** need it → reuse → native → adapter → helper → direct; anything the ladder rejects gets deleted or replaced ([20 §2](../rules/20-simple-readable-code.md), rule 43).
- **Speculative code dies.** Unused params, "maybe later" branches, one-consumer abstractions with no boundary reason ⇒ delete ([21-yagni-and-minimalism.md](../rules/21-yagni-and-minimalism.md), rule 44).
- **Each layer keeps its job.** Use case orchestrates, service stays focused, domain decides, repository persists ([01-architecture-and-module-boundaries.md](../rules/01-architecture-and-module-boundaries.md), [23-function-service-file-size-discipline.md](../rules/23-function-service-file-size-discipline.md)).
- **Boring beats clever.** Complex conditions become named predicates; dense chains become named steps ([20 §3](../rules/20-simple-readable-code.md), rule 46).
- **Minimal means minimum SAFE code.** Simplification never cuts DTO validation, auth/permission/ownership checks, `AppError`/`messageKey`, adapters, parameterized/bounded queries, tests, or docs ([21 §4](../rules/21-yagni-and-minimalism.md), rule 46).

---

## Step 1 — Characterization tests FIRST

Pin current behavior before touching anything. Run the existing suite to capture the green baseline, then add characterization tests for every branch, error path, and `messageKey` the suite misses ([write-unit-tests.md](./write-unit-tests.md)). These tests are your contract — they must pass **unchanged** at the end. Never weaken an assertion to make the refactor pass.

## Step 2 — Identify the real responsibilities

Read the file end to end and list what it actually does: orchestration, business decisions, mapping, persistence, vendor calls, formatting. Assign each item its owner — use case, service, `domain/`, `lib/`, repository, adapter ([../context/architecture-map.md](../context/architecture-map.md)). Anything with no responsibility is a deletion candidate; anything with the wrong owner is a move candidate.

## Step 3 — Delete dead code

Remove unreachable branches, unused params/imports/config, commented-out blocks, speculative hooks, and single-consumer abstractions with no §2 reason ([21 §1–2](../rules/21-yagni-and-minimalism.md)). Delete **before** restructuring — the "complex" method is often mostly dead weight. Verify each deletion against the Step 1 tests; safety code (guards, validation, error mapping) is **never** dead code. Cross-file cleanup → [remove-unnecessary-code.md](./remove-unnecessary-code.md).

## Step 4 — Rename for domain clarity

Rename cryptic variables and functions to state domain intent: `d` → `publishedAt`, `check()` → `assertArticleIsPublishable()`, `proc()` → `mapArticleToSummary()`. Booleans read as predicates (`isPublishable`), functions as verb + noun. Rename **internals only** — public methods, routes, and DTO fields are contract surface (Step 8). Delete every comment the new name makes redundant.

## Step 5 — Extract pure helpers to lib/

Repeated or dense transformation logic becomes a named pure function with one owner ([extract-helper-safely.md](./extract-helper-safely.md)):

```ts
// Don't — mapping inline in a service method: unreadable, untestable alone, duplicated in two services
const summary = {
  id: a.id,
  title: a.title.trim(),
  tags: a.tags?.map(t => t.name).filter(Boolean) ?? [],
};

// Do — one owned pure mapper
// src/modules/article/lib/article.mappers.ts
export function mapArticleToSummary(article: Article): ArticleSummary {
  return {
    id: article.id,
    title: article.title.trim(),
    tags: mapTagNames(article.tags),
  };
}
```

Apply the 1–2–3 rule ([21 §3](../rules/21-yagni-and-minimalism.md)) — one obvious inline line stays inline; do not manufacture tiny files.

## Step 6 — Move decisions to domain/

A use case orchestrates; it does not decide. Multi-clause business conditions become named domain predicates or policies:

```ts
// Don't — the use case decides publishability inline with raw strings and a raw Error
if (
  article.status === 'draft' &&
  article.reviewCount >= 2 &&
  !article.deletedAt
) {
  /* ... */
} else {
  throw new Error('cannot publish');
} // no AppError, no messageKey

// Do — domain owns the decision; the use case orchestrates and maps the failure
// src/modules/article/domain/article.policy.ts
export function canPublishArticle(article: Article): boolean {
  return (
    article.status === ArticleStatus.Draft &&
    hasRequiredReviews(article) &&
    !article.deletedAt
  );
}

// src/modules/article/application/publish-article.use-case.ts
if (!canPublishArticle(article)) {
  throw new ConflictError(
    'Article cannot be published',
    'errors.article.notPublishable',
  );
}
```

## Step 7 — Keep each layer in its lane

Orchestration stays in the use case (transactions + ordered side effects); the service stays focused with methods ≤ 20 lines; the repository exposes parameterized, bounded persistence methods only:

```ts
// Don't — repository deciding business rules and throwing user-facing errors
async publish(id: string): Promise<Article> {
  const article = await this.findOne(id);
  if (article.reviewCount < 2) throw new Error('not reviewed'); // business rule in persistence
  /* ... */
}

// Do — repository persists; domain decided in Step 6; the use case ordered the calls
update(id: string, data: UpdateArticleData): Promise<Article> { /* parameterized, bounded */ }
```

If moving responsibilities still leaves an oversized file, stop — that split belongs to [decompose-large-file.md](./decompose-large-file.md), [split-large-service.md](./split-large-service.md), [split-large-use-case.md](./split-large-use-case.md), or [split-large-repository.md](./split-large-repository.md).

## Step 8 — Preserve public behavior byte-for-byte

Same routes, DTOs, guards, transactions, event order, `messageKey`s, logging, and return shapes. Diff every moved body against the original; Step 1 tests pass unchanged. Untangle the last unreadable test setup into minimal named arrange helpers without touching assertions. Any genuine behavior improvement you found is a **separate, tested commit** — record it as a FOLLOW-UP, not a drive-by.

---

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

- **Refactoring without characterization tests.** A silent behavior change ships and no gate catches it ⇒ pin behavior first; the old suite plus new characterization tests are the contract.
- **Deleting a guard, validation, or error mapping as "unnecessary".** Security hole and a rule-46 violation ⇒ safety code is never dead code; prove redundancy with a test before deleting.
- **"Improving" behavior mid-simplification.** Consumers break and the refactor becomes unreviewable ⇒ byte-for-byte now, behavior change as a separate tested commit.
- **Renaming public surface.** A route, exported method, or DTO field rename breaks clients and e2e tests ⇒ rename internals only.
- **Extraction as fashion.** Three meaningless two-line files replace one readable method ⇒ extract only for clarity, duplication, or ownership ([23 §5](../rules/23-function-service-file-size-discipline.md)).
- **Writing a "cleaner" parallel helper instead of extending the owner.** Two sources of truth drift ⇒ rule 45; extend the existing owner ([reuse-before-creating.md](./reuse-before-creating.md)).
- **Simplification drifting into a structural split.** Scope balloons and review quality drops ⇒ finish this skill, then run [decompose-large-file.md](./decompose-large-file.md) as its own change.

## Related

[decompose-large-file.md](./decompose-large-file.md) · [refactor-smart-code-to-boring-code.md](./refactor-smart-code-to-boring-code.md) · [remove-unnecessary-code.md](./remove-unnecessary-code.md) · [extract-helper-safely.md](./extract-helper-safely.md) · [write-simple-readable-code.md](./write-simple-readable-code.md) · [reuse-before-creating.md](./reuse-before-creating.md) · [write-unit-tests.md](./write-unit-tests.md) · [review-for-readable-code.md](./review-for-readable-code.md) · [../rules/20-simple-readable-code.md](../rules/20-simple-readable-code.md) · [../rules/21-yagni-and-minimalism.md](../rules/21-yagni-and-minimalism.md) · [../rules/23-function-service-file-size-discipline.md](../rules/23-function-service-file-size-discipline.md) · [../context/simple-code-map.md](../context/simple-code-map.md) · [../memory/code-simplicity-decisions.md](../memory/code-simplicity-decisions.md) · [README.md](./README.md)
