# Memory — Known Pitfalls

> Durable record of the recurring, transferable traps that bite NestJS backends in this workspace. Implements the canon in [/context/architecture-map.md](../context/architecture-map.md) and [/rules/00-non-negotiable-rules.md](../rules/00-non-negotiable-rules.md). **Decision:** check this list *before* writing code, and when a new recurring mistake appears, append it here in **Symptom / Cause / Fix** form. Keep entries abstract — no product specifics.

**Why this exists:** these mistakes survive code review because they compile, pass the happy path, and only fail under strict flags, concurrency, or production load. Writing them down once stops the team (and any AI agent) from re-discovering them per project.

**Project records:** _record project-specific incidents, their ticket IDs, and the commit that fixed each one here — keep this memory file abstract._

---

## A. Strict-TypeScript traps

### A1. `noUncheckedIndexedAccess` — indexed access is `T | undefined`

- **Symptom:** `arr[0]` / `map[key]` works in editors but `tsgo --noEmit` flags it; the value is possibly `undefined`.
- **Cause:** the flag is on (rule 1). Every index read widens to `T | undefined`, even when you "know" the key exists.
- **Fix:** narrow with a guard, `??` default, or `.at()` + check. Never reach for the non-null assertion `!` — it is banned (rule 7). See [13-eslint-and-typescript.md](../rules/13-eslint-and-typescript.md).

### A2. `exactOptionalPropertyTypes` rejects explicit `undefined`

- **Symptom:** building `{ actorId: maybeUndefined }` for a target typed `{ actorId?: string }` fails to compile.
- **Cause:** with the flag on, `{ k?: V }` means *absent or V*, **not** `V | undefined`. Assigning an explicit `undefined` is an error.
- **Fix:** conditionally spread the key — omit it instead of assigning `undefined`. Do **not** widen the field to `V | undefined`.

```ts
// Don't — assigns explicit undefined
const event = { type, actorId }; // actorId: string | undefined

// Do — omit the key when absent
const event = { type, ...(actorId === undefined ? {} : { actorId }) };
```

### A3. `Partial<T>` helpers re-introduce `undefined` at strict targets

- **Symptom:** a generic `stripUndefined(obj): Partial<T>` still fails to type-check when fed into an entity `.update()` or a filter DTO.
- **Cause:** `Partial<T>` only makes keys optional; the value types stay `V | undefined`, which `exactOptionalPropertyTypes` rejects.
- **Fix:** type the helper to strip `undefined` from the **value types**, e.g. `{ [K in keyof T]?: Exclude<T[K], undefined> }`. Only collapse **bare passthrough** values this way — `stripUndefined({ when: new Date(v) })` would still evaluate `new Date(undefined)` (an Invalid Date that is *not* stripped). Keep transformed values (`new Date(x)`, `x.trim()`, `x as Role`) as conditional spreads. See [06-types-enums-constants.md](../rules/06-types-enums-constants.md).

---

## B. Enum & comparison traps

### B1. Unsafe enum comparison against a raw literal

- **Symptom:** `entity.status === 'active'` either fails `no-unsafe-enum-comparison` or — worse — silently never matches after a refactor.
- **Cause:** `entity.status` is an enum member; comparing it to a hand-typed string is a magic-string comparison (rules 8, 9).
- **Fix:** compare against the enum member from `@shared/enums` or `model/<feature>.enums.ts` — `entity.status === AccountStatus.ACTIVE`. This is the single most-repeated mistake despite the zero-string-literals policy.

### B2. Non-exhaustive `switch` on an enum / union

- **Symptom:** adding a new enum member compiles fine, but a `switch` silently falls through to `default` or returns nothing.
- **Cause:** no exhaustiveness check; the compiler can't warn you a case is missing.
- **Fix:** handle every case and end with a `never` assertion in `default` (`switch-exhaustiveness-check` is an error). A new member then breaks the build until handled.

### B3. Redundant null guard after narrowing

- **Symptom:** `a !== null` after `typeof a === 'object'` (when `a: Record<string, unknown>`) is flagged by `no-unnecessary-condition`.
- **Cause:** belt-and-suspenders checks the type system already guarantees.
- **Fix:** trust the narrowing; remove the dead guard.

---

## C. Async, promises & fire-and-forget

### C1. Floating promise drops work and errors

