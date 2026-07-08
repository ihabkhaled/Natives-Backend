# Testing Strategy — Decisions

> Durable record of _why_ this workspace tests the way it does: the runner, the layers, the coverage floor, and TDD as the default. The enforceable rules live in [/rules/11-testing-and-coverage.md](../rules/11-testing-and-coverage.md); the executable standards live under [/testing/](../testing/README.md). This note captures the reasoning so future engineers extend the convention instead of relitigating it.

This is a memory note: decisions + rationale, written abstractly so any NestJS project can adopt them. Where a concrete project must record its own facts (test DB name, fixture seeds, flaky-test waivers), a **Project records:** line marks the slot.

---

## Decision 1 — Vitest 4 is the runner

**Decision.** The test runner is **Vitest 4**, paired with **@nestjs/testing** for module wiring and **supertest** for HTTP. Jest, ts-jest, `tsc`-based test runs, and Mocha are out.

**Rationale.**

- Native ESM + TypeScript path-alias resolution (`@/*`, `@core/*`, `@modules/*`, …) without a separate transform config, matching the build toolchain in [backend-stack.md](./backend-stack.md).
- `vi` doubles, fake timers, and module mocking cover everything Jest did, with faster cold starts and a shared Vite pipeline.
- `@nestjs/testing` builds a real DI container so a unit test exercises the same providers, guards, and pipes the app uses — no hand-rolled wiring that drifts from production.
- `supertest` drives the booted Nest app through the real `ValidationPipe`, guard chain, and global exception filter, so integration tests assert the actual HTTP contract.

**Consequence.** Test code never imports `jest`, `jest.mock`, `jest.fn`, `@jest/globals`, or `ts-jest`. Use `vi.mock`, `vi.fn`, `vi.spyOn`, `vi.hoisted`, `vi.useFakeTimers`. See the banned-token block in [/rules/11-testing-and-coverage.md](../rules/11-testing-and-coverage.md) §9.

> **Project records:** the exact Vitest config path and any project-specific globs/pool options (e.g. serial single-fork execution if a shared test DB requires it).

---

## Decision 2 — Three layers, each at the right boundary

**Decision.** Every change maps to one or more of three layers, mocking only at the dependency boundary.

| Layer           | Subject                                                                                                                 | Wiring                                             | What is doubled                                                 |
| --------------- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | --------------------------------------------------------------- |
| **Unit**        | One class (service, use-case, domain policy, mapper, guard, pipe)                                                       | `Test.createTestingModule` with `useValue` doubles | All collaborators                                               |
| **Integration** | A controller through the real Nest pipeline (DTO → `ValidationPipe` → guards → handler → application) via **supertest** | Real Nest app + real guards/pipes/filter           | Persistence + vendors (or a real test DB behind the repository) |
| **E2E**         | A workflow across modules/routes                                                                                        | Real wiring end-to-end                             | Only true third-party edges                                     |

**Rationale.** The layered architecture ([/context/architecture-map.md](../context/architecture-map.md)) makes the boundary obvious: a service test mocks the repository; a domain test mocks nothing; an integration test boots the app and doubles only persistence/vendors. Mocking the subject proves nothing, so the rule is **mock dependencies, never the system under test**.

**Consequence.** Vendors and SDKs are _always_ doubled because they live behind adapters ([library-boundaries.md](./library-boundaries.md)) — double the adapter or the SDK inside it, never call a real provider (an email provider, object storage, an SMS gateway, a payment provider, a cache) from any test.

```typescript
// DO — unit: real service, doubled repository + logger, asserted at the boundary
const moduleRef = await Test.createTestingModule({
  providers: [
    OrderService,
    {
      provide: OrderRepository,
      useValue: { findById: vi.fn(), save: vi.fn() },
    },
    { provide: AppLogger, useValue: { info: vi.fn(), error: vi.fn() } },
  ],
}).compile();
const service: OrderService = moduleRef.get(OrderService);
```

```typescript
// DON'T — mock the subject and assert nothing real
const service = { getOrder: vi.fn().mockResolvedValue(theOrder) }; // tests the mock, not the code
```

Recipes: [/skills/write-unit-tests.md](../skills/write-unit-tests.md), [/skills/write-integration-tests.md](../skills/write-integration-tests.md), [/skills/write-e2e-tests.md](../skills/write-e2e-tests.md).

---

## Decision 3 — Coverage is a per-touched-module floor, not a vanity average

**Decision.** The workspace coverage floor is **95%** across statements, branches, functions, and lines, enforced by `npm run test:coverage` on Husky `pre-push`. Critical paths run **near 100%**.

**Rationale.**

- A repo-wide average hides weak coverage on the file you just changed. The contract is: **touched modules sit above the floor.** A high global number never excuses an untested branch you introduced.
- Coverage is a _floor, not a goal_. 100% lines through a single happy-path call is paperwork; branch + scenario coverage (Decision 5) is the real target.
- Critical surfaces — authentication, RBAC, ownership/tenant scoping, state-machine transitions, money or balance changes, transactional use-cases — carry the highest blast radius and run near 100%.

**Excluded from the denominator** (declarative, no logic): `*.types.ts`, `*.enums.ts`, `*.constants.ts`, barrel `index.ts`, `model/**`, `@shared/{enums,constants,types}/**`, and migrations. This is _why_ the zero-inline-declaration rules ([/rules/06-types-enums-constants.md](../rules/06-types-enums-constants.md)) double as coverage strategy: keeping types/enums/constants in their own files removes non-logic from the denominator, so the real logic in `*.service.ts`, `*.use-case.ts`, `domain/`, and `lib/` clears the bar honestly.

