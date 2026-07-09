# Simple Code Map — Where Simplicity Concerns Live

> The navigation companion to [rules 20–24](../rules/README.md): where helpers, constants, decisions, and shapes belong, when to extract, and when **not** to create a new file. This file routes; the rules decide. When in doubt, [/rules/20-simple-readable-code.md](../rules/20-simple-readable-code.md) and [/rules/00-non-negotiable-rules.md](../rules/00-non-negotiable-rules.md) (rules 43–46) win.

Use this as a lookup while running the Simple Code Ladder — after step 1 ("does it need to exist?") and during step 2 ("does IronNest already have this?").

---

## 1. Where does it belong?

| You are writing…                                  | It belongs in…                                                       | Rule                                                                                                  |
| ------------------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| A pure mapper / formatter / computation           | `lib/<feature>.mappers.ts` / `.formatters.ts` / `.helpers.ts`        | [23 §3](../rules/23-function-service-file-size-discipline.md)                                         |
| A business decision / invariant / named predicate | `domain/<feature>.policy.ts` (pure, testable)                        | [01](../rules/01-architecture-and-module-boundaries.md)                                               |
| A constant / enum / type used in this module      | `model/<feature>.constants.ts` / `.enums.ts` / `.types.ts`           | [06](../rules/06-types-enums-constants.md)                                                            |
| A cross-module constant / enum / type / util      | `src/shared/{constants,enums,types,utils}` (barrel `index.ts`)       | [06](../rules/06-types-enums-constants.md)                                                            |
| A request/response shape                          | `api/dto/<name>.dto.ts` — boundary validation only                   | [05](../rules/05-dto-and-validation.md)                                                               |
| An error + `messageKey`                           | `@core/errors` subclass + `model/*.constants.ts` key pair            | [18](../rules/18-error-handling-and-exceptions.md)                                                    |
| Anything touching a vendor SDK                    | `adapters/<vendor>.adapter.ts` or the owning core module             | [12](../rules/12-library-wrapping-and-adapters.md)                                                    |
| Auth / permission / ownership logic               | The central guard chain + permission catalog — **one owner, always** | [07](../rules/07-security-authn-authz.md)                                                             |
| Pagination bounds / sort allowlists               | Named constants in `model/` + bounded query helpers                  | [04](../rules/04-repositories-and-persistence.md), [08](../rules/08-database-and-injection-safety.md) |

## 2. Service or use case?

**Service is the default** — one focused capability, ≤ 20 lines/method. Escalate to a **use case** only when both "multiple entities under one transaction" **and** "ordered post-commit events" are true. Full decision matrix: [/rules/03-application-services-and-use-cases.md](../rules/03-application-services-and-use-cases.md).

## 3. When to extract a domain helper

- The condition has more than one clause **and** carries business meaning → named predicate in `domain/`.
- The same decision appears in two-to-three places → extract now ([21 §3](../rules/21-yagni-and-minimalism.md)).
- It guards security (ownership, permissions) → extract **early**, even at one use, for central testability.
- It is one obvious comparison used once → leave it inline. Do not manufacture tiny files.

## 4. When NOT to create a new file

- An owner already exists → extend it ([22](../rules/22-reuse-before-creating.md), rule 45). Run the §1 search of that rule first.
- The abstraction has one use and no boundary reason → keep it direct (rule 44).
- The file would be a dumping ground (`utils.ts`, `misc.ts`) → name the concern or don't create it.
- The split is only to reduce line counts → split by responsibility or not at all ([23 §5](../rules/23-function-service-file-size-discipline.md)).

## 5. Task router

| Situation                                         | Skill                                                                                                                                                                                        |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Writing any new code                              | [write-simple-readable-code.md](../skills/write-simple-readable-code.md)                                                                                                                     |
| About to add a file/helper/constant/DTO/adapter   | [reuse-before-creating.md](../skills/reuse-before-creating.md)                                                                                                                               |
| File is overbuilt or hard to scan                 | [simplify-existing-code.md](../skills/simplify-existing-code.md)                                                                                                                             |
| Repeated logic / complex condition needs an owner | [extract-helper-safely.md](../skills/extract-helper-safely.md)                                                                                                                               |
| Service / use case / repository grew too large    | [split-large-service.md](../skills/split-large-service.md) / [split-large-use-case.md](../skills/split-large-use-case.md) / [split-large-repository.md](../skills/split-large-repository.md) |
| Reviewing a diff for readability                  | [review-for-readable-code.md](../skills/review-for-readable-code.md)                                                                                                                         |
| Dead or speculative code found                    | [remove-unnecessary-code.md](../skills/remove-unnecessary-code.md)                                                                                                                           |
| Clever code passes gates but exhausts readers     | [refactor-smart-code-to-boring-code.md](../skills/refactor-smart-code-to-boring-code.md)                                                                                                     |

> **Simplicity never cuts safety.** Whatever this map routes you to, DTO validation, guards, ownership checks, `AppError`/`messageKey`, adapters, bounds, tests, and docs stay (rule 46).

**Related:** [codebase-navigation.md](./codebase-navigation.md) · [architecture-map.md](./architecture-map.md) · [reference-patterns.md](./reference-patterns.md) · [../rules/20-simple-readable-code.md](../rules/20-simple-readable-code.md) · [../rules/23-function-service-file-size-discipline.md](../rules/23-function-service-file-size-discipline.md) · [../memory/code-simplicity-decisions.md](../memory/code-simplicity-decisions.md)