- **Symptom:** a write or notification "sometimes doesn't happen"; no error surfaces.
- **Cause:** an un-awaited promise (`no-floating-promises` is an error). The result and any rejection are silently discarded.
- **Fix:** `await` it, or — for an intentional fire-and-forget side effect — `void` it **with its own internal try/catch + logger.error**. A bare `void doThing()` that can reject is still a bug.

### C2. A throwing event/notification handler blocks the originating workflow

- **Symptom:** a downstream notification failure rolls back or fails the primary action (e.g. the order saved but the request 500s).
- **Cause:** an `@OnEvent`/`IEventHandler.handle` that throws propagates back into the publish call on the domain success path.
- **Fix:** side effects are **fail-safe** (rule 38). Wrap dispatch in try/catch, `logger.error` the failure, never re-throw into the publisher. Post-commit events fire from the use case *after* the transaction commits. See [10-reliability-and-durability.md](../rules/10-reliability-and-durability.md) and [reliability-patterns.md](./reliability-patterns.md).

### C3. `await` inside a loop serializes independent work

- **Symptom:** a batch endpoint is N× slower than expected.
- **Cause:** awaiting each iteration of independent work in sequence.
- **Fix:** batch the independent calls. **But note:** `Promise.all|allSettled|any|race` are banned *inside service methods* by ESLint (`no-restricted-syntax`) — concurrency primitives belong in a use case or a dedicated `lib/` helper, never buried in a focused service. See [03-application-services-and-use-cases.md](../rules/03-application-services-and-use-cases.md).

### C4. Async override of a void-return signature swallows rejections

- **Symptom:** an overridden lifecycle/handler method's failure vanishes.
- **Cause:** marking an override `async` when the parent returns `void` detaches the promise.
- **Fix:** keep the signature `void`; call the async work with explicit `void this.doAsyncWork()` and handle errors inside it.

### C5. Naked `setTimeout` in a promise executor

- **Symptom:** `no-promise-executor-return` error.
- **Cause:** `new Promise(r => setTimeout(r, ms))` returns the timer handle from the executor.
- **Fix:** brace it — `new Promise<void>((resolve) => { setTimeout(resolve, ms); })`. Better, wrap delays/backoff in a named `lib/` helper.

---

## D. DI, scopes & module wiring

### D1. Request-scoped provider silently promotes its whole graph

- **Symptom:** unexpected per-request instantiation, lost in-memory caches, or `Scope.REQUEST` performance cliffs.
- **Cause:** marking one provider `Scope.REQUEST` bubbles request scope up to **every** provider that injects it (and their consumers).
- **Fix:** default to the singleton (default) scope. Reach for request scope only when you truly need per-request state, and document the blast radius. Prefer passing request context as a typed argument over scoping the provider.

### D2. Cross-module internal import instead of the public surface

- **Symptom:** a refactor in module A unexpectedly breaks module B; circular-dependency warnings appear.
- **Cause:** importing another module's `service`/`repository` directly instead of through its `index.ts` (rule 24).
- **Fix:** import only the module's public surface (`@modules/<feature>` → `index.ts`) or communicate via events. `shared/` imports only `shared/`. See [01-architecture-and-module-boundaries.md](../rules/01-architecture-and-module-boundaries.md).

### D3. Provider not exported / `forwardRef` masking a design smell

- **Symptom:** "Nest can't resolve dependencies" at boot, or a `forwardRef` chain that keeps growing.
- **Cause:** a needed provider isn't in the module's `exports`, or two modules depend on each other's internals.
- **Fix:** export the provider through the module surface; if you need `forwardRef`, treat it as a signal to move the shared concern into `core`/`shared` or invert it via an event. See [library-boundaries.md](./library-boundaries.md).

---

## E. Transactions & connection safety

### E1. Multi-entity write without a single transaction leaves inconsistent state

- **Symptom:** a partial failure leaves, e.g., the parent record updated but the dependent records stale.
- **Cause:** several writes issued as separate, un-transacted calls — exactly the trigger to escalate from a service to a **use case** (rule 22).
- **Fix:** wrap all mutations in one transaction inside the use case; mutate via the transaction's manager; fire side effects only **after commit**. Single-entity work stays an in-service transaction; multi-entity/multi-step work is a use case. See [create-use-case.md](../skills/create-use-case.md) and [reliability-patterns.md](./reliability-patterns.md).

