# Skill: Split a Large Use Case

> A use case that grew into god orchestration gets split **by responsibility seam**, never by line count: `execute()` stays a **table of contents** for the operation, decisions move to **pure domain** policies/state machines, shaping moves to **`lib/` mappers**, side-effect dispatch moves to a focused service — and the **transaction boundary stays explicit and visible** the entire time. Implements [23-function-service-file-size-discipline.md](../rules/23-function-service-file-size-discipline.md) (rule **46** of [00-non-negotiable-rules.md](../rules/00-non-negotiable-rules.md)) and the transaction + ordered post-commit canon of [03-application-services-and-use-cases.md](../rules/03-application-services-and-use-cases.md).

Use when a use case shows the symptoms: it owns decisions that should be pure domain code, repeated shaping or dispatch blocks appear, the transaction flow is hard to follow, or post-commit side effects mix with business decisions. When NOT this skill → an oversized service gets [split-large-service.md](./split-large-service.md), an oversized repository gets [split-large-repository.md](./split-large-repository.md), a mechanical file split at any layer is [decompose-large-file.md](./decompose-large-file.md), and promoting a service method into a _new_ use case is [create-use-case.md](./create-use-case.md).

---

## Rules this skill enforces

- **A use-case method is orchestration only** — it reads like a **table of contents**; decisions live in `domain/`, shaping in `lib/` ([23 §1–3](../rules/23-function-service-file-size-discipline.md), rule 46).
- **One operation, one visible transaction boundary** — opened via the `UnitOfWork` adapter; reads before, writes inside, events after ([03](../rules/03-application-services-and-use-cases.md)).
- **Ordered post-commit events.** Emit only after commit, in dependency order; each handler isolates its own failure (rule 38; [19-async-events-and-jobs.md](../rules/19-async-events-and-jobs.md)).
- **Terminal states stay explicit** — success/failure/timeout, operator-visible, no silent partial outcomes (rule 39; [10-reliability-and-durability.md](../rules/10-reliability-and-durability.md)).
- **No random splits.** Split at a responsibility seam; public behavior stays byte-for-byte stable ([23 §5](../rules/23-function-service-file-size-discipline.md)).
- **Minimal means minimum SAFE code.** The split never cuts DTO validation, auth/ownership checks, `AppError`/`messageKey`, adapters, parameterized/bounded queries, tests, or docs (rule 46).

---

## Step 1 — Characterization tests FIRST

Pin the current behavior before moving a line: every precondition path, each thrown error type **and** `messageKey`, the emitted-event set **and order**, and rollback behavior (mid-transaction failure ⇒ nothing persisted, nothing emitted). Extend the spec via [write-unit-tests.md](./write-unit-tests.md). The only intended change is structure — a green suite that stays green is the proof.

## Step 2 — Keep the table of contents in the use case

The high-level sequence stays in `execute()`. A reader must see the whole operation — guard → transaction → ordered post-commit events → typed result — without opening another file.

```ts
// application/publish-article.use-case.ts — execute() reads like a table of contents
async execute(input: PublishArticleInput): Promise<PublishArticleResult> {
  const article = await this.loadPublishableArticle(input); // guard: reads + policy, BEFORE the tx
  const result = await this.commitPublish(article, input);  // the ONE visible transaction boundary
  await this.dispatchPublishedEvents(result);               // ordered post-commit events, AFTER commit
  return toPublishArticleResult(result);                    // typed result via lib/ mapper
}
```

> **Await the dispatch, keep each handler fail-safe.** `dispatchPublishedEvents` is awaited so emission order is guaranteed and no promise floats (rule 38, [15 §5](../rules/15-review-checklist.md)); each _handler_ catches its own errors so a delivery failure never rolls the workflow back ([19-async-events-and-jobs.md](../rules/19-async-events-and-jobs.md)). "Fire-and-forget" describes the handler's failure isolation, never an unawaited call.

## Step 3 — Extract decisions to domain policies / state machines

Every business decision the use case accumulated becomes a pure function in `domain/` — testable without mocks. The use case hoists the reads through the **service's** `findByIdOrThrow` (→ `errors.article.notFound`), never a throwing repository method — a repository returns `null` and never owns error vocabulary ([04-repositories-and-persistence.md](../rules/04-repositories-and-persistence.md), rules 19–20). It then hands loaded state to the policy; the policy never touches a repository.

