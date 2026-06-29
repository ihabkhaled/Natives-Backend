# Testing — Engineering Standards Index

> The house testing standard for this NestJS backend: strategy, layers, coverage, fixtures, gates, and the bug→retest loop. It implements the canon — [00 non-negotiable rules](../rules/00-non-negotiable-rules.md) (rule 42: no behavior change without tests, written first), [11 testing & coverage](../rules/11-testing-and-coverage.md), and the [architecture map](../context/architecture-map.md) — and binds the engineering test suite to the SDLC test artifacts in [/docs](../docs/) and [/test-cases](../test-cases/).

Toolchain is fixed: **Vitest 4** (`@vitest/coverage-istanbul`) + **@nestjs/testing** + **supertest** on **NestJS 11 / Fastify**. No `jest`, no `ts-jest`, no `tsc`. See [stack-and-toolchain.md](../context/stack-and-toolchain.md).

---

## The documents in this folder

| Doc | Owns |
| --- | --- |
| [testing-strategy.md](./testing-strategy.md) | The pyramid, what each layer proves, when to write which test |
| [unit-testing-standard.md](./unit-testing-standard.md) | Isolated domain/service/policy tests with mocked collaborators |
| [integration-testing-standard.md](./integration-testing-standard.md) | Module wiring + real persistence behind the repository |
| [e2e-testing-standard.md](./e2e-testing-standard.md) | Full HTTP boot via `@nestjs/testing` + `supertest` |
| [coverage-policy.md](./coverage-policy.md) | The 95% floor, touched-module measurement, waivers |
| [test-data-and-fixtures.md](./test-data-and-fixtures.md) | Builders/factories, deterministic data, isolation & cleanup |
| [quality-gates.md](./quality-gates.md) | The exact commands that must be green before "done" |
| [bug-triage-and-retest.md](./bug-triage-and-retest.md) | Severity, root-cause, regression test, retest evidence |

---

## The test pyramid (NestJS-flavored)

```
        ┌───────────────────────────────────┐
        │  E2E (supertest + booted Nest app) │  Few, slow — real HTTP, real guards/pipes/filter
        ├───────────────────────────────────┤
        │  Integration (module + real repo)  │  Moderate — wiring, persistence, transactions
        ├───────────────────────────────────┤
        │  DTO / contract validation         │  Per DTO — boundary, null, overflow, bad enum
        ├───────────────────────────────────┤
        │  Unit (domain / service / policy)  │  Many, fast, isolated — the bulk of the suite
        └───────────────────────────────────┘
```

**Guiding principles**

- Write or adjust tests **first** (rule 42). A behavior change ships with its tests in the same change.
- Test at the layer that owns the behavior: pure rules in `domain/`, orchestration in services/use-cases, wiring at integration, the HTTP contract at e2e.
- Test through the real seams: boot the module with `@nestjs/testing`, drive HTTP with `supertest`, mock only at the adapter/repository boundary.
- Verify **persisted truth**, not just a 2xx. After a write, read it back through the repository.
- Deterministic always: control time, seed randomness, no arbitrary `sleep`.
- Coverage floor is **95%** on touched modules; critical paths (auth, money, tenant isolation, state machines) near 100%.

---

## What each layer proves

| Layer | Subject under test | Collaborators | Asserts |
| --- | --- | --- | --- |
| **Unit** | `domain/` policies & entities, `<feature>.service.ts`, `lib/` mappers/helpers, guards, pipes | Mocked (repository, adapters, clock) | Business rules, error paths, `messageKey`, branch coverage |
| **Integration** | `<feature>.module`, use-case + service + repository together | Real DB behind the repository; adapters mocked | Wiring, transactions, post-commit events, persisted state |
| **DTO / contract** | `api/dto/*.dto.ts` via the global `ValidationPipe` | None | `whitelist`/`transform`, boundaries, rejected payloads |
| **E2E** | Booted Nest app over HTTP | Real guards/pipes/filter; integrations behind mock adapters | Status codes, auth+RBAC+ownership chain, sanitized error body |

Layer-by-layer rules: [unit](./unit-testing-standard.md), [integration](./integration-testing-standard.md), [e2e](./e2e-testing-standard.md).

---

## Required cases per subject

Every subject (a DTO, a service method, an endpoint) must cover the relevant set:

- **Happy path** — valid minimal input succeeds.
- **Validation failures** — missing required field, wrong type, string over max, array over max (cap 100), bad enum, `null` for required → typed `AppError` / 400.
- **Boundary** — min, max, just-over, empty collection, pagination edges.
- **Not found** — unknown id → typed not-found error / 404.
- **AuthN / AuthZ** — unauthenticated → 401; authenticated-but-forbidden → 403; cross-tenant/non-owner id → 403/404 (identity from the verified token, never the body).
- **Conflict / business rule** — duplicate, illegal state transition → distinct `messageKey`.
- **Partial failure** — fail-safe side effect: a failed event/notification never blocks the primary workflow.
- **Response shape** — required fields present; secrets/PII (hashes, tokens, internal ids) absent.

---

## Test layout & naming

Co-locate tests with the code they prove, inside the feature module:

