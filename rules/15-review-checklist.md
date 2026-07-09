# 15 — The Pre-Merge Review Checklist

> The consolidated review gate that implements the canon. One actionable list: every box is checked or justified `N/A` before a PR merges. This is the gate, not the spec — each section links to its canonical rule file. Backs [/agents/backend-code-reviewer.md](../agents/backend-code-reviewer.md) and the [/testing/quality-gates.md](../testing/quality-gates.md).

Use blocker language in review comments:

- **MUST FIX** — a merge blocker. Violates a non-negotiable rule, breaks a layer boundary, leaks data, or ships behavior with no test. The PR does not merge until resolved.
- **SHOULD FIX** — a real defect or risk that should be fixed now; defer only with the author's explicit acknowledgement.
- **FOLLOW-UP** — a tracked improvement that is safe to land later; link the ticket.

A green build is **not** proof of correctness. Walk every section and prove behavior with tests.

---

## Hard gates (CI + Husky `pre-push`) — all green, no exceptions

```bash
npm run lint            # 0 errors AND 0 warnings
npm run typecheck       # tsgo --noEmit, project-wide (not just staged)
npm run test            # vitest
npm run test:coverage   # ≥95% statements/branches/functions/lines; critical paths ~100%
npm run build           # nest build -p tsconfig.build.json
```

Never bypass a hook with `--no-verify`. A failed gate is reported with the **command, failing file(s), exact error, and whether it relates to the change** — never claim green when a gate is red. See [/testing/quality-gates.md](../testing/quality-gates.md).

---

## 1. Types & lint → [13-eslint-and-typescript.md](./13-eslint-and-typescript.md), [00-non-negotiable-rules.md](./00-non-negotiable-rules.md)

- [ ] **MUST FIX** — no `any`; `unknown` + narrowing or a real type (rule 3).
- [ ] **MUST FIX** — no `eslint-disable`, no `@ts-ignore`; `@ts-expect-error` only with a linked, justified decision (rules 4–6).
- [ ] **MUST FIX** — no non-null assertion (`!`); use guards, `??`, `?.` (rule 7).
- [ ] **MUST FIX** — `===` / `!==` only; never `==` / `!=`.
- [ ] **SHOULD FIX** — explicit return types on every public method, provider, and exported function; no inferred-`any` leaks.
- [ ] **SHOULD FIX** — `import type` / `export type` for type-only imports; no duplicate or self imports.
- [ ] **SHOULD FIX** — `noUncheckedIndexedAccess` / `exactOptionalPropertyTypes` honored (narrow index access; conditional-spread optionals — see [/memory/known-pitfalls.md](../memory/known-pitfalls.md)).
- [ ] **SHOULD FIX** — filenames are kebab-case; `lint` is genuinely 0/0, not silenced.

## 2. Architecture & extraction → [01-architecture-and-module-boundaries.md](./01-architecture-and-module-boundaries.md), [/context/architecture-map.md](../context/architecture-map.md)

- [ ] **MUST FIX** — code lives in the correct layer: controller → use-case/service → domain → repository → adapter (one-way deps only).
- [ ] **MUST FIX** — controller method is thin: one delegation, no branching/transformation, no repository/infrastructure import (`architecture/controller-no-logic`). See [02-controllers-and-http-transport.md](./02-controllers-and-http-transport.md).
- [ ] **MUST FIX** — services orchestrate a focused capability, ≤20 lines/method; no `Promise.all|allSettled|any|race` inside a service. Use cases own multi-entity/transactional work; use cases call services, never the reverse. See [03-application-services-and-use-cases.md](./03-application-services-and-use-cases.md).
- [ ] **MUST FIX** — domain rules live in `domain/` (policies, invariants, state machines) — pure, not in controllers/services.
- [ ] **MUST FIX** — no cross-module internal imports; consume another module via its `index.ts` or via events; `shared/` imports only `shared/` (rule 24).
- [ ] **MUST FIX** — no inline `type`/`interface`/`enum`/`const`/DTO/config-map in controllers/services/repositories/use-cases/guards/interceptors/pipes/adapters (rules 10–16). See [06-types-enums-constants.md](./06-types-enums-constants.md).
- [ ] **SHOULD FIX** — no god files; oversized files split by ownership (see [/skills/decompose-large-file.md](../skills/decompose-large-file.md)). Transformation/mapping/formatting extracted to `lib/`.
- [ ] **SHOULD FIX** — path aliases (`@core/*`, `@modules/*`, …) used; no deep `../../../` relatives. No new circular dependencies.

## 2a. Readability & simplicity → [24-team-readable-code-review.md](./24-team-readable-code-review.md), [20-simple-readable-code.md](./20-simple-readable-code.md)

- [ ] **SHOULD FIX** — junior-readable and senior-trustworthy: the nineteen questions of [24](./24-team-readable-code-review.md) all answer yes; no clever TypeScript, nested chains, or dense one-liners ([20 §4](./20-simple-readable-code.md)).
- [ ] **SHOULD FIX** — no speculative abstraction or unused DTO/config/env/helper shipped ([21](./21-yagni-and-minimalism.md)); existing owners reused, no parallel duplicates ([22](./22-reuse-before-creating.md)).
- [ ] **MUST FIX** — no safety guarantee (validation, guards, ownership, `AppError`/`messageKey`, adapters, bounds, tests, docs) cut in the name of simplicity (rule 46).

