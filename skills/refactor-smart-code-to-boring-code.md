# Skill: Refactor Smart Code to Boring Code

> Convert **impressive-but-exhausting** code — clever one-liners, nested ternaries, unreadable generics, magic chains — into boring, junior-readable code with **zero behavior change**: characterization tests pin behavior **first**, and the existing suite passes **unchanged** at the end. Implements [20-simple-readable-code.md](../rules/20-simple-readable-code.md) §3–4 (rule **46** of [00-non-negotiable-rules.md](../rules/00-non-negotiable-rules.md)).

Use this skill when code is technically correct and passes every gate but reads like a showcase — often AI-written: dense `reduce`/optional-chain expressions, conditional-type tricks, one-use generic abstractions. When NOT this skill → writing new code: [write-simple-readable-code.md](./write-simple-readable-code.md); trimming code the task never needed: [remove-unnecessary-code.md](./remove-unnecessary-code.md); broad cleanup of untidy-but-plain code: [simplify-existing-code.md](./simplify-existing-code.md); a file over its size budget: [decompose-large-file.md](./decompose-large-file.md).

---

## Rules this skill enforces

- **Boring beats clever.** No nested ternaries, dense one-liners, deep optional-chain decisions, or hidden flows ([20 §3](../rules/20-simple-readable-code.md), rule 46).
- **The 30-second type rule.** A mid-level engineer understands every type in ≤ 30 seconds; `interface` over conditional-type tricks ([20 §4](../rules/20-simple-readable-code.md)).
- **No speculative abstraction.** One use + no boundary reason ⇒ concrete code ([21-yagni-and-minimalism.md](../rules/21-yagni-and-minimalism.md), rule 44).
- **Refactors ship zero behavior change.** Behavior is pinned by tests before the rewrite; the suite passes unchanged after ([24-team-readable-code-review.md](../rules/24-team-readable-code-review.md)).
- **Minimal means minimum SAFE code.** DTO validation, auth/permission/ownership checks, `AppError`/`messageKey`, adapters, parameterized/bounded queries, tests, and docs never leave in the name of simplicity (rule 46).

---

## Step 1 — Tests FIRST: pin the behavior

Before touching a line, the clever code's behavior must be pinned. If tests exist, read them and confirm they cover every branch you are about to rewrite. If not, write characterization tests now ([write-unit-tests.md](./write-unit-tests.md)): representative inputs (happy, boundary, empty, null-heavy), exact outputs, and the exact error contract — the `AppError` subclass **and** its `messageKey` (`errors.article.notFound`), not just "it throws". Mock only at the adapter/repository boundary. If characterization exposes a real bug, **stop** — log the defect and fix it as a separate reviewed change; this skill ships zero behavior change.

## Step 2 — Name the intermediate steps

Break clever expressions into named intermediate variables — one transformation per line, each name stating what the value _is_. The compiler erases the variables; the reviewer keeps the names.

## Step 3 — Replace nested ternaries with branches

core `no-nested-ternary` is `error` (the unicorn variant is disabled by `eslint-config-prettier`) — a nested ternary never survives review. Use guard clauses and simple branches, or a named helper when the decision is reused.

```ts
// Don't — nested ternary: three outcomes compressed into one unreadable expression
const view =
  article.status === ArticleStatus.Published
    ? toPublicView(article)
    : article.status === ArticleStatus.Draft
      ? toDraftView(article)
      : toArchivedView(article);

// Do — simple branches; identical behavior, every path visible
if (article.status === ArticleStatus.Published) {
  return toPublicView(article);
}
if (article.status === ArticleStatus.Draft) {
  return toDraftView(article);
}
return toArchivedView(article);
```

## Step 4 — Inline one-use generic abstractions

A generic helper, base class, factory, or strategy object with a **single call site** is rule-44 debt. Replace it with concrete, plainly typed code at the call site. Re-abstract only when two-to-three real call sites exist — security/auth/error-mapping logic may extract early for testability.

## Step 5 — Replace magic chains with named mappers

