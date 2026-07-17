# Skill: Extract a Helper Safely

## Intent

Give repeated or meaningful hard-to-scan logic one named, typed, test-backed owner without hiding side effects or architecture violations.

## When to use

Use for two-to-three real call sites, a named security/business decision, a meaningful mapper/validator, or an extraction required by a layer budget.

## When not to use

Do not wrap one obvious line, hide I/O/vendor access, or split a whole oversized file; use the matching split/cleanup skill.

---

## Rules this skill enforces

- **One owner per rule.** If a change would require editing the same logic in many places, the logic belongs in one owner — that is the extraction test, not line-count fashion ([23 §4](../rules/23-function-service-file-size-discipline.md)).
- **The 1–2–3 rule.** One use + no boundary reason ⇒ keep it direct; two ⇒ consider; three ⇒ extract. Security, auth, ownership, and error mapping extract early ([21 §3](../rules/21-yagni-and-minimalism.md)).
- **Reuse before creating.** Search for the existing owner first; a parallel duplicate is a defect even if it works ([22](../rules/22-reuse-before-creating.md), rule 45).
- **Helpers meet the §4 bar.** Verb-based name, one responsibility, purity where possible, typed I/O, correct owner folder, no circular imports, exports only where needed ([23 §4](../rules/23-function-service-file-size-discipline.md)).
- **Simplicity never cuts safety.** Extraction must not drop DTO validation, auth/permission/ownership checks, `AppError`/`messageKey`, adapters, parameterized/bounded queries, tests, or docs (rule 46, [21 §4](../rules/21-yagni-and-minimalism.md)).

---

## Step 1 — Confirm the helper is needed

Apply the 1–2–3 rule of [21-yagni-and-minimalism.md](../rules/21-yagni-and-minimalism.md): **one use + no boundary reason ⇒ keep it direct** and stop here. Do **NOT** extract:

- one obvious line — the call would be longer than the logic
- a one-time trivial expression that will never repeat
- a helper that hides a side effect or an architecture violation — a "helper" calling a vendor SDK is an adapter dodge
- a helper that would create a circular import

## Step 2 — Search for an existing owner

Run the owner search of [reuse-before-creating.md](./reuse-before-creating.md) before creating anything: the module's `lib/`, `domain/`, `model/`, then `@shared/*` and `@core/*`. Found one ⇒ extend it. Found a misplaced one ⇒ refactor it in place — two homes is always worse than one wrong home being fixed ([22 §3](../rules/22-reuse-before-creating.md)).

## Step 3 — Choose the correct owner folder

| Logic                                  | Owner                                                      |
| -------------------------------------- | ---------------------------------------------------------- |
| Pure shaping / mapping / formatting    | `lib/` (`*.mappers.ts`, `*.formatters.ts`, `*.helpers.ts`) |
| Business decision / invariant / guard  | `domain/` (`*.policy.ts`)                                  |
| Constants / types / enums it relies on | `model/`                                                   |
| Consumed by more than one module       | `@shared/*`, through its public surface                    |

## Step 4 — Name it by intent

Verb-based and intention-revealing: `toArticleResponse`, `applyPublish`, `buildArticleQueryOptions`. Predicates read like questions: `canUserReadArticle`, `isTerminalStatus`. If you cannot name it precisely, the seam is wrong → return to Step 1.

## Step 5 — Tests FIRST

When the helper owns meaningful logic (a decision, a branchy mapping, a bound), write its spec before its body ([write-unit-tests.md](./write-unit-tests.md)). The existing call-site specs stay green and untouched — they are the characterization net proving behavior did not change.

## Step 6 — Write it pure, typed, and honest

Typed input → typed output, no hidden side effects, no `process.env`, no I/O. A helper that needs a repository or an adapter is not a helper — it is a service method.

```ts
// Don't — generic dumping ground: name says nothing, owner is nobody
// src/modules/article/utils.ts
export function doStuff(a: any): any {
  return {
    id: a.id,
    slug: a.slug,
    status: a.status === 'published' ? 'live' : a.status,
  };
}

// Do — one named owner, typed I/O, enum members, pure
// src/modules/article/lib/article.mappers.ts
export const toArticleResponse = (article: Article): ArticleResponseDto => ({
  id: article.id,
  slug: article.slug,
  status: article.status, // ArticleStatus from model/article.enums.ts
});
```

A guard extracted to `domain/` keeps its typed `AppError` and `messageKey` (`errors.article.notFound`) — extraction never downgrades an error.

## Step 7 — Replace every call site

Delete every duplicate in the same change — a half-migration leaves two owners drifting, the exact defect extraction exists to prevent. Grep for the old expression before committing.

## Step 8 — Export through the needed public surface only

Module-local helpers stay out of the barrel; cross-module consumers import through `index.ts` / `@shared` public surfaces, never deep paths (rule 24). Confirm no cycle appeared between `lib/`, `domain/`, and `model/`. `import-x/no-cycle` runs with `maxDepth: 1`, so lint catches only **direct** two-file cycles — a longer chain (`lib` → `domain` → `model` → `lib`) passes lint and must be checked by reading the imports.

---

## Checklist

- [ ] Current need and existing owner confirmed.
- [ ] Correct `lib`/`domain`/`shared`/`core` owner selected.
- [ ] Meaningful logic tested first; helper is typed and pure where possible.
- [ ] Every duplicate call site migrated and old logic deleted.
- [ ] No cycle, hidden side effect, or safety regression.

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

- **`utils.ts` grows a `doStuff`.** Nobody can find or trust it ⇒ name the file by ownership (`lib/article.mappers.ts`) and the function by intent.
- **Extraction that hides a side effect.** Callers assume purity and invoke it inside maps and loops ⇒ keep helpers pure; side effects live in services and adapters.
- **A helper "cleans up" an architecture violation.** Wrapping a vendor call in `lib/` only relocates the leak ⇒ route it through an adapter instead.
- **Half-migrated call sites.** Two owners drift and one ships the stale rule ⇒ replace every call site in the same change, then grep to prove it.
- **Extracting a one-liner.** More files, same logic, worse navigation ⇒ apply the 1–2–3 rule; leave the obvious line inline.
- **Dropping a guard or `messageKey` during the move.** A rule-46 MUST FIX ⇒ diff the behavior, not just the lines; simplicity never cuts safety.
- **New cycle between `lib/` and `domain/`.** The build breaks or import order becomes load-bearing ⇒ move the shared shape to `model/` and re-point both.

## Related

[reuse-before-creating.md](./reuse-before-creating.md) · [write-simple-readable-code.md](./write-simple-readable-code.md) · [simplify-existing-code.md](./simplify-existing-code.md) · [decompose-large-file.md](./decompose-large-file.md) · [split-large-service.md](./split-large-service.md) · [write-unit-tests.md](./write-unit-tests.md) · [../rules/23-function-service-file-size-discipline.md](../rules/23-function-service-file-size-discipline.md) · [../rules/22-reuse-before-creating.md](../rules/22-reuse-before-creating.md) · [../rules/21-yagni-and-minimalism.md](../rules/21-yagni-and-minimalism.md) · [../context/simple-code-map.md](../context/simple-code-map.md) · [../memory/known-pitfalls.md](../memory/known-pitfalls.md) · [README.md](./README.md)
