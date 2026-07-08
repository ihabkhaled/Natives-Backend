# Testing Strategy

> The house test strategy for a NestJS backend: the pyramid, what each layer proves, the environments and data they run against, and the evidence a change must leave behind. This implements the testing canon — [/rules/11-testing-and-coverage.md](../rules/11-testing-and-coverage.md), [/rules/00-non-negotiable-rules.md](../rules/00-non-negotiable-rules.md), and [/context/stack-and-toolchain.md](../context/stack-and-toolchain.md) — and aligns with the layered architecture in [/context/architecture-map.md](../context/architecture-map.md). Runner: **Vitest 4** + **@nestjs/testing** + **supertest**. Never Jest, ts-jest, or `jest.*`.

A green build is not proof of correctness. A passing happy path is not proof of correctness. Behavior is proven by tests at the **right layer**, with the **right boundary doubled**, across happy, unhappy, boundary, and security paths.

---

## 1. The test pyramid

Many fast unit tests at the base; a moderate band of integration tests through the real Nest pipeline; a thin cap of end-to-end tests for the flows that would hurt most if they broke. Push every assertion to the **lowest layer that can prove it** — only escalate when the proof genuinely needs more wiring.

```
            /‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾\
           /   E2E (few)     \      supertest + wired app, real test DB — critical flows
          /‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾\
         /  Integration (some) \    supertest + @nestjs/testing — controller pipeline
        /‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾\
       /     Unit (many)         \  Vitest + vi doubles — one class in isolation
      /‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾\
```

| Layer           | Subject                                                                                                    | Tooling                                                       | Speed / count     | Required when                                                              |
| --------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ----------------- | -------------------------------------------------------------------------- |
| **Unit**        | One class in isolation — service, use-case, domain policy, mapper, guard, pipe, adapter wrapper, DTO       | `Test.createTestingModule` + `vi` doubles                     | Fast / many       | Every change                                                               |
| **Integration** | A controller through the **real** request pipeline (DTO → `ValidationPipe` → guards → handler → app layer) | `@nestjs/testing` app + **supertest**                         | Medium / moderate | Routes, validation, guards, or repository contracts change                 |
| **E2E**         | A full workflow across modules/routes, end to end                                                          | supertest against a wired app, persistence in a test instance | Slow / few        | Critical flows: auth, ownership/tenant, multi-step transactional use-cases |

> **Anti-pattern: the ice-cream cone.** A few slow, flaky E2E tests bolted onto thin unit coverage. Invert it. If a rule is a pure domain decision, prove it with a domain unit test — not a six-hop E2E.

---

## 2. What each layer proves

### Unit — logic in isolation

The base of the pyramid. The subject is real; every collaborator is a double. Mock at the **boundary**, never the subject.

| Subject        | Proves                                                                                                                                                                                                                                              |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Controller** | Forwards parsed input + verified identity to exactly one application method and returns the result **untransformed** (it has no logic to prove — see [/rules/02-controllers-and-http-transport.md](../rules/02-controllers-and-http-transport.md)). |
| **Use case**   | Orchestration order, the transaction boundary, ordered **post-commit** events, rollback on failure.                                                                                                                                                 |
| **Service**    | Happy path, not-found, forbidden/ownership, invalid state transition, correct delegation + args, error mapping to a typed `AppError`.                                                                                                               |
| **Domain**     | Pure: every policy arm, invariant, and state-machine transition. **No mocks needed** — if a domain test needs a mock, logic leaked out of the domain.                                                                                               |
| **Repository** | Returns data on hit, returns `null`/`[]` on miss (never throws), passes bounded + parameterized args, enforces the hard list cap (100).                                                                                                             |
| **DTO**        | Valid input passes; each missing/invalid/oversized field is rejected; boundaries at `min`/`max`; defaults applied; enum rejection.                                                                                                                  |
| **Adapter**    | The wrapper's request/response mapping and error translation, with the vendor SDK doubled ([/rules/12-library-wrapping-and-adapters.md](../rules/12-library-wrapping-and-adapters.md)).                                                             |