### E2. Leaked pooled connection from a mis-ordered transaction

- **Symptom:** the connection pool exhausts under load; requests hang then time out.
- **Cause:** acquiring the connection / starting the transaction **outside** the `try`, so a failure skips the release; or calling rollback when no transaction is active, which throws and masks the original error.
- **Fix:** copy the leak-safe shape exactly — acquire **and** begin inside `try`, release in `finally`, guard rollback with an "is transaction active" check.

```ts
// Do — leak-safe shape (illustrative, ORM-agnostic)
const tx = this.uow.create();
try {
  await tx.connect();
  await tx.begin();
  await this.repo.save(entity, tx.manager);
  await tx.commit();
} catch (error) {
  if (tx.isActive) await tx.rollback();
  throw error;
} finally {
  await tx.release();
}
```

See [04-repositories-and-persistence.md](../rules/04-repositories-and-persistence.md) and [10-reliability-and-durability.md](../rules/10-reliability-and-durability.md).

---

## F. Persistence & query traps

### F1. N+1 queries from per-row lazy loads

- **Symptom:** a list endpoint issues one query per returned row; latency scales with result size.
- **Cause:** accessing a relation inside a loop instead of eager-joining or batch-loading it.
- **Fix:** load relations in one query (join / `IN (...)` batch / data-loader). Verify with query-count assertions, not eyeballing. See [09-performance-and-scalability.md](../rules/09-performance-and-scalability.md) and [performance-decisions.md](./performance-decisions.md).

### F2. Unbounded list query

- **Symptom:** an endpoint OOMs or stalls when a table grows.
- **Cause:** no pagination cap, or a controller hand-parsing `page`/`limit` and skipping the shared bound.
- **Fix:** every list query is parameterized and **bounded** (hard max 100, rule 37). Use the canonical pagination helper; never hand-roll `parseInt(query.page)` in a controller. See [04-repositories-and-persistence.md](../rules/04-repositories-and-persistence.md).

### F3. Raw value interpolated into a query

- **Symptom:** SQL injection risk; or breakage on quotes/unicode in input.
- **Cause:** string-building a query with user input instead of binding parameters (rule 31).
- **Fix:** always parameterize; keep raw access behind the repository. See [08-database-and-injection-safety.md](../rules/08-database-and-injection-safety.md) and [sql-injection-review.md](../skills/sql-injection-review.md).

---

## G. Validation & transport traps

### G1. `ValidationPipe` whitelist silently drops fields

- **Symptom:** a field the client sent is `undefined` in the handler; no error.
- **Cause:** the global `ValidationPipe` runs `whitelist: true`, which strips any property **not decorated** on the DTO. A missing/typo'd decorator means the field is silently removed.
- **Fix:** decorate every accepted field on the DTO. Use `forbidNonWhitelisted: true` when you want extras to 400 instead of being dropped. Validation lives in the DTO, never the service (rule 25). See [05-dto-and-validation.md](../rules/05-dto-and-validation.md).

### G2. `transform: true` doesn't coerce without the right decorators

- **Symptom:** a numeric/boolean/date query param arrives as a string; comparisons misbehave.
- **Cause:** `transform: true` only converts when `class-transformer` knows the target — primitives from query/params need an explicit `@Type(() => Number)` (or equivalent).
- **Fix:** type query/param DTOs with `@Type`/transform decorators; never trust ad-hoc `typeof x === 'string'` parsing in the controller.

### G3. Identity taken from the client body

- **Symptom:** privilege escalation / cross-tenant access via a forged `userId`/`tenantId` in the payload.
- **Cause:** reading the actor from the request body instead of the verified token.
- **Fix:** identity comes from the verified token via `@CurrentUser()`; chain auth guard + permissions guard + ownership/tenant check on every protected route (rules 33–35). See [07-security-authn-authz.md](../rules/07-security-authn-authz.md) and [security-decisions.md](./security-decisions.md).

---

## H. Config, logging & boundary leaks

### H1. `process.env` read outside config/bootstrap

- **Symptom:** a value is `undefined` in one environment; no startup failure.
- **Cause:** reading `process.env` inline in business code instead of typed config (rule 27).
- **Fix:** read validated, typed config via `@nestjs/config`; validate at startup and fail fast (rules 27, 29). See [17-configuration-and-environment.md](../rules/17-configuration-and-environment.md) and [add-config-value.md](../skills/add-config-value.md).