```ts
// Don't — decision buried in orchestration, raw string comparison
if (article.status === 'draft' && article.authorId === input.actorId && article.body.length > 0) { ... }

// Do — domain owns the decision (domain/article.policy.ts), enum-typed, throws a messageKey
this.articlePolicy.assertPublishable(article, input.actorId); // ArticleStatus.Draft → errors.article.notPublishable
```

State transitions route through the domain state machine — never re-derive `ArticleStatus` legality inline ([03](../rules/03-application-services-and-use-cases.md)).

## Step 4 — Extract shaping to `lib/` mappers

Payload building, row shaping, and formatting leave the use case for named functions with one owner.

```ts
// Don't — event payload assembled inline in the use case
this.events.emit(ArticleEvent.PUBLISHED, {
  id: a.id,
  slug: a.slug,
  at: new Date().toISOString(),
});

// Do — the mapper owns the shape (toArticlePublishedEvent lives in
// src/modules/article/lib/article.mappers.ts); the use case only emits
this.events.emit(
  ArticleEvent.PUBLISHED,
  toArticlePublishedEvent(result.article),
);
```

## Step 5 — Extract side-effect dispatch to a focused service if it grew

Two or three post-commit emits stay a private `dispatch*` helper. When dispatch grows its own logic — audiences, per-channel fallbacks, retry decisions — it becomes a focused `application/*.service.ts` the use case injects and calls **once**, after commit. Services never call back into use cases.

## Step 6 — Keep the transaction boundary explicit and visible

Exactly one `commit*`-named helper wraps `this.uow.runInTransaction(...)`, called exactly once from `execute()`. **Never bury a commit inside a helper named like a read or a calculation** — a hidden boundary is where reads and provider calls creep into the transaction and fail the commit.

## Step 7 — Keep terminal states explicit

The operation ends in a visible success, typed failure, or timeout (rules 38–39). Fire-and-forget dispatch catches and logs its own failures; anything the caller waits on returns a typed result or throws a typed `AppError` with a `messageKey` — no endless loading, no silent partial success.

## Step 8 — Log at milestones only

One structured line per milestone via the `@core/logger` adapter — operation succeeded, side effect failed, rollback happened — with correlating ids. Do not log every extracted step; noise buries the failure signal ([14-observability-and-logging.md](../rules/14-observability-and-logging.md)).

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

- **Splitting by line count instead of responsibility.** More files, same coupling, harder navigation ⇒ split only at the decision/shaping/dispatch seams of [23 §3](../rules/23-function-service-file-size-discipline.md).
- **Commit buried inside an innocently named helper.** Reviewers lose the boundary; reads and provider calls creep inside ⇒ one `commit*` helper, one call site in `execute()`.
- **Extracted policy that touches repositories.** The domain stops being pure and needs mocks to test ⇒ hoist reads in the use case, pass loaded state into the policy.
- **Events emitted from inside the transaction helper.** A later rollback leaves handlers acting on a ghost ⇒ emit only after `runInTransaction` returns, in dependency order.
- **A guard, ownership check, or `messageKey` dropped during the move.** Rule-46 violation, MUST FIX ⇒ the split is structural; every safety line survives verbatim.
- **Dispatch service calling back into the use case.** Dependency cycle that hides the transaction owner ⇒ one-way only: use case → service, never the reverse.
- **Behavior drift shipped as "refactor".** A changed event order or error type escapes silently ⇒ the Step 1 characterization tests fail loudly, or the split is wrong.

## Related

[create-use-case.md](./create-use-case.md) · [split-large-service.md](./split-large-service.md) · [split-large-repository.md](./split-large-repository.md) · [decompose-large-file.md](./decompose-large-file.md) · [extract-helper-safely.md](./extract-helper-safely.md) · [simplify-existing-code.md](./simplify-existing-code.md) · [write-unit-tests.md](./write-unit-tests.md) · [../rules/23-function-service-file-size-discipline.md](../rules/23-function-service-file-size-discipline.md) · [../rules/03-application-services-and-use-cases.md](../rules/03-application-services-and-use-cases.md) · [../rules/20-simple-readable-code.md](../rules/20-simple-readable-code.md) · [../context/architecture-map.md](../context/architecture-map.md) · [../memory/known-pitfalls.md](../memory/known-pitfalls.md) · [README.md](./README.md)