```typescript
// DO — service unit test: real service, doubled repository, covers happy + not-found + ownership
describe('OrderService.getOrder', () => {
  it('returns the order when it exists and belongs to the caller', async () => {
    repo.findById.mockResolvedValue(orderOwnedBy('user-1'));
    await expect(service.getOrder('order-1', 'user-1')).resolves.toMatchObject({
      id: 'order-1',
    });
  });

  it('throws OrderNotFoundError when the order is missing', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(service.getOrder('order-1', 'user-1')).rejects.toBeInstanceOf(
      OrderNotFoundError,
    );
  });

  it('throws OrderForbiddenError when the order belongs to another user', async () => {
    repo.findById.mockResolvedValue(orderOwnedBy('user-2'));
    await expect(service.getOrder('order-1', 'user-1')).rejects.toBeInstanceOf(
      OrderForbiddenError,
    );
  });
});
```

```typescript
// DON'T — fake coverage: asserts the mock, exercises no logic, skips every error path
it('returns the order', async () => {
  repo.findById.mockResolvedValue(theOrder);
  expect(await service.getOrder('order-1', 'user-1')).toBe(theOrder); // pure pass-through
});
```

### Integration — the HTTP contract

Boot the app, run the **real** `ValidationPipe`, guards, and exception filter, and drive it with supertest. Persistence and vendors are doubled (or a real test DB sits behind the repository). Override guards to inject a **verified identity** — never trust the client body ([/rules/07-security-authn-authz.md](../rules/07-security-authn-authz.md)).

This layer proves what unit tests cannot: status codes, DTO rejection at the boundary, guard chaining, and the exception filter producing a safe `{ messageKey }` instead of leaking a stack.

```typescript
// DO — integration: real pipeline, supertest assertions on the contract
const app = moduleRef.createNestApplication();
app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
await app.init();

await request(app.getHttpServer()).get('/orders/order-1').expect(401); // no token → unauthorized
await request(app.getHttpServer())
  .get('/orders/other')
  .set(asUser('user-1'))
  .expect(403); // not owner → forbidden
await request(app.getHttpServer())
  .post('/orders')
  .set(asUser('user-1'))
  .send({})
  .expect(400); // bad DTO → 400, not 500
```

### E2E — the workflow

The thin cap. A full journey across modules with real wiring end to end and persistence in a controlled test instance; doubles only at true third-party edges (an email provider, an SMS gateway, a payment provider, object storage). Reserve these for flows where a regression is expensive: login → protected action, create → read-back, a multi-step transactional use-case that must persist state **and** emit ordered events.

| Example flow                                       | Asserts                                                                         |
| -------------------------------------------------- | ------------------------------------------------------------------------------- |
| Authenticate → call a protected route → read back  | Token issued, guard chain admits, response shape correct                        |
| Create entity → fetch it → confirm persisted state | Write committed, ownership scoping holds on read                                |
| Multi-step use-case (e.g. place an Order)          | All entities mutated under one transaction; post-commit events emitted in order |

---

## 3. Mapping a change to layers

For every change, decide which layers apply and record why a layer is or isn't needed (silence is not a decision).

| Change                            | Unit                                      | Integration                         | E2E                       |
| --------------------------------- | ----------------------------------------- | ----------------------------------- | ------------------------- |
| New/changed domain rule or policy | Required                                  | If reachable via a route            | If on a critical flow     |
| New/changed service or use-case   | Required                                  | Required (the route)                | If critical/transactional |
| New/changed controller or DTO     | DTO + controller delegation               | Required (pipeline)                 | Optional                  |
| New/changed guard or permission   | Guard unit                                | Required (`401`/`403`)              | Auth flows                |
| New/changed repository query      | Required                                  | Against a real test DB              | —                         |
| New adapter / vendor wrapping     | Required (SDK doubled)                    | —                                   | —                         |
| Bug fix                           | Reproducing regression test (red → green) | If the bug surfaced at the boundary | —                         |

---

## 4. Environments

| Environment     | Used by                   | Persistence                                                                  | External vendors                           |
| --------------- | ------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------ |
| **Unit**        | Unit tests                | None — all doubled                                                           | Doubled (the adapter or the SDK inside it) |
| **Integration** | Controller pipeline tests | Doubled repository, **or** a real test DB behind the repository              | Doubled                                    |
| **E2E**         | Critical-flow tests       | A real DB in a disposable test instance (container or dedicated test schema) | Doubled at the true third-party edge       |

Rules that hold across environments:

