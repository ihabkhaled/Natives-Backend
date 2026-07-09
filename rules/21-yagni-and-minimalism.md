# 21 — YAGNI & Minimalism

> **Do not build for imaginary future needs.** Every abstraction must earn its existence with a real, current reason. Implements rule **44** of [00-non-negotiable-rules.md](./00-non-negotiable-rules.md) and extends "pick the smallest one that fits" from [03-application-services-and-use-cases.md](./03-application-services-and-use-cases.md). Minimalism means minimum **safe** code — it never cuts a guarantee this rulebook makes.

---

## 1. Forbidden without a real current requirement

None of the following may be introduced "for later," "just in case," or "to be future-proof":

- generic plugin systems, dynamic module builders, overly generic CRUD frameworks
- abstract base classes, strategy objects, factories (`@typescript-eslint/no-extraneous-class` already blocks empty wrappers)
- event buses, background job systems, queues, cache layers, database abstractions beyond the repository contract
- unused DTOs, config values, environment variables, adapters, providers, helpers
- tests for behavior that does not exist; "maybe later" code paths

> **Speculative code is not free.** It burns reviewer time, AI context tokens, CI minutes, and future maintenance — and it usually guesses the future wrong. Delete it or never write it.

## 2. Allowed only when

An abstraction, indirection, or new moving part is justified when at least one of these is true **now**:

| Reason                            | Example                                                                                |
| --------------------------------- | -------------------------------------------------------------------------------------- |
| The current feature needs it      | The endpoint being built requires the queue                                            |
| Multiple real call sites exist    | Three services build the same pagination bounds                                        |
| Security requires it              | Central ownership/tenant check ([07](./07-security-authn-authz.md))                    |
| A layer boundary requires it      | Controller → application delegation ([01](./01-architecture-and-module-boundaries.md)) |
| External library wrapping         | Every vendor SDK behind an adapter ([12](./12-library-wrapping-and-adapters.md))       |
| Transaction orchestration         | Use case owning multi-entity writes ([03](./03-application-services-and-use-cases.md)) |
| Testing/observability requires it | A port so the clock/id-generator can be faked                                          |
| A documented decision approves it | ADR / [/memory](../memory/README.md) entry naming the reason                           |

## 3. The 1–2–3 rule

- **One use + no boundary reason** → keep it direct. No helper, no wrapper, no pattern.
- **Extraction the layer budget demands is never speculative.** When a method exceeds its size budget, trips a complexity cap, or hides a decision that belongs in `domain/`, extracting it is required by [23](./23-function-service-file-size-discipline.md) and [20 §3](./20-simple-readable-code.md) — rule 44 bans _unused abstraction_, never _readable ownership_.
- **Two real uses** → consider a helper; extract if it clarifies.
- **Three real uses** → extract to the owning helper/service/policy file ([23](./23-function-service-file-size-discipline.md)).
- **Security, auth, permissions, ownership, and error mapping** → extract **early**, even at one use, because central testability outweighs directness there ([07](./07-security-authn-authz.md), [18](./18-error-handling-and-exceptions.md)).

## 4. Minimalism never cuts safety

Deleting or skipping any of the following is **not** minimalism — it is a rule-00 violation:

DTO validation (rule 25) · `AppError`/`messageKey` (rule 26) · auth guard, permissions guard, ownership/tenant check (rules 33–35) · parameterized queries and pagination bounds (rules 31, 37) · typed config validation (rules 27, 29) · the logger adapter (rule 28) · adapter wrapping (rule 32) · fail-safe side effects and terminal states (rules 38, 39) · tests and docs with the change (rule 42).

## 5. No token-burning code

Do not burn developer reading time, reviewer time, AI context tokens, CI time, runtime resources, or team energy:

- **Avoid:** huge diffs; generated-looking boilerplate; repeated comments and repeated patterns that beg for one owner; needless wrappers, layers, DI tokens, DTO copies, adapters; tests for implementation details; needless snapshots and mocks; duplicated policy text across docs.
- **Prefer:** small focused diffs; single-owner files; short rule/skill bodies with concrete examples; tests that prove behavior; mirrors that point to the canonical file instead of restating it.

---

## 6. Checklist

- [ ] No speculative pattern, base class, factory, strategy, bus, queue, or cache without a §2 reason (rule 44)
- [ ] No unused DTO, config value, env var, adapter, provider, helper, or test shipped
- [ ] 1–2–3 rule applied; security/auth/error-mapping logic extracted early for testability
- [ ] Nothing from §4 was cut in the name of "minimal"
- [ ] Diff is small, focused, and free of boilerplate repetition
- [ ] Gates green: `npm run lint` · `npm run typecheck` · `npm run test` · `npm run test:coverage` · `npm run build`

**Related:** [20-simple-readable-code.md](./20-simple-readable-code.md) · [22-reuse-before-creating.md](./22-reuse-before-creating.md) · [23-function-service-file-size-discipline.md](./23-function-service-file-size-discipline.md) · [/skills/remove-unnecessary-code.md](../skills/remove-unnecessary-code.md) · [/skills/simplify-existing-code.md](../skills/simplify-existing-code.md) · [/memory/code-simplicity-decisions.md](../memory/code-simplicity-decisions.md)
