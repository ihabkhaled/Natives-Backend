# 20 — Simple Readable Code

> **The best backend code is the code the next developer understands immediately.** IronNest code reads like it was written by a calm senior engineer for a team of mixed experience levels — boring, obvious, safe, layered, and easy to change. Implements rules **43** and **46** of [00-non-negotiable-rules.md](./00-non-negotiable-rules.md) on top of the layering in [/context/architecture-map.md](../context/architecture-map.md). Simplicity is a quality bar, **never** a license to cut safety: DTO validation, auth/permissions/ownership, `AppError`/`messageKey`, adapters, parameterized/bounded queries, observability, tests, and docs always stay — no rule in this rulebook is tradeable for a smaller diff.

The goal is not "fewest lines at any cost." The goal is: **write only what the task needs, in the clearest possible way, while keeping every existing IronNest guarantee intact.** Code must not look like a code-golf contest, a framework demo, a TypeScript trick showcase, an abstraction factory, or a "future-proof" architecture for imaginary requirements.

---

## 1. Who must be able to read it

Every change must be readable by **all** of: junior backend engineers, mid-level engineers, seniors, tech leads, QA engineers, security reviewers, production support, future maintainers, and AI coding agents. Two named bars, used in review ([24-team-readable-code-review.md](./24-team-readable-code-review.md)):

- **Junior-readable** — a junior can follow the flow top to bottom without archaeology.
- **Senior-trustworthy** — a senior can trust the boundaries (layers, validation, guards, bounds, error mapping) without re-deriving them.

---

## 2. The Simple Code Ladder (rule 43)

Run this ladder **before writing new code** — after reading the touched code, never instead of it:

1. **Does this code need to exist?** If no, do not write it.
2. **Does IronNest already have this?** Search existing modules, `src/shared`, `src/core`, `src/config`, rules, skills, memory, tests — [22-reuse-before-creating.md](./22-reuse-before-creating.md). If yes, reuse or extend the existing owner.
3. **Does Node.js, TypeScript, NestJS, or the platform already solve it?** If yes, use the native solution.
4. **Does an already-approved dependency solve it through an existing adapter?** If yes, use the existing adapter ([12-library-wrapping-and-adapters.md](./12-library-wrapping-and-adapters.md)).
5. **Can this be a small pure helper?** If yes, place it with the correct owner — `lib/`, `domain/`, `model/`, `@shared/*`, or `@core/*` ([23-function-service-file-size-discipline.md](./23-function-service-file-size-discipline.md)).
6. **Can the solution be direct and readable?** If yes, write the direct readable version.
7. **Only then create a new abstraction** — and only with a real current reason: repeated use, a layer boundary, an external adapter, security isolation, a transaction boundary, or testability ([21-yagni-and-minimalism.md](./21-yagni-and-minimalism.md)).

> **The ladder never skips a gate.** It does not replace investigation, tests-first, docs, strict TypeScript, ESLint, DTO validation, auth/permission/ownership checks, `AppError`/`messageKey`, repository bounds, adapter wrapping, observability, or security review. Being lazy about code volume is required; being lazy about reading, validation, or safety is forbidden.

---

## 3. Prefer / avoid

| Prefer                                       | Over                                                          |
| -------------------------------------------- | ------------------------------------------------------------- |
| Obvious names                                | Short or cryptic names                                        |
| Direct code                                  | Clever code                                                   |
| Simple branches and guard clauses            | Nested expressions and nested ternaries (`no-nested-ternary`) |
| A named helper for a complex condition       | A multi-clause boolean inline                                 |
| Small domain helpers                         | Repeated logic                                                |
| Explicit orchestration in services/use cases | Hidden side effects and magic flows                           |
| Readable tests that state the scenario       | Snapshot-heavy mystery tests                                  |
| Boring code that passes gates                | Impressive code that slows reviews                            |