- **No real network, real clock, or real vendor in unit tests.** Those belong to integration/E2E behind a controlled instance.
- **Each suite owns its data.** Reset the relevant tables/collections before a suite that touches a real DB; never depend on order or leftovers from another suite.
- **Identity is injected from the verified token**, never the request body — override the auth guard in tests to set the current user ([/rules/07-security-authn-authz.md](../rules/07-security-authn-authz.md)).
- **Configuration is typed and validated.** Tests provide config through the config layer, not ad-hoc `process.env` reads ([/rules/17-configuration-and-environment.md](../rules/17-configuration-and-environment.md)).
- **The ORM is interchangeable.** Whether the test DB is relational or document-based, the contract is the repository interface — swap the engine, keep the tests. See [/memory/database-decisions.md](../memory/database-decisions.md).

---

## 5. Test data & fixtures

- **Builders over literals.** Construct entities with named factory functions (`anOrder({ ownerId: 'user-1' })`) so a test states only the field it cares about and the rest stay valid defaults.
- **Three intentional buckets:** baseline/happy data, edge-case data (boundaries, empty, max), and negative data (malformed, oversized, wrong type). Permission and ownership/tenant tests must cover the **combinations** that matter to safety.
- **Synthetic only.** Never use real customer data, real secrets, or production exports in tests. Generate or anonymize.
- **Deterministic and isolated.** Builders return fresh objects; suites clean up durable state they create. Full detail: [/testing/test-data-and-fixtures.md](../testing/test-data-and-fixtures.md).

---

## 6. Determinism

Flaky tests are defects — fix the cause, never rerun-until-green or paper over with sleeps.

- **Control time.** `vi.useFakeTimers()` / `vi.setSystemTime(...)`; restore in `afterEach`. Never assert against `Date.now()`.
- **Control randomness.** Inject the id/token generator and stub it; never assert against real `randomUUID`/`Math.random` output.
- **No arbitrary `sleep`/`setTimeout`** to "wait for" async work — await the promise, advance fake timers, or assert on the observable effect.
- **Isolate every test.** `vi.clearAllMocks()` in `beforeEach`; a test that only passes after another test is broken.
- **Async is explicit.** Await every promise; assert rejections with `rejects.toBeInstanceOf(<AppError>)`, not bare truthiness.

---

## 7. Scenario coverage (more than line coverage)

100% lines through one happy-path call is paperwork. Branch + scenario coverage is the real target. Every meaningful suite exercises these unless explicitly justified in review:

| Scenario                         | Why                                                                                                                                       |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Happy path                       | The feature works.                                                                                                                        |
| Validation failure               | Bad/missing/oversized input → typed `400`, never `500`.                                                                                   |
| Not found                        | Missing entity → typed not-found `AppError`.                                                                                              |
| Ownership / tenant (IDOR)        | Actor A cannot read/mutate actor B's resource by id.                                                                                      |
| Permission / RBAC                | Authenticated-but-unauthorized → `403`.                                                                                                   |
| Invalid state transition         | The domain state machine rejects illegal moves.                                                                                           |
| Boundary                         | At / above / below limits; off-by-one and the list cap (100) are correct.                                                                 |
| Empty / null                     | `[]` returns `[]` (not null, not a crash); null handled.                                                                                  |
| Idempotency / duplicate delivery | Repeating an operation or event produces the correct result ([/rules/19-async-events-and-jobs.md](../rules/19-async-events-and-jobs.md)). |
| Dependency failure & fallback    | Adapter/repo throws → handled, mapped, or swallowed as designed.                                                                          |
| Fail-safe side effect            | A fire-and-forget handler **swallows** its own error and never rejects the caller.                                                        |

```typescript
// DO — prove a fire-and-forget handler never breaks the workflow when its side effect fails
it('swallows a notification failure and resolves without rejecting', async () => {
  notifier.send.mockRejectedValue(new Error('provider down'));
  await expect(
    handler.onOrderPlaced(orderPlacedEvent),
  ).resolves.toBeUndefined();
  expect(logger.error).toHaveBeenCalled();
});
```

---

## 8. Security tests (mandatory on protected routes)

A protected route is not "tested" until its security surface is — preferably via **integration** so the real guard chain runs end to end:

