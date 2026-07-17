# Skill: Remove Unnecessary Code

## Intent

Prove a surface is dead, then remove its code, wiring, exports, config, tests, and docs without deleting a safety control.

## When to use

Use for dead code, unused env/config, unused providers/helpers/adapters, and speculative abstractions with no current boundary.

## When not to use

Alive but convoluted code needs simplification; oversized code needs a focused split. A guard, bound, validator, error mapping, or fallback is not dead merely because references are indirect.

---

## Rules this skill enforces

- **Every abstraction earns its existence now.** No plugin systems, factories, buses, queues, or caches kept "for later" ([21 §1–2](../rules/21-yagni-and-minimalism.md), rule 44).
- **No unused DTO, config value, env var, adapter, provider, helper, or test ships** ([21 §1](../rules/21-yagni-and-minimalism.md)).
- **Speculative code is not free.** It burns reviewer time, AI context tokens, CI minutes, and future maintenance ([21 §5](../rules/21-yagni-and-minimalism.md)).
- **Minimalism never cuts safety.** DTO validation, auth/permission/ownership checks, `AppError`/`messageKey`, adapters, parameterized + bounded queries, tests, and docs always stay ([21 §4](../rules/21-yagni-and-minimalism.md), rule 46).
- **Docs and tests move with the deletion.** Removing a surface is a behavior change; artifacts update in the same change (rule 42, [24-team-readable-code-review.md](../rules/24-team-readable-code-review.md)).

---

## Step 1 — PROVE it is unused

"No references from my new code" is not proof. Run the full deadness search:

```bash
# Every call site — symbol, re-exports, specs
grep -rn "ArticleLegacyExporter" src/ test/
# DI wiring — providers arrays, module imports, custom tokens
grep -rn "ArticleLegacyExporter" src/modules/**/*.module.ts
# Dynamic access grep misses by symbol — search the STRING key too
grep -rn "article.legacyExport" src/ test/ .env.example
```

Check the three places a symbol grep lies:

- **DI wiring** — a provider registered in a module is live even with zero direct imports.
- **Dynamic lookups** — `config.get('article.legacyExport.batchSize')`, event names (`'article.archived'`), queue names, permission keys: grep the string literal, not just the symbol.
- **Test-only usage** — code referenced only by its own spec is still dead; the spec dies with it.

If any consumer is real, stop — the code is alive and this skill does not apply.

## Step 2 — Tests FIRST: sort keepers from dead tests

Before touching source, classify every test that touches the target:

- **Behavior tests on surviving neighbors** → keep; they are the safety net proving the deletion changed nothing observable.
- **Tests that exist only to exercise the dead code** → delete with it; a test for behavior that no longer exists is itself rule-44 waste.

Run the kept suite green **before** deleting, so a post-deletion failure means the deletion — not pre-existing rot.

## Step 3 — Remove the code AND its export surface

Delete the implementation, then every trace of its public surface — barrel entries, module `providers` arrays, DI tokens, index re-exports — in the same commit:

```ts
// Don't — delete the class, leave the barrel exporting a ghost
// src/modules/article/lib/index.ts
export * from './article.mapper';
export * from './article-legacy.exporter'; // ← module not found at build

// Do — barrel, providers array, and DI token all go with the file
// src/modules/article/lib/index.ts
export * from './article.mapper';
```

## Step 4 — Remove docs, env examples, and config validation

An unused config value dies in four places or it is not dead: the read site, the typed config schema/validation entry, `.env.example`, and the docs that describe it. Same discipline for events, permission keys, and adapter methods — update module docs and feature artifacts in this change, never a follow-up.

## Step 5 — Re-run the full gates, including coverage

Deletions can **drop coverage of neighbors** — the dead tests happened to exercise shared branches. Fix by testing the real behavior of the surviving code ([write-unit-tests.md](./write-unit-tests.md)) — never by padding data-only files or keeping dead tests as ballast.

## Step 6 — Security scan after dependency or config removals

If the deletion removed a dependency, an env var, or config wiring, run the scanner — removals can strand secrets in examples or shift the vulnerability surface:

```bash
npm run security:scan
```

## Step 7 — Record the decision

If the deletion reflects a durable choice ("no legacy article export", "no cache layer until three real call sites"), record it in [code-simplicity-decisions.md](../memory/code-simplicity-decisions.md) so the same abstraction is not rebuilt next quarter.

---

## Checklist

- [ ] Symbol, string key, DI, dynamic lookup, export, and test usage checked.
- [ ] Surviving behavior tests were green before deletion.
- [ ] Entire dead surface removed, including `.env.example` and docs.
- [ ] No validation/security/auth/ownership/bound/observability control removed.
- [ ] Decision recorded when it prevents speculative reintroduction.

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

- **Deleting a safety control mistaken for dead code.** A guard, a pagination bound, or a DTO validator can look unreferenced from the feature path yet be the only thing between a route and abuse ⇒ prove **semantic** deadness — the protection exists elsewhere or the protected surface is gone — not just "no references from new code" (rule 46).
- **Trusting grep on dynamic lookups.** `config.get('key')`, event names, queue names, and permission keys resolve at runtime ⇒ grep the string literals and check registration maps before declaring death.
- **Half-deletion.** Code gone but barrel entry, provider, `.env.example` line, or config schema left behind ⇒ broken build or a ghost key that misleads the next engineer — remove the whole surface (Steps 3–4).
- **Padding coverage after the drop.** Coverage fell because dead tests carried neighbors ⇒ write behavior tests for the survivors; never pad `*.types.ts`/DTO files or resurrect dead tests as ballast.
- **Deleting what had one real consumer you missed.** Production breaks on a path no test covered ⇒ Step 1 rigor; when in doubt, deprecate and log usage for a cycle before removing.
- **Skipping the decision record.** The same speculative abstraction gets rebuilt next sprint ⇒ one line in [code-simplicity-decisions.md](../memory/code-simplicity-decisions.md) is cheaper than a second review cycle.
- **Folding refactors into the deletion diff.** A mixed diff hides whether living code was touched ⇒ keep deletion diffs pure; route restructuring through [simplify-existing-code.md](./simplify-existing-code.md).

## Related

[simplify-existing-code.md](./simplify-existing-code.md) · [refactor-smart-code-to-boring-code.md](./refactor-smart-code-to-boring-code.md) · [write-simple-readable-code.md](./write-simple-readable-code.md) · [reuse-before-creating.md](./reuse-before-creating.md) · [decompose-large-file.md](./decompose-large-file.md) · [write-unit-tests.md](./write-unit-tests.md) · [final-validation.md](./final-validation.md) · [security-review.md](./security-review.md) · [../rules/21-yagni-and-minimalism.md](../rules/21-yagni-and-minimalism.md) · [../rules/20-simple-readable-code.md](../rules/20-simple-readable-code.md) · [../rules/22-reuse-before-creating.md](../rules/22-reuse-before-creating.md) · [../context/simple-code-map.md](../context/simple-code-map.md) · [../memory/code-simplicity-decisions.md](../memory/code-simplicity-decisions.md) · [../memory/known-pitfalls.md](../memory/known-pitfalls.md) · [README.md](./README.md)