```typescript
// MUST FIX — logic in the controller
@Post()
async create(@Body() dto: CreateOrderDto, @CurrentUser() user: UserContext): Promise<OrderResponse> {
  const existing = await this.orderService.findByRef(dto.ref); // ⛔ branching + extra call
  if (existing) throw new ConflictException();
  return this.orderService.create(dto, user.id);
}

// Do — one delegation, identity from the verified token
@Post()
create(@Body() dto: CreateOrderDto, @CurrentUser() user: UserContext): Promise<OrderResponse> {
  return this.createOrderUseCase.execute(dto, user.id);
}
```

## 3. Domain values, DTOs & errors → [05-dto-and-validation.md](./05-dto-and-validation.md), [18-error-handling-and-exceptions.md](./18-error-handling-and-exceptions.md)

- [ ] **MUST FIX** — every HTTP-boundary input is validated by a DTO (class-validator primary; Zod via the pipe as the alternative). No unvalidated body/query/param. Validation rules live in the DTO, not the service.
- [ ] **MUST FIX** — no domain string comparisons; compare against enum members from `@shared/enums` or `model/<feature>.enums.ts` (rules 8, 9). No magic strings/numbers (statuses, roles, permissions, event names, cache keys, TTLs, limits).
- [ ] **MUST FIX** — every user-facing failure is a typed `AppError` carrying a `messageKey` of form `errors.<feature>.<key>`, mapped by the global exception filter (rule 26). See [/skills/create-error.md](../skills/create-error.md).
- [ ] **SHOULD FIX** — every distinct scenario (validation, not-found, forbidden, conflict, business-rule) has its own key. No bare framework exceptions thrown from business code.
- [ ] **SHOULD FIX** — every string field is bounded (`@MaxLength`/`.max()`); every array/collection field is bounded; trim/min applied where empty is invalid.
- [ ] **SHOULD FIX** — update DTOs make fields optional; complex regex is split/anchored to avoid ReDoS. See [/skills/create-dto-validation.md](../skills/create-dto-validation.md).

## 4. Security & data → [07-security-authn-authz.md](./07-security-authn-authz.md), [08-database-and-injection-safety.md](./08-database-and-injection-safety.md)

- [ ] **MUST FIX** — every protected route chains an **auth guard + a permissions (RBAC) guard + an ownership/tenant check**; authentication ≠ authorization (rules 33–35).
- [ ] **MUST FIX** — identity (`userId`, tenant, roles) is derived from the verified token, never trusted from the client body/query. Resources fetched by id are ownership/tenant-checked (prevents IDOR/cross-tenant access).
- [ ] **MUST FIX** — permission strings come from the central permission catalog — never inline literals.
- [ ] **MUST FIX** — no raw SQL string interpolation; every query is parameterized and bounded (hard max list limit 100). See [/skills/sql-injection-review.md](../skills/sql-injection-review.md).
- [ ] **MUST FIX** — no stack traces, SQL, secrets, tokens, or internal messages leak to clients; the exception filter returns a sanitized `{ messageKey }`; full detail is logged server-side (rule 36).
- [ ] **SHOULD FIX** — secrets compared timing-safely; passwords hashed with a strong KDF; tokens from a CSPRNG; no secret in a URL query parameter.
- [ ] **SHOULD FIX** — uploads whitelist MIME + extension + size (+ content/magic-byte and malware checks where applicable, behind an adapter). See [/skills/security-review.md](../skills/security-review.md).

## 5. Config, logging, libraries & behavior → [17-configuration-and-environment.md](./17-configuration-and-environment.md), [14-observability-and-logging.md](./14-observability-and-logging.md), [12-library-wrapping-and-adapters.md](./12-library-wrapping-and-adapters.md)

- [ ] **MUST FIX** — no `process.env` outside `config/` and `bootstrap/`; read typed config via `@nestjs/config`; new env vars validated at startup (fail-fast). See [/skills/add-config-value.md](../skills/add-config-value.md).
- [ ] **MUST FIX** — logging via the `@core/logger` adapter only; no `console.*`. Bodies sanitized; no secrets/PII/tokens in logs (rule 28).
- [ ] **MUST FIX** — every external library/SDK is wrapped behind an `adapters/*.adapter.ts`; business code calls the adapter, not the vendor; no new integration/queue/job/dependency without an adapter **and** docs (rules 32, 41). See [/skills/add-library-adapter.md](../skills/add-library-adapter.md).
- [ ] **SHOULD FIX** — structured logs on critical paths with a constant message + typed metadata; `catch (error: unknown)` narrowed before logging; correlation/request id threaded. State-changing/privileged actions emit an audit record with enum actor/action/entity types. See [/skills/observability-review.md](../skills/observability-review.md).
- [ ] **SHOULD FIX** — fail-safe side effects: fire-and-forget handlers (events, notifications) catch their own errors so a delivery failure never blocks the workflow. See [19-async-events-and-jobs.md](./19-async-events-and-jobs.md).
- [ ] **SHOULD FIX** — async/long-running work has terminal states (success/failure/timeout) and operator visibility; explicit retries/timeouts/cancellation. See [10-reliability-and-durability.md](./10-reliability-and-durability.md).
- [ ] **SHOULD FIX** — no floating promises (every promise awaited or explicitly `void`ed); no N+1; bulk ops batched; optional dependencies degrade (e.g. return `503`) instead of crashing. See [09-performance-and-scalability.md](./09-performance-and-scalability.md).

