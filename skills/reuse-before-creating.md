# Skill: Reuse Before Creating

> Run the **owner search** before adding **any** new file, helper, constant, DTO, enum, error, adapter, service, use case, repository, or test fixture: **search → extend → refactor → create**, in that order, and **never ship a parallel duplicate**. Implements [22-reuse-before-creating.md](../rules/22-reuse-before-creating.md) (rule **45** of [00-non-negotiable-rules.md](../rules/00-non-negotiable-rules.md)).

This skill is step 2 of the Simple Code Ladder and wraps every authoring skill ([create-service.md](./create-service.md), [create-use-case.md](./create-use-case.md), [create-repository.md](./create-repository.md)). It decides **where code lives**, not how it reads — for the writing posture use [write-simple-readable-code.md](./write-simple-readable-code.md); to clean an owner you already found, use [simplify-existing-code.md](./simplify-existing-code.md); to pull logic out of one, use [extract-helper-safely.md](./extract-helper-safely.md).

---

## Rules this skill enforces

- **Search the owner first.** Every new file, helper, constant, DTO, enum, adapter, or fixture is preceded by the mandatory search ([22 §1](../rules/22-reuse-before-creating.md), rule 45).
- **Never duplicate.** A second constant, enum, message key, validator, query helper, error mapping, or permission check is a defect even if it works ([22 §2](../rules/22-reuse-before-creating.md), [06 §6](../rules/06-types-enums-constants.md)).
- **Wrong owner ⇒ refactor, not fork.** A misplaced or misshapen owner is fixed in place, tests first ([22 §3](../rules/22-reuse-before-creating.md)).
- **Public surfaces only.** New exports go through the owner's `index.ts` barrel — no deep imports into another module's internals ([01](../rules/01-architecture-and-module-boundaries.md)).
- **Reuse never cuts safety.** DTO validation, auth/permission/ownership checks, `AppError`/`messageKey`, adapters, parameterized/bounded queries, tests, and docs always stay (rule 46, [20](../rules/20-simple-readable-code.md)).

---

## Step 1 — Search the current module

Start in the feature module you are touching: `model/` (`*.types.ts`, `*.enums.ts`, `*.constants.ts`), `lib/` (mappers, formatters, pure helpers), `domain/` (policies, invariants), `api/dto/` (request/response shapes). Most "missing" helpers already exist one directory away.

```bash
# Owner search — run before creating anything. Swap "articles" for your module.
rg -i "ArticleStatus|article.*status" src/modules/articles/model src/modules/articles/domain
rg -i "errors\.article|notFound"      src/modules/articles/model src/core/errors
rg -il "slugify|toSlug"               src/shared src/modules/*/lib
rg -l  "PaginationQuery|PageQueryDto" src/shared src/modules/*/api/dto
rg --files -g "*.fixture.ts" -g "*builder*" src test
```

> Search `src/shared` as a whole — it currently holds only `constants/` and `enums/`; `types/` and `utils/` appear when a concern first needs them ([architecture-map.md](../context/architecture-map.md)).

## Step 2 — Search `src/core`

Cross-cutting infrastructure lives here — today: `logger`, `errors` (+ the global exception filter), `validation`, `openapi`, `clock`, `id-generator`, `health`, `rate-limit` ([22 §1](../rules/22-reuse-before-creating.md)). Guards, interceptors, and pipes live in `@core/*` once they are cross-cutting, and in the owning module until then (the reference app keeps its auth guards in `src/modules/auth`). If the concern is cross-cutting, its owner is in `@core/*` — never a module-local re-implementation.

## Step 3 — Search `src/shared`

Cross-module constants, enums, types, and utils. The reference app ships `src/shared/constants` and `src/shared/enums`; `src/shared/types` and `src/shared/utils` are created on first real need, not up front (rule 44). A value two modules need already belongs here.

## Step 4 — Search related feature modules

Sibling modules solve sibling problems — pagination, filtering, status machines, ownership checks. Route via [codebase-navigation.md](../context/codebase-navigation.md). If a sibling owns what you need privately, that is a **promotion to `@shared/*`**, not a copy.

## Step 5 — Search existing tests and fixtures

Check colocated `*.spec.ts` arrange blocks, builders, and `test/` fixtures before writing new ones. One mock surface per dependency ([12](../rules/12-library-wrapping-and-adapters.md)) — reuse the existing double instead of hand-rolling another.

