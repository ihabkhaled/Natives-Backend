# Skill: Investigate a Production Bug

> Reproduce a reported bug as a **failing test first**, then locate it in the correct layer, fix it with the smallest safe change, root-cause it, and lock it in with regression coverage. Implements the canon in [/context/architecture-map.md](../context/architecture-map.md) and [00-non-negotiable-rules.md](../rules/00-non-negotiable-rules.md).

A bug without a red test is unconfirmed; a fix without a regression test is unfinished. Move down the layers — Controller → Application → Domain → Persistence → Integration — and fix at the layer that actually owns the defect, never the symptom layer.

---

## Rules this skill enforces

- **Reproduce before you fix.** Confirm with a failing automated test, not a manual click-through.
- **Fix in the correct layer.** Symptom in the controller is usually a defect in a service, domain policy, repository, or adapter. Don't patch the boundary.
- **Smallest safe change.** No opportunistic refactors, dependency churn, or formatting noise in a bug-fix branch.
- **Preserve contracts.** Keep API/event/DB contracts stable unless the contract _is_ the bug — then update DTOs, tests, and docs together.
- **Every new failure path is a typed `AppError`** carrying `errors.<feature>.<key>`, mapped by the global exception filter — never leak stacks/SQL/secrets ([create-error.md](./create-error.md), [18-error-handling-and-exceptions.md](../rules/18-error-handling-and-exceptions.md)).
- **No diagnostic debt.** No `console.*` (use `@core/logger`), no `process.env` reads to "check a value", no `eslint-disable` to silence the fix.
- **Behavior change ⇒ tests + docs in the same change** ([11-testing-and-coverage.md](../rules/11-testing-and-coverage.md)).

---

## Step 1 — Tests FIRST: reproduce as a red test

Before reading much code, capture the report (inputs, identity, expected vs. actual, status code, correlation id) and encode it as the **smallest failing test** at the right layer. Pick the layer the bug lives in: a unit test for domain/service logic, an integration test if it spans repository/DB, an e2e test if it only reproduces through the full HTTP chain. This test is your definition of done — it must be red now and green at the end.

```ts
// Reproduce the reported defect: a soft-deleted Account is still returned.
it('excludes soft-deleted accounts from the owner listing (bug #1234)', async () => {
  const owner = await seedAccount({ ownerId, status: AccountStatus.Active });
  await softDeleteAccount(owner.id);

  const result = await service.listForOwner(ownerId, { limit: 20 });

  expect(result.items).toHaveLength(0); // currently returns 1 — RED
});
```

Do not weaken the assertion to make it pass. The assertion encodes correct behavior.

## Step 2 — Trace the path top-down

Follow the request through the layers to find every place the defect could live. Use [codebase-navigation.md](../context/codebase-navigation.md) to jump to the entry files.

```
HTTP route
  → Guard(s)        auth → permissions (core/auth) → ownership/tenant (application/domain)
  → ValidationPipe  is the DTO accepting bad input?                api/dto
  → Controller      thin delegation — almost never the bug         api/*.controller.ts
  → Use case/Service orchestration, transaction boundary           application/*
  → Domain          policy / state-machine / invariant             domain/*
  → Repository      query shape, filter, bound, parameterization   infrastructure/*.repository.ts
  → Adapter         external SDK / network / timeout               adapters/*.adapter.ts
```

Classify the defect into exactly one layer before touching code:

| Symptom                               | Likely owning layer                      | Look at                                                                                                  |
| ------------------------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Bad/missing input accepted            | DTO / validation                         | `api/dto/`, [05-dto-and-validation.md](../rules/05-dto-and-validation.md)                                |
| Wrong status / business outcome       | Domain policy / state machine            | `domain/`, [03-application-services-and-use-cases.md](../rules/03-application-services-and-use-cases.md) |
| Forbidden access / cross-tenant leak  | Auth/permission guard + ownership scope  | `core/auth/` + application/repository, [07-security-authn-authz.md](../rules/07-security-authn-authz.md) |
| Wrong/leaking/unbounded data          | Repository query                         | `infrastructure/`, [04-repositories-and-persistence.md](../rules/04-repositories-and-persistence.md)     |
| Slow / N+1 / timeout                  | Repository / service batching            | [09-performance-and-scalability.md](../rules/09-performance-and-scalability.md)                          |
| External call fails / crashes process | Adapter resilience                       | `adapters/`, [10-reliability-and-durability.md](../rules/10-reliability-and-durability.md)               |
| Partial write / lost event            | Use-case transaction / post-commit event | [19-async-events-and-jobs.md](../rules/19-async-events-and-jobs.md)                                      |

## Step 3 — Check known traps before deep debugging

Scan [known-pitfalls.md](../memory/known-pitfalls.md) first — most "mysterious" bugs are a recorded trap: `exactOptionalPropertyTypes` rejecting `undefined`, `noUncheckedIndexedAccess` after an array access, enum-vs-string comparison drift, JSON/embedded-doc casts, a fire-and-forget handler swallowing the error you're chasing, or an event subscribed twice. If the cause turns out to be a recurring trap, you'll record it in Step 7.

