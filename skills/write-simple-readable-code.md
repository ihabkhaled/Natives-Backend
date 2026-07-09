# Skill: Write Simple Readable Code

> The default writing posture for **every** feature, bug fix, refactor, adapter, repository, DTO/API, and test change: run the **Simple Code Ladder**, reuse the existing owner, write the boring direct version, and never cut a safety guarantee to save lines. Implements [20-simple-readable-code.md](../rules/20-simple-readable-code.md) (rules **43**, **46**) and the canon in [/context/architecture-map.md](../context/architecture-map.md) and [00-non-negotiable-rules.md](../rules/00-non-negotiable-rules.md).

This skill wraps around whichever authoring skill you are running ([create-service.md](./create-service.md), [create-use-case.md](./create-use-case.md), [create-repository.md](./create-repository.md), …). If you are cleaning up code that already exists, switch to [simplify-existing-code.md](./simplify-existing-code.md) or [refactor-smart-code-to-boring-code.md](./refactor-smart-code-to-boring-code.md).

---

## Rules this skill enforces

- **The Simple Code Ladder runs before new code.** need it → reuse → native → existing adapter → small helper → direct version → justified abstraction ([20 §2](../rules/20-simple-readable-code.md), rule 43).
- **Reuse before creating.** Search the owner first; never ship a parallel duplicate ([22-reuse-before-creating.md](../rules/22-reuse-before-creating.md), rule 45).
- **No speculative abstraction.** One use + no boundary reason ⇒ direct code ([21-yagni-and-minimalism.md](../rules/21-yagni-and-minimalism.md), rule 44).
- **Boring beats clever.** No nested ternaries, dense one-liners, or type gymnastics; complex conditions become named helpers ([20 §3–4](../rules/20-simple-readable-code.md), rule 46).
- **Minimal means minimum SAFE code.** DTO validation, guards, ownership checks, `AppError`/`messageKey`, adapters, bounds, tests, and docs always stay — no rule is tradeable for a smaller diff (rule 46).

---

## Step 1 — Read the touched flow, then the rules

Read the code you are about to change end to end (controller → application → domain → repository → adapter), the matching layer rule, and [/memory/known-pitfalls.md](../memory/known-pitfalls.md). The ladder never replaces investigation.

## Step 2 — Run the Simple Code Ladder

For each new piece of code you think you need:

1. Does it need to exist? If no — stop.
2. Does IronNest already have it? Run the owner search of [reuse-before-creating.md](./reuse-before-creating.md).
3. Does Node/TypeScript/NestJS already solve it? Use the native solution.
4. Does an approved dependency solve it through an existing adapter? Use the adapter.
5. Small pure helper? Put it with the correct owner (`lib/`, `domain/`, `model/`, `@shared/*`, `@core/*`).
6. Otherwise write the direct readable version.
7. A new abstraction needs a real current reason — repeated use, layer boundary, adapter, security isolation, transaction, testability.

## Step 3 — Tests FIRST

Write or extend the spec for the behavior before the implementation ([write-unit-tests.md](./write-unit-tests.md)). Keep the test readable too: scenario-stating names, minimal arrange blocks, mocks at the adapter/repository boundary only.

## Step 4 — Implement the smallest safe change

Keep each layer inside its budget ([23-function-service-file-size-discipline.md](../rules/23-function-service-file-size-discipline.md)): controller delegates once, use case orchestrates, service stays ≤ 20 lines/method, repository persists, domain decides.

```ts
// Don't — clever chain: three transformations, zero names
return orders
  ?.filter(Boolean)
  .map(o => o.line?.total)
  .reduce((a, b) => a + (b ?? 0), 0);

// Do — named steps a junior can follow
const validOrders = filterValidOrders(orders);
return sumOrderTotals(validOrders);
```

## Step 5 — Name complex conditions

A multi-clause boolean in a business decision becomes a named predicate in `domain/` or `lib/` — testable and readable. But leave a single obvious comparison inline; do not manufacture tiny files.

## Step 6 — Remove what the task does not need

Dead branches, unused params, leftover config, speculative hooks, comments explaining unclear code (fix the code instead). If you find pre-existing unnecessary code, remove it via [remove-unnecessary-code.md](./remove-unnecessary-code.md) or record a FOLLOW-UP.

## Step 7 — Docs in the same change

Update module docs, OpenAPI decorators, and the feature artifacts (rule 42). Then self-review against the nineteen questions of [24-team-readable-code-review.md](../rules/24-team-readable-code-review.md).

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

- **Simplicity used as a license to skip a guard or DTO.** That is a rule-46 violation and a MUST FIX — minimal means minimum _safe_ code.
- **Extraction as fashion.** Splitting a 6-line method into three files makes it less readable ⇒ extract only for clarity, duplication, or ownership ([23 §5](../rules/23-function-service-file-size-discipline.md)).
- **A "clearer" parallel helper instead of extending the owner.** Now two sources of truth drift ⇒ rule 45 violation; extend or refactor the owner ([22](../rules/22-reuse-before-creating.md)).
- **Comments papering over cryptic code.** Rename and restructure until the comment is unnecessary.
- **Clever types to avoid a simple interface.** The 30-second rule applies ([20 §4](../rules/20-simple-readable-code.md)).
- **Skipping the ladder because the change is "tiny".** Tiny changes duplicate owners too — the search is cheap.

## Related

[reuse-before-creating.md](./reuse-before-creating.md) · [simplify-existing-code.md](./simplify-existing-code.md) · [extract-helper-safely.md](./extract-helper-safely.md) · [review-for-readable-code.md](./review-for-readable-code.md) · [remove-unnecessary-code.md](./remove-unnecessary-code.md) · [refactor-smart-code-to-boring-code.md](./refactor-smart-code-to-boring-code.md) · [../rules/20-simple-readable-code.md](../rules/20-simple-readable-code.md) · [../rules/21-yagni-and-minimalism.md](../rules/21-yagni-and-minimalism.md) · [../context/simple-code-map.md](../context/simple-code-map.md) · [README.md](./README.md)