### H2. Error leaks stack/SQL/secret to the client

- **Symptom:** a 500 body contains a stack trace, SQL fragment, or vendor message.
- **Cause:** throwing a raw error instead of a typed `AppError`, or letting an adapter exception escape unmapped.
- **Fix:** throw a typed `AppError` with a `messageKey` of the form `errors.<feature>.<key>`; the global exception filter returns a sanitized body and logs full detail server-side (rules 26, 36). See [18-error-handling-and-exceptions.md](../rules/18-error-handling-and-exceptions.md) and [create-error.md](../skills/create-error.md).

### H3. Inline value constant in an implementation file

- **Symptom:** review keeps flagging a magic number/TTL/`messageKey`/jitter value at the top of a service.
- **Cause:** declaring a reusable value inline instead of in `*.constants.ts` (rule 13).
- **Fix:** move every named module-level value (TTLs, timeouts, retry/backoff/jitter, message keys, URLs, headers, limits) into the owning `*.constants.ts` and import it. The only permitted file-local literal is a `LOG_PREFIX`. **Before creating a new constants/util file, extend the existing owner** — a parallel duplicate fragments the source of truth and can ship a subtly-wrong shadow. See [06-types-enums-constants.md](../rules/06-types-enums-constants.md).

---

## I. Quality-gate & build traps

### I1. Project-wide typecheck fails on files you didn't touch

- **Symptom:** the pre-commit gate blocks your commit on errors in unrelated files.
- **Cause:** lint-staged scopes ESLint to staged files, but `npm run typecheck` (`tsgo --noEmit`) runs across the **whole** project.
- **Fix:** fix the pre-existing breakage as part of your change; never add a suppression or bypass with `--no-verify`. The check is `tsgo --noEmit` (Husky pre-commit = lint-staged + typecheck; pre-push = test:coverage + build). See [13-eslint-and-typescript.md](../rules/13-eslint-and-typescript.md) and [quality-gates.md](../testing/quality-gates.md).

### I2. Stale compiled `.js` next to `.ts` sources

- **Symptom:** a runtime/test picks up old behavior or "module not found".
- **Cause:** a stray emit into `src/`; glob loaders match both `.ts` and `.js`.
- **Fix:** build only into `dist/`; delete any stray `src/**/*.js`. Keep source-only globs source-only.

### I3. Decorator metadata injects uncoverable branches in entities

- **Symptom:** coverage dips below the 95% floor on decorated entity/DTO files for branches you can't reach.
- **Cause:** the transform emits synthetic `typeof X === 'undefined' ? Object : X` guards per decorated property.
- **Fix:** exclude pure type/enum/constant/entity-shape files from coverage; test the **real logic** (lifecycle hooks, mappers, policies) elsewhere. Don't chase synthetic branches. See [11-testing-and-coverage.md](../rules/11-testing-and-coverage.md), [coverage-policy.md](../testing/coverage-policy.md), and [testing-strategy.md](./testing-strategy.md).

---

## Checklist before writing code

- [ ] Narrowed every indexed/optional access — no `!` (A1, A2, A3)
- [ ] Enum comparisons use members; `switch` is exhaustive (B1, B2)
- [ ] No floating promises; side effects are fail-safe with try/catch (C1, C2)
- [ ] No concurrency primitives inside services (C3)
- [ ] No accidental request-scoped graph; cross-module imports via `index.ts` only (D1, D2)
- [ ] Multi-entity writes wrapped in one transaction; leak-safe acquire/release (E1, E2)
- [ ] No N+1, no unbounded list, no raw-value queries (F1, F2, F3)
- [ ] DTO decorates every field; identity from token not body (G1, G3)
- [ ] No `process.env` in business code; typed `AppError` with `messageKey`; no inline constants (H1, H2, H3)
- [ ] `lint` / `typecheck` / `test` / `test:coverage` / `build` green — never `--no-verify` (I1)

**Related:** [/rules/00-non-negotiable-rules.md](../rules/00-non-negotiable-rules.md) · [reliability-patterns.md](./reliability-patterns.md) · [performance-decisions.md](./performance-decisions.md) · [security-decisions.md](./security-decisions.md) · [testing-strategy.md](./testing-strategy.md) · [ai-context-map.md](./ai-context-map.md)