Long chained transformations move into named functions owned by `lib/` — e.g. `src/modules/article/lib/article.mappers.ts` — each testable alone.

```ts
// src/modules/article/application/article.service.ts

// Don't — four transformations, optional-chain soup, zero names; passes every gate, exhausts every reviewer
return (
  articles
    ?.filter(a => a.status === ArticleStatus.Published)
    .map(a => toSummary(a, a.tags?.map(t => t.name) ?? []))
    .reduce(
      (acc, s) => ({ ...acc, [s.id]: s }),
      {} as Record<string, ArticleSummary>,
    ) ?? {}
);

// Do — named steps a junior can follow; mappers owned by lib/article.mappers.ts
const publishedArticles = filterPublishedArticles(articles ?? []);
const summaries = publishedArticles.map(mapArticleToSummary);
return indexSummariesByArticleId(summaries);
```

## Step 6 — Simplify the types until the 30-second rule passes

Conditional types, nested mapped types, inferred-return acrobatics, and clever overloads become plain `interface`s in `model/` plus explicit return types on public methods ([20 §4](../rules/20-simple-readable-code.md)). A type a mid-level engineer cannot read in 30 seconds gets simplified — or a documented PR justification, which almost never applies.

## Step 7 — Rename for domain clarity

`x`, `acc`, `res`, `d2` become domain names: `publishedArticles`, `summaryById`. Predicates read like questions (`isPublished`), mappers like conversions (`mapArticleToSummary`). Obvious names are half the refactor.

## Step 8 — Delete the cleverness comments

Comments that existed only to explain the trick die with the trick. Comments that explain a domain _why_ stay. If a comment is still needed to explain _what_ the code does, the refactor is not finished.

## Step 9 — Gates: the suite passes UNCHANGED

Run every gate. **No test file was edited to make the rewrite pass** — a test edit is a behavior change wearing a disguise. If a test fails, the rewrite diverged: fix the code, never the pin.

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

- **Rewriting before pinning.** Without characterization tests the boring version's equivalence is a guess ⇒ Step 1 is non-negotiable.
- **"Fixing" a bug mid-refactor.** A behavior change hides under the refactor label and dodges review ⇒ log the defect, ship the fix separately.
- **Editing tests until the rewrite passes.** The pin now certifies the divergence ⇒ revert the test, find where the rewrite diverged, fix the code.
- **Deleting a guard the one-liner "handled inline".** Dense expressions smuggle validation, ownership, and bounds checks ⇒ extract them into visible named checks — never remove (rule 46).
- **Over-extracting.** One readable method shattered into five two-line files trades cleverness for fragmentation ⇒ extract for clarity, duplication, or ownership only ([23 §5](../rules/23-function-service-file-size-discipline.md)).
- **Keeping the generic "for later".** One use + no boundary reason stays rule-44 debt ⇒ inline now; re-abstract at two-to-three real call sites.
- **Stale comments outliving the trick.** The comment now describes code that no longer exists ⇒ delete explanation comments with the cleverness they explained.

## Related

[write-simple-readable-code.md](./write-simple-readable-code.md) · [simplify-existing-code.md](./simplify-existing-code.md) · [extract-helper-safely.md](./extract-helper-safely.md) · [remove-unnecessary-code.md](./remove-unnecessary-code.md) · [review-for-readable-code.md](./review-for-readable-code.md) · [decompose-large-file.md](./decompose-large-file.md) · [write-unit-tests.md](./write-unit-tests.md) · [fix-eslint-typecheck.md](./fix-eslint-typecheck.md) · [../rules/20-simple-readable-code.md](../rules/20-simple-readable-code.md) · [../rules/21-yagni-and-minimalism.md](../rules/21-yagni-and-minimalism.md) · [../rules/24-team-readable-code-review.md](../rules/24-team-readable-code-review.md) · [../context/simple-code-map.md](../context/simple-code-map.md) · [../memory/code-simplicity-decisions.md](../memory/code-simplicity-decisions.md) · [README.md](./README.md)