- **AuthN** — no/invalid token → `401`.
- **AuthZ / RBAC** — valid token, missing permission → `403`.
- **Ownership / tenant** — cannot reach another actor's resource by id; identity comes from the verified token, not the body.
- **Validation** — malformed/oversized/type-confused input → `400`, never `500`.
- **Injection safety** — a `'; DROP …`-style value is treated as **data**; the repository stays parameterized and bounded ([/rules/08-database-and-injection-safety.md](../rules/08-database-and-injection-safety.md)).
- **Rate limit** — sensitive endpoints (login, OTP, reset) → `429` past the limit.

Detail: [/skills/security-review.md](../skills/security-review.md), [/skills/sql-injection-review.md](../skills/sql-injection-review.md).

---

## 9. Coverage floor

- **Workspace floor: 95%** statements / branches / functions / lines — enforced by `npm run test:coverage` (Husky `pre-push`).
- **Critical paths near 100%:** auth, RBAC, ownership/tenant scoping, money/state transitions, transactional use-cases.
- Touched modules sit **above** the floor — never hide weak coverage on the changed file behind a high repo-wide average.
- Declarative files (`*.types.ts`, `*.enums.ts`, `*.constants.ts`, barrel `index.ts`, `model/**`, migrations) are excluded from the denominator. Full policy: [/testing/coverage-policy.md](../testing/coverage-policy.md).

---

## 10. Evidence expected

Tests are the proof; the record of running them is the receipt. For a meaningful change, the validation report ([/docs/sdlc/](../docs/sdlc/) and `15-dev-validation-report.md`) should capture:

| Evidence                                                            | Source                                                      |
| ------------------------------------------------------------------- | ----------------------------------------------------------- |
| Suite result (pass/fail counts)                                     | `npm run test`                                              |
| Coverage on touched modules vs the floor                            | `npm run test:coverage`                                     |
| HTTP contract checks (`401`/`403`/`400`/`429`) for protected routes | integration run output                                      |
| Persisted-state verification after writes                           | a read-back assertion or a direct query against the test DB |
| Emitted events / jobs after a use-case                              | spies on the event bus / queue adapter                      |
| Lint / typecheck / build green                                      | the quality-gate block below                                |

Record what was **not** run (and why, with the residual risk) instead of leaving a silent gap. Keep the original failing evidence **and** the retest evidence for any defect — never overwrite history. See [/testing/bug-triage-and-retest.md](../testing/bug-triage-and-retest.md).

---

## 11. Adding tests for new code

| New code                      | Required tests                                                               |
| ----------------------------- | ---------------------------------------------------------------------------- |
| DTO / validation schema       | Valid input, each invalid field, boundary values, enum rejection             |
| Service / use-case method     | Happy path, not-found, forbidden/ownership, error paths, edges               |
| Domain policy / state machine | Every arm and invariant; illegal transitions rejected                        |
| Repository query              | Hit, miss (`null`/`[]`), bounded args, list cap                              |
| Controller / route            | Pipeline integration: status, validation, guard chain                        |
| Adapter                       | Mapping + error translation with the SDK doubled                             |
| Critical flow                 | E2E read-back + event assertions                                             |
| Bug fix                       | A regression test that reproduces the bug (red), then proves the fix (green) |

---

## Quality gates

```bash
npm run lint            # 0 errors AND 0 warnings
npm run typecheck       # tsgo --noEmit, project-wide
npm run test            # vitest run — full suite
npm run test:coverage   # 95% floor met (critical paths near 100%)
npm run build           # compiles clean
```

Husky enforces lint + typecheck on `pre-commit` and `test:coverage` + `build` on `pre-push`. Never bypass with `--no-verify`.

**Related:** [/testing/README.md](./README.md) · [/testing/unit-testing-standard.md](./unit-testing-standard.md) · [/testing/integration-testing-standard.md](./integration-testing-standard.md) · [/testing/e2e-testing-standard.md](./e2e-testing-standard.md) · [/testing/coverage-policy.md](./coverage-policy.md) · [/testing/test-data-and-fixtures.md](./test-data-and-fixtures.md) · [/testing/quality-gates.md](./quality-gates.md) · [/testing/bug-triage-and-retest.md](./bug-triage-and-retest.md) · [/rules/11-testing-and-coverage.md](../rules/11-testing-and-coverage.md) · [/memory/testing-strategy.md](../memory/testing-strategy.md)