A genuinely unreachable defensive branch (a fall-through an earlier guard already prevents) may use a justified `/* istanbul ignore next */` with a comment explaining _why_. Rare exception, never a number-hitting tool.

> **Project records:** any per-file threshold overrides, additional exclusion globs, and the location of the coverage report. Full policy: [/testing/coverage-policy.md](../testing/coverage-policy.md).

---

## Decision 4 — TDD is the default cycle

**Decision.** Write or update the test **first**. Behavior never changes without tests and docs in the same change.

| Situation                 | What you write first                                                                                                                                |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| New behavior              | A failing test naming the behavior, then the minimum code to green it.                                                                              |
| Bug fix                   | A test that **reproduces** the bug (red), then the fix (green) — that test is the permanent regression guard.                                       |
| Behavior change           | Update the affected tests in the same change.                                                                                                       |
| Refactor of untested code | **Characterization tests first** to pin today's behavior, then refactor; if a pinned quirk was a bug, change the test deliberately and call it out. |

**Rationale.** Tests-first forces a testable design at the right boundary, makes the acceptance criterion explicit before code exists, and turns every fixed bug into a guard that prevents the regression class forever. A green build is not proof of correctness; a passing happy path is not proof of correctness. This decision is the hard contract in [/rules/00-non-negotiable-rules.md](../rules/00-non-negotiable-rules.md) #42 and [/rules/11-testing-and-coverage.md](../rules/11-testing-and-coverage.md) §1.

---

## Decision 5 — Scenario coverage over line coverage

**Decision.** Every suite exercises the failure surface, not just the happy path. Unless explicitly justified in review, cover: happy path, validation failure (`400`, never `500`), not-found, ownership/tenant (IDOR), permission/RBAC (`403`), invalid state transition, boundaries (at/above/below limits and the hard list cap of 100), empty/null, idempotency/duplicate delivery, dependency failure + fallback, and fail-safe side effects.

**Rationale.** The expensive bugs hide in the unhappy paths. Per-feature error keys, ownership checks, and bounded queries are only _proven_ when a test drives the rejecting path. Fire-and-forget handlers ([/rules/19-async-events-and-jobs.md](../rules/19-async-events-and-jobs.md), [reliability-patterns.md](./reliability-patterns.md)) must be asserted to **swallow their own error** so a side-effect failure never rejects the caller.

```typescript
// DO — prove a fire-and-forget handler never breaks the workflow on side-effect failure
it('swallows a notification failure and resolves without rejecting', async () => {
  notifier.send.mockRejectedValue(new Error('provider down'));
  await expect(
    handler.onOrderPlaced(orderPlacedEvent),
  ).resolves.toBeUndefined();
  expect(logger.error).toHaveBeenCalled();
});
```

Security tests are mandatory on protected routes, preferably as integration so the real guard chain runs: AuthN (`401`), AuthZ/RBAC (`403`), ownership/tenant (identity from the verified token, never the client body — [security-decisions.md](./security-decisions.md)), validation (`400`), injection-safety (a `'; DROP …` value stays _data_; the repository stays parameterized and bounded — [database-decisions.md](./database-decisions.md)), and rate limit (`429`).

> **Project records:** which routes are security-critical, and any approved scenario waivers with their justification.

---

## Decision 6 — Determinism is non-negotiable

**Decision.** Flaky tests are defects, fixed at the cause — never rerun-until-green, never papered over with sleeps.

**Rationale.** A test that passes only sometimes erodes trust in the whole suite and the coverage gate.

- **Control time:** `vi.useFakeTimers()` / `vi.setSystemTime(...)`, restored in `afterEach`. Never assert against live `Date.now()`.
- **Control randomness:** inject and stub id/token/UUID generators; never assert against real `Math.random` output.
- **No arbitrary `sleep`/`setTimeout`** to wait for async work — await the promise, advance fake timers, or assert the observable effect.
- **No real network, clock, or DB** in unit tests; those belong to integration/e2e behind a controlled test instance.
- **Async is explicit:** await every promise; assert rejections with `rejects.toBeInstanceOf(<AppError>)`, not bare truthiness.
- Isolate every test (`vi.clearAllMocks()` in `beforeEach`); a test that passes only after another ran is broken.

> **Project records:** the test database / container the integration suite targets, how it is migrated and reset between runs, and any documented flaky-test quarantine with an owner and removal date.

---

## Commands & gates

```bash
npm run lint            # 0 errors AND 0 warnings
npm run typecheck       # tsgo --noEmit, project-wide
npm run test            # vitest run — full suite
npm run test:coverage   # vitest run --coverage — enforces the 95% floor
npm run build           # compiles clean
```

Husky enforces lint + typecheck on **pre-commit** and `test:coverage` + build on **pre-push**. Never bypass with `--no-verify` without a recorded, approved emergency exception. Test code observes the same type-safety rules as production: no `any`, no `@ts-ignore`, no `eslint-disable` — type doubles with `import type { Mock } from 'vitest'`.

---

## Related

[/rules/11-testing-and-coverage.md](../rules/11-testing-and-coverage.md) · [/testing/testing-strategy.md](../testing/testing-strategy.md) · [/testing/coverage-policy.md](../testing/coverage-policy.md) · [/testing/quality-gates.md](../testing/quality-gates.md) · [/testing/test-data-and-fixtures.md](../testing/test-data-and-fixtures.md) · [backend-stack.md](./backend-stack.md) · [known-pitfalls.md](./known-pitfalls.md) · [/skills/write-unit-tests.md](../skills/write-unit-tests.md) · [/skills/final-validation.md](../skills/final-validation.md)