```
src/modules/<feature>/
  domain/<feature>.policy.ts            domain/<feature>.policy.spec.ts
  application/<feature>.service.ts       application/<feature>.service.spec.ts
  application/<action>.use-case.ts       application/<action>.use-case.int-spec.ts
  api/dto/create-<feature>.dto.ts        api/dto/create-<feature>.dto.spec.ts
  api/<feature>.controller.ts            test/<feature>.e2e-spec.ts
```

| Suffix | Layer | Runner config |
| --- | --- | --- |
| `*.spec.ts` | unit + DTO | default Vitest project |
| `*.int-spec.ts` | integration (real persistence) | integration project |
| `*.e2e-spec.ts` | e2e (booted app + supertest) | e2e project |

Test names describe scenario **and** expected outcome so a failure explains itself: `rejects create when name exceeds max length`.

---

## Minimal examples

**Unit — service with mocked collaborators (Vitest + @nestjs/testing):**

```typescript
describe('OrderService.cancel', () => {
  it('throws a typed conflict when the order is already shipped', async () => {
    const repo = { findById: vi.fn().mockResolvedValue(shippedOrder()) };
    const moduleRef = await Test.createTestingModule({
      providers: [OrderService, { provide: OrderRepository, useValue: repo }],
    }).compile();
    const service = moduleRef.get(OrderService);

    await expect(service.cancel(shippedOrder().id)).rejects.toMatchObject({
      messageKey: ERROR_KEYS.order.alreadyShipped,
    });
  });
});
```

**E2E — booted app + supertest enforcing the security chain:**

```typescript
it('rejects a cross-tenant read with 403', async () => {
  await request(app.getHttpServer())
    .get(`/orders/${otherTenantOrderId}`)
    .set('Authorization', `Bearer ${tenantAToken}`)
    .expect(HttpStatus.FORBIDDEN);
});
```

Do **not** assert on private internals, snapshot whole error stacks, or `console.log` inside tests — assert on the public contract and the sanitized body.

---

## How this binds to the SDLC

The engineering suite is the executable half of the SDLC test artifacts. Keep them in lockstep — same delivery stream, same change.

| SDLC artifact ([/docs/features/_template](../docs/features/_template/)) | This folder | Evidence lives in |
| --- | --- | --- |
| [11-test-strategy.md](../docs/features/_template/11-test-strategy.md) | [testing-strategy.md](./testing-strategy.md) | requirement → test-layer map |
| [12-coverage-plan.md](../docs/features/_template/12-coverage-plan.md) | [coverage-policy.md](./coverage-policy.md) | touched-module thresholds + waivers |
| [15-dev-validation-report.md](../docs/features/_template/15-dev-validation-report.md) | [quality-gates.md](./quality-gates.md) | gate command output |
| [16-dev-bug-log.md](../docs/features/_template/16-dev-bug-log.md) · [18-defect-cycle-log.md](../docs/features/_template/18-defect-cycle-log.md) | [bug-triage-and-retest.md](./bug-triage-and-retest.md) | defect + retest evidence |
| [17-qa-report.md](../docs/features/_template/17-qa-report.md) | [e2e-testing-standard.md](./e2e-testing-standard.md) | QA scenario matrix |

Reusable scenario cases (not just code) live under [/test-cases](../test-cases/): `unit/`, `integration/`, `e2e/`, `security/`, `business/`. An escaped defect must leave a preserved case there plus a regression test in the suite. The [qa-baseline](../docs/sdlc/qa-baseline.md) defines the company-wide QA expectations these standards satisfy.

---

## Delivery blockers — never declare "done" with any of these

1. `npm run typecheck` not clean (`tsgo --noEmit`).
2. `npm run lint` not **0 errors AND 0 warnings**.
3. Any failing unit / integration / e2e test.
4. Touched-module coverage below 95% without an approved, recorded waiver.
5. Behavior changed but tests not written/updated first.
6. A write tested without reading back the persisted result.
7. Missing negative cases for a critical path (auth, RBAC, ownership, money, state machine).
8. A `messageKey` missing for any new error scenario, or a locale missing the key.
9. Hooks bypassed with `--no-verify` (no recorded emergency exception).
10. A fixed bug without a regression test proving the original failure is covered.

---

## Run the suite

```bash
npm run test            # vitest run — unit + integration + e2e
npm run test:watch      # vitest — local TDD loop
npm run test:coverage   # vitest run --coverage — enforces the 95% floor
```

Full gate (must all be green before "done") — see [quality-gates.md](./quality-gates.md):

```bash
npm run lint            # 0 errors AND 0 warnings
npm run typecheck       # tsgo --noEmit, project-wide
npm run test            # vitest
npm run test:coverage   # coverage thresholds met
npm run build           # compiles clean
```

`pre-push` runs `test:coverage` + `build`; never bypass it. A green build is **not** proof of correctness — walk the [review checklist](../rules/15-review-checklist.md).

**Related:** [testing-strategy.md](./testing-strategy.md) · [coverage-policy.md](./coverage-policy.md) · [quality-gates.md](./quality-gates.md) · [bug-triage-and-retest.md](./bug-triage-and-retest.md) · [/rules/11-testing-and-coverage.md](../rules/11-testing-and-coverage.md) · [/skills/write-unit-tests.md](../skills/write-unit-tests.md) · [/skills/write-integration-tests.md](../skills/write-integration-tests.md) · [/skills/write-e2e-tests.md](../skills/write-e2e-tests.md) · [/skills/final-validation.md](../skills/final-validation.md)