## Step 4 — Read logs and observability — never add `console.log`

Confirm the failure from structured logs and traces via the correlation id, using the logger adapter only. If you need temporary instrumentation, add a real `logger.debug(...)` with a `LOG_PREFIX`, then remove it before commit. Verify any value you log is redacted — a fix must never start leaking secrets/PII ([14-observability-and-logging.md](../rules/14-observability-and-logging.md)).

```ts
// Don't — console, leaks identity, never ships behind a flag
console.log('account', account, process.env.DB_URL);
```

```ts
// Do — adapter, scoped, redacted, removed before commit
this.logger.debug('listForOwner result', {
  ownerId,
  count: result.items.length,
});
```

## Step 5 — Fix in the owning layer, smallest safe change

Patch where the defect lives, not where it surfaced. In the soft-delete example the controller and service are correct — the repository query was unbounded by `status`.

```ts
// Don't — patch the symptom in the service by re-filtering after the fact
async listForOwner(ownerId: string, query: ListQuery): Promise<AccountList> {
  const page = await this.repository.findByOwner(ownerId, query);
  page.items = page.items.filter((a) => a.status !== 'deleted'); // magic string + N+1 + wrong layer
  return page;
}
```

```ts
// Do — fix the repository query that owns the data contract
async findActiveByOwner(ownerId: string, query: PageQuery): Promise<Page<Account>> {
  return this.queryByOwner(ownerId)
    .where('status != :status', { status: AccountStatus.Deleted }) // parameterized, enum member
    .take(clampLimit(query.limit)) // bounded, hard max 100
    .getManyAndCount()
    .then(toPage);
}
```

- Compare enum fields against enum members, never raw literals (rule 9).
- Keep service methods ≤ 20 lines and orchestration-only; extract any new branching into `domain/` or `lib/`.
- New failure branch ⇒ a distinct keyed `AppError` plus a translation for each supported locale ([add-i18n-message-key.md](./add-i18n-message-key.md)).

## Step 6 — Root-cause, then turn red green

Ask _why the test exists could pass while production failed_ — the root cause is usually a missing test boundary, not just a wrong line. Make the Step 1 test pass, then add **adjacent regression tests** for the sibling cases that share the defect (the other call site, the boundary value, the cross-tenant variant), so the bug class can't return through a different door.

```ts
it('also excludes soft-deleted accounts from the search path', async () => {
  /* sibling call site that shared the unbounded query */
});
it('still returns active accounts unchanged', async () => {
  /* prove the fix did not over-correct */
});
```

If the contract itself was wrong (e.g., the endpoint should never have returned deleted rows), update the DTO/response shape, the integration/e2e test, and the API docs in the same change.

## Step 7 — Capture the learning

If the cause was a recurring trap or a non-obvious layer interaction, append it to [known-pitfalls.md](../memory/known-pitfalls.md) as a durable, abstract entry (symptom → root cause → guard), so the next investigator finds it in Step 3. Update the feature folder under [/docs/features/_template/](../docs/features/_template/) with the defect log entry.

---

## Quality gates

```bash
npm run lint            # 0 errors AND 0 warnings (incl. architecture/* + max-lines-per-function)
npm run typecheck       # tsc --noEmit (TypeScript 7), project-wide
npm run test            # vitest — the reproducing test is now GREEN
npm run test:coverage   # touched-module floor 95%, the fixed path near 100%
npm run build           # compiles clean
```

Run integration/e2e suites if routes, DB, or integrations were touched. Never bypass Husky with `--no-verify` — a fix that can't pass the gates isn't a fix.

## Pitfalls

- **Fixing the symptom layer.** Re-filtering in the service/controller when the repository query is the real defect just hides the bug and adds an N+1.
- **No red test first.** "I can't reproduce it" later becomes "I can't prove it's fixed." Always capture a failing test before changing code.
- **Weakening the assertion to go green.** That ships the bug with a green check. Fix the code, not the test.
- **Over-correcting.** Always add a test proving the _happy path still works_; a one-sided fix breaks valid cases.
- **Untyped `throw` / `NotFoundException()`** for a new failure path — every branch needs a keyed `AppError` or it leaks unsafely.
- **Leaving debug instrumentation in.** Stray `console.*`, `process.env` peeks, or `logger.debug` dumps of PII fail review and rules 27–28.
- **Refactor creep.** Unrelated cleanup in a bug-fix branch obscures the actual change and the blast radius.
- **Forgetting the sibling call sites.** The same unbounded query/missing guard usually exists in 2–3 places — regress-cover all of them.

## Related

[write-unit-tests.md](./write-unit-tests.md) · [write-integration-tests.md](./write-integration-tests.md) · [write-e2e-tests.md](./write-e2e-tests.md) · [fix-eslint-typecheck.md](./fix-eslint-typecheck.md) · [create-error.md](./create-error.md) · [decompose-large-file.md](./decompose-large-file.md) · [reliability-review.md](./reliability-review.md) · [observability-review.md](./observability-review.md) · [sql-injection-review.md](./sql-injection-review.md) · [final-validation.md](./final-validation.md) · [known-pitfalls.md](../memory/known-pitfalls.md) · [README](./README.md)
