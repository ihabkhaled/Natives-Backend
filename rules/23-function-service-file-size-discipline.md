# 23 — Function, Service & File Size Discipline

> **One responsibility per method, one concern per file, split by ownership — never randomly.** Complements the mechanically enforced caps (service methods ≤ 20 lines, controller one-delegation, `sonarjs/cognitive-complexity` ≤ 15, `complexity` ≤ 15, `max-depth` ≤ 3) with the judgment rules for everything the linter cannot see. Implements rule **46** of [00-non-negotiable-rules.md](./00-non-negotiable-rules.md) on top of rules 17–23 and [03-application-services-and-use-cases.md](./03-application-services-and-use-cases.md).

---

## 1. One-responsibility budget per layer

| Layer artifact    | Budget                                                                                                          |
| ----------------- | --------------------------------------------------------------------------------------------------------------- |
| Controller method | Exactly one delegation (`architecture/controller-no-logic`)                                                     |
| Use case method   | Orchestration only — reads like a **table of contents** for the operation                                       |
| Service method    | One focused capability, ≤ 20 lines (ESLint-enforced)                                                            |
| Repository method | One persistence operation / query concern — parameterized, bounded ([04](./04-repositories-and-persistence.md)) |
| Domain helper     | One pure decision                                                                                               |
| Adapter method    | One external operation ([12](./12-library-wrapping-and-adapters.md))                                            |
| DTO               | Boundary validation only ([05](./05-dto-and-validation.md))                                                     |
| Error class       | One error concern ([18](./18-error-handling-and-exceptions.md))                                                 |
| Test              | One behavior group with a scenario-stating name ([11](./11-testing-and-coverage.md))                            |

## 2. Soft limits (extract when exceeded, justify when not)

- Helper function: ideally **5–20 lines**.
- Repository method: short and bounded; repeated query fragments become allowlisted query helpers ([08](./08-database-and-injection-safety.md)).
- Use case method: readable orchestration; decisions move to `domain/`, shaping to `lib/`.
- File: split **before** it becomes hard to scan — a service past a few hundred lines gets the facade decomposition of [03](./03-application-services-and-use-cases.md).
- Test setup: move to builders/fixtures before the arrange block becomes unreadable ([/testing/test-data-and-fixtures.md](../testing/test-data-and-fixtures.md)).

## 3. Extraction routing

[03](./03-application-services-and-use-cases.md) owns the core routing table (shaping → `lib/*.mappers.ts`, formatting → `lib/*.formatters.ts`, business rules → `domain/*.policy.ts`, reusable computation → `lib/*.helpers.ts`). Additional routes:

| Bloat                                    | Extract to                                                                     |
| ---------------------------------------- | ------------------------------------------------------------------------------ |
| Complex condition                        | A named guard/predicate in `domain/` or `lib/` (reads like a question)         |
| Repeated validation support              | The DTO or a shared validator ([05](./05-dto-and-validation.md))               |
| Repeated query options / sort allowlists | A bounded query helper in `infrastructure/` or `lib/`                          |
| Repeated error mapping                   | The error class / filter mapping ([18](./18-error-handling-and-exceptions.md)) |
| Repeated permission / ownership logic    | The central permission catalog + policy ([07](./07-security-authn-authz.md))   |
| Repeated literals                        | `model/*.constants.ts` / `@shared/constants` (rule 13)                         |
| Repeated shapes                          | `model/*.types.ts` / `@shared/types` (rules 10–16)                             |

## 4. Helper-driven maintainability

> **If a change would require editing the same logic in many places, the logic belongs in one owner.** That is the test for extracting a helper — not line count fashion.

Good helper candidates: auth/ownership decisions · permission checks · pagination bounds · sort allowlists · `messageKey` building · error mapping · shared DTO validators · query-option building · config parsing · event-payload mapping · provider-response mapping · retry/backoff calculations · terminal-state checks · idempotency decisions · log-redaction helpers.

Every helper must have: a clear verb-based name · one responsibility · purity where possible · typed input/output · unit tests when it owns meaningful logic · the correct owner folder · no circular imports · no cross-module internals (rule 24) · exports only where needed.

Never create helpers that: hide architecture violations · hide side effects · wrap one obvious line · are too generic to understand (`doStuff`, `processData`) · own logic without tests.

## 5. Do not split randomly

Splitting to "reduce lines" without a responsibility seam makes code **worse**: more files, same coupling, harder navigation. Split by responsibility, keep public behavior byte-for-byte stable ([/skills/decompose-large-file.md](../skills/decompose-large-file.md)), and stop when each file has one reason to change.

---

## 6. Checklist

- [ ] Every method within its §1 budget; overflows extracted by the §3 routing, not truncated cosmetically
- [ ] Use case reads like a table of contents; decisions live in `domain/`, shaping in `lib/`
- [ ] Repeated logic has exactly one owner; helpers meet the §4 requirements and carry tests
- [ ] No random splits — each new file has one responsibility and one reason to change
- [ ] Public surfaces unchanged by pure structural refactors
- [ ] Gates green: `npm run lint` · `npm run typecheck` · `npm run test` · `npm run test:coverage` · `npm run build`

**Related:** [03-application-services-and-use-cases.md](./03-application-services-and-use-cases.md) · [20-simple-readable-code.md](./20-simple-readable-code.md) · [22-reuse-before-creating.md](./22-reuse-before-creating.md) · [/skills/extract-helper-safely.md](../skills/extract-helper-safely.md) · [/skills/split-large-service.md](../skills/split-large-service.md) · [/skills/split-large-use-case.md](../skills/split-large-use-case.md) · [/skills/split-large-repository.md](../skills/split-large-repository.md) · [/skills/decompose-large-file.md](../skills/decompose-large-file.md)