## 6. Tests & coverage → [11-testing-and-coverage.md](./11-testing-and-coverage.md), [/testing/coverage-policy.md](../testing/coverage-policy.md)

- [ ] **MUST FIX** — tests written/adjusted **first**; any behavior change updates tests in the same change (rule 42). Vitest + `@nestjs/testing` + supertest only — never another runner.
- [ ] **MUST FIX** — every new public service/use-case method has a test; every DTO/schema has valid + invalid + boundary tests; every bug fix has a regression test that **failed before** and **passes after** the fix.
- [ ] **MUST FIX** — touched-module coverage ≥95% (critical paths near 100%); a high global average never excuses weak coverage on changed code.
- [ ] **SHOULD FIX** — tests assert behavior and persisted/returned truth (not implementation details); external services mocked at the adapter boundary — no real network. See [/skills/write-unit-tests.md](../skills/write-unit-tests.md), [/skills/write-integration-tests.md](../skills/write-integration-tests.md).
- [ ] **SHOULD FIX** — integration/e2e tests run when routes/DB/integrations changed; tests are deterministic (time/randomness controlled), isolated, and order-independent. See [/skills/write-e2e-tests.md](../skills/write-e2e-tests.md).

## 7. Docs, i18n & change completeness → [16-i18n-and-messaging.md](./16-i18n-and-messaging.md), [/skills/final-validation.md](../skills/final-validation.md)

- [ ] **MUST FIX** — behavior changes are reflected in docs (module docs, the relevant `rules/` file, OpenAPI). No behavior change ships with stale docs (rule 42).
- [ ] **MUST FIX** — each new/changed `messageKey` has a translation in **every supported locale**; user-facing copy is never hardcoded in logic. See [/skills/add-i18n-message-key.md](../skills/add-i18n-message-key.md).
- [ ] **SHOULD FIX** — all affected change artifacts updated: config templates/examples, deployment/CI definitions, migrations + rollback, seed/fixtures, permission catalog, dashboards/alerts, release notes, `claude.md`. See [/skills/add-migration-backfill.md](../skills/add-migration-backfill.md).
- [ ] **FOLLOW-UP** — a new recurring mistake is recorded in [/memory/known-pitfalls.md](../memory/known-pitfalls.md) and mirrored into the compatibility files.

---

## Final handoff / release gate

Before declaring "done" or handing off for commit:

- [ ] **MUST FIX** — all hard gates green; failures reported with command, file(s), exact error, and relation to the change.
- [ ] **MUST FIX** — diff reviewed for unrelated/destructive changes; no rule weakened; no useful docs removed.
- [ ] **MUST FIX** — staged with explicit paths (never `git add .`); no `.env*`, secrets, certificates, dumps, `dist/`, or `coverage/` staged; `git diff --check` clean.
- [ ] **MUST FIX** — hooks not bypassed; commit messages follow Conventional Commits; commit/push only after the user approves the reviewed diff.

---

## Merge blockers (any one stops the merge)

- `any`, `eslint-disable`, `@ts-ignore`, unjustified `@ts-expect-error`, `!`, or `==`/`!=` in production code.
- Lint/typecheck/test/coverage/build gate red, or a hook bypassed without an approved exception.
- Business logic in a controller, or any layer-boundary / cross-module-internal-import violation.
- Inline declaration in a layer file, or a domain string-literal comparison.
- Missing auth guard, permissions guard, or ownership/tenant check on a protected route; identity trusted from the client.
- Raw/unparameterized SQL, an unbounded list query, or a stack/secret/SQL leak to the client.
- A user-facing error without a typed `AppError` + `messageKey`, or a missing locale translation.
- `process.env` outside `config/`/`bootstrap/`, a `console.*` call, or a vendor SDK used outside its adapter.
- Behavior change without tests, a bug fix without a regression test, or touched-module coverage below 95%.
- Behavior change with stale docs.
- A safety guarantee cut in the name of simplicity or minimalism (rule 46).

---

## Related

- [README.md](./README.md) — index of all rule files
- [00-non-negotiable-rules.md](./00-non-negotiable-rules.md) — the hard rules this gate enforces
- [/agents/backend-code-reviewer.md](../agents/backend-code-reviewer.md) — the reviewer that runs this checklist
- [/agents/backend-release-gatekeeper.md](../agents/backend-release-gatekeeper.md) — the final go/no-go
- [/testing/quality-gates.md](../testing/quality-gates.md) — the authoritative gate commands
- [/skills/final-validation.md](../skills/final-validation.md) — end-to-end pre-merge run