Avoid, always: nested ternaries; deep optional-chaining chains inside business decisions; long chained transformations; overly generic utility names; type gymnastics; hidden side effects; huge methods and god services; pass-through services; speculative patterns, base classes, factories, and strategy objects without a current need (rule 44); unnecessary DI tokens, decorators, config values, and env vars; comments that explain unclear code instead of fixing it.

```ts
// Don't — dense one-liner: three transformations, no names, unreadable at review speed
const result = items
  ?.filter(Boolean)
  .map(x => x.a?.b)
  .reduce((a, b) => ({ ...a, [b.id]: b }), {});

// Do — each step named, each helper owned by lib/<feature>.mappers.ts or .helpers.ts
const validItems = filterValidItems(items);
const itemDetails = mapItemsToDetails(validItems);
return indexItemDetailsById(itemDetails);
```

```ts
// Don't — multi-clause security decision inline; unreadable and untestable
if (
  !user ||
  (article.status === ArticleStatus.Published &&
    !permissions.includes(Permission.Read)) ||
  tenant?.id !== article.tenantId
) {
  throw new Error('Forbidden'); // raw Error, no messageKey (rule 26)
}

// Do — named domain policy + typed AppError with messageKey
const canReadArticle = canUserReadArticle({
  user,
  article,
  permissions,
  tenant,
});
if (!canReadArticle) {
  throw new ForbiddenError(
    ARTICLE_FORBIDDEN_MESSAGE,
    ARTICLE_FORBIDDEN_MESSAGE_KEY,
  );
}
```

> **But do not extract when inline is genuinely clearer.** One obvious line does not need a helper; a single simple comparison does not need a policy file. Extract to improve clarity and ownership, not to manufacture tiny files with no meaning ([23 §5](./23-function-service-file-size-discipline.md)).

---

## 4. No clever TypeScript

TypeScript in IronNest must help humans. The mechanical catalog lives in [13-eslint-and-typescript.md](./13-eslint-and-typescript.md); this section owns the judgment call.

Avoid: unreadable conditional types; over-generic helpers; clever inferred return shapes; nested mapped types without necessity; complex overloads; broad `Record<string, unknown>`; type aliases that hide simple domain meaning; type-level programming without justification; unsafe or excessive `as` casts (`no-unnecessary-type-assertion` is already `error`); generic abstractions with one use.

Prefer: clear `interface` for object shapes (`consistent-type-definitions`); DTO classes per [05-dto-and-validation.md](./05-dto-and-validation.md); simple domain types in `model/`; explicit return types on public methods where they aid reading; small type guards and clear narrowing; readable generics only when genuinely reused.

> **The 30-second rule.** If a mid-level backend engineer cannot understand a type in 30 seconds, simplify it — or document in the PR why it must exist.

---

## 5. Checklist

- [ ] Simple Code Ladder run: reuse checked, native checked, direct version preferred (rule 43)
- [ ] Junior-readable: flow follows top to bottom, names state intent, no clever chains
- [ ] Senior-trustworthy: layers, validation, guards, bounds, and error mapping untouched or improved
- [ ] No nested ternaries, dense one-liners, or type gymnastics; complex conditions are named helpers
- [ ] No safety cut in the name of simplicity (every other rule still holds)
- [ ] Extracted only where it clarifies or removes duplication — no meaningless tiny files
- [ ] Gates green: `npm run lint` · `npm run typecheck` · `npm run test` · `npm run test:coverage` · `npm run build`

**Related:** [21-yagni-and-minimalism.md](./21-yagni-and-minimalism.md) · [22-reuse-before-creating.md](./22-reuse-before-creating.md) · [23-function-service-file-size-discipline.md](./23-function-service-file-size-discipline.md) · [24-team-readable-code-review.md](./24-team-readable-code-review.md) · [/skills/write-simple-readable-code.md](../skills/write-simple-readable-code.md) · [/skills/refactor-smart-code-to-boring-code.md](../skills/refactor-smart-code-to-boring-code.md) · [/context/simple-code-map.md](../context/simple-code-map.md) · [/memory/code-simplicity-decisions.md](../memory/code-simplicity-decisions.md)