## Step 6 — Search the reference patterns

[context/reference-patterns.md](../context/reference-patterns.md) holds the canonical shape for each artifact kind. If you are about to invent a structure, the approved one is probably already documented there — copy it.

## Step 7 — Check known pitfalls

Read [memory/known-pitfalls.md](../memory/known-pitfalls.md) for the area you are touching. Duplicates recorded there have burned this codebase before; do not reintroduce one.

## Step 8 — Correct owner found? Extend it

Extend the owner's **spec first**, then the owner, then export through its existing public surface. Do not build a "cleaner" twin next door — two sources of truth drift.

```ts
// Don't — src/modules/feed/model/feed.enums.ts
export enum FeedArticleState {
  Draft = 'draft',
  Live = 'published',
} // drifts from ArticleStatus

// Do — src/modules/article/model/article.enums.ts (the single owner, extended)
export enum ArticleStatus {
  Draft = 'draft',
  Published = 'published',
  Archived = 'archived',
}
```

The same goes for errors: throw the owned catalog entry (`errors.article.notFound` from `model/article.constants.ts` via `AppError`), never a fresh inline string.

## Step 9 — Wrong shape or home? Characterization tests FIRST, then refactor the owner

A misplaced owner does **not** authorize a parallel file. Pin current behavior with characterization tests ([write-unit-tests.md](./write-unit-tests.md)), refactor the owner in place ([decompose-large-file.md](./decompose-large-file.md)), rewire imports through public surfaces, and update module docs and memory in the same change. **Wrong home ≠ valid home — but two homes is always worse.**

```ts
// Don't — src/modules/article/lib/article-view.helpers.ts
// a "better" duplicate of mapping logic still buried in article.service.ts

// Do — src/modules/article/lib/article.mappers.ts (logic moved to its correct owner, tests pinned first)
export function toArticleResponse(article: Article): ArticleResponseDto {
  /* … */
}
```

## Step 10 — No owner exists? Create exactly one

Only now create: **one** descriptively named file in the correct layer home (`model/`, `lib/`, `domain/`, `api/dto/`, `adapters/`, `@shared/*`, `@core/*`) — no `utils.ts` dumping ground ([23](../rules/23-function-service-file-size-discipline.md)). Export it through the right public surface, ship its tests and docs in the same change, and write it with [write-simple-readable-code.md](./write-simple-readable-code.md).

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

- **Duplicate constant, enum, or message key.** Two sources of truth drift silently ⇒ delete the copy, import the owner, add the missing export.
- **Forked validator, query helper, or error mapping.** Behavior diverges per module and bugs get fixed in only one ⇒ extend the single owner (§2 of [22](../rules/22-reuse-before-creating.md)).
- **Duplicated permission/ownership logic — the worst duplicate.** A subtly wrong copy ships a security hole ⇒ security logic has one owner, always; a fork is a MUST FIX.
- **New export missing from the owner's `index.ts`.** Consumers deep-import internals and the boundary lint fires ⇒ export through the public surface and fix every import.
- **Refactored owner, stale tests and docs.** The next reader trusts the wrong description ⇒ characterization tests and docs move with the code in the same change.
- **"The owner is misplaced, so I'll make a new one."** Wrong home ≠ valid home — but two homes is worse ⇒ refactor the owner (Step 9).
- **Search skipped because the change is "tiny".** Tiny changes duplicate owners too ⇒ the search is five `rg` commands; run it every time.

## Related

[write-simple-readable-code.md](./write-simple-readable-code.md) · [extract-helper-safely.md](./extract-helper-safely.md) · [simplify-existing-code.md](./simplify-existing-code.md) · [decompose-large-file.md](./decompose-large-file.md) · [remove-unnecessary-code.md](./remove-unnecessary-code.md) · [write-unit-tests.md](./write-unit-tests.md) · [../rules/22-reuse-before-creating.md](../rules/22-reuse-before-creating.md) · [../rules/20-simple-readable-code.md](../rules/20-simple-readable-code.md) · [../rules/21-yagni-and-minimalism.md](../rules/21-yagni-and-minimalism.md) · [../context/reference-patterns.md](../context/reference-patterns.md) · [../context/codebase-navigation.md](../context/codebase-navigation.md) · [../memory/known-pitfalls.md](../memory/known-pitfalls.md) · [README.md](./README.md)
