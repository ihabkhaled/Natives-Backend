# 22 — Reuse Before Creating

> **Before adding any new file, helper, constant, DTO, enum, adapter, service, or fixture — search for the owner.** Extend the correct existing owner; refactor a wrong owner; never ship a parallel duplicate. Implements rule **45** of [00-non-negotiable-rules.md](./00-non-negotiable-rules.md) and generalizes the no-duplicate-helper rule of [06 §6](./06-types-enums-constants.md) from constants/util files to **every reusable concern**.

---

## 1. The mandatory search

Run this search before creating anything new. It is step 2 of the Simple Code Ladder ([20 §2](./20-simple-readable-code.md)).

| Looking for…                                   | Search first                                                                                      |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Cross-module constants / enums / types / utils | `src/shared/constants`, `src/shared/enums`, `src/shared/types`, `src/shared/utils`                |
| Cross-cutting infrastructure                   | `src/core/*` (auth, logger, errors, validation, openapi, clock, id-generator, health, rate-limit) |
| Module-local types / enums / constants         | the module's `model/` (`*.types.ts`, `*.enums.ts`, `*.constants.ts`)                              |
| Pure helpers / mappers / formatters            | the module's `lib/`                                                                               |
| Business decisions / invariants                | the module's `domain/`                                                                            |
| Request/response shapes                        | the module's `api/dto/`                                                                           |
| Error classes and message keys                 | `src/core/errors/*` and the module's `model/*.constants.ts` (`errors.<feature>.<key>`)            |
| Vendor access                                  | existing `adapters/` and the vendor swap surfaces ([12](./12-library-wrapping-and-adapters.md))   |
| Existing repositories / services / use cases   | sibling feature modules ([/context/codebase-navigation.md](../context/codebase-navigation.md))    |
| Test fixtures and builders                     | colocated `*.spec.ts` setups and `test/`                                                          |
| The canonical shape to copy                    | [/context/reference-patterns.md](../context/reference-patterns.md)                                |
| Known traps in this area                       | [/memory/known-pitfalls.md](../memory/known-pitfalls.md)                                          |

## 2. Never duplicate

A second, parallel implementation of any of these is a defect, even if it "works":

constants · enums · message keys · guards · validators · query helpers · pagination logic · error handling/mapping · repository helpers · auth/permission/ownership logic · logger wrappers · config parsing · adapter clients · mocks for the same dependency ("one mock surface per dependency", [12](./12-library-wrapping-and-adapters.md)).

> **Duplicated safety logic is the worst duplicate.** A forked ownership check or permission matrix drifts silently and ships a subtly wrong copy — the failure mode [06 §6](./06-types-enums-constants.md) warns about. Security logic has one owner, always.

## 3. When the existing owner is wrong

Finding an owner that is misplaced or misshapen does **not** authorize a parallel file. Instead:

1. Write or adjust tests for the current behavior first (rule 42).
2. Refactor the owner in place — correct home, correct shape ([/skills/decompose-large-file.md](../skills/decompose-large-file.md)).
3. Update imports through public surfaces only (`index.ts` barrels, rule 24).
4. Update the module docs and any affected memory/context entries in the same change.
5. **Wrong home ≠ valid home** — but two homes is always worse than one wrong home being fixed.

---

## 4. Checklist

- [ ] §1 search completed before every new file/helper/constant/DTO/enum/adapter/fixture (rule 45)
- [ ] Existing owner extended, or wrong owner refactored — no parallel duplicate created
- [ ] No duplicate constant, validator, query helper, error mapping, or permission logic (§2)
- [ ] New public surface exported only through the owner's `index.ts` where one exists
- [ ] Tests updated with any refactored owner; docs and memory updated in the same change
- [ ] Gates green: `npm run lint` · `npm run typecheck` · `npm run test` · `npm run test:coverage` · `npm run build`

**Related:** [06-types-enums-constants.md](./06-types-enums-constants.md) · [20-simple-readable-code.md](./20-simple-readable-code.md) · [21-yagni-and-minimalism.md](./21-yagni-and-minimalism.md) · [/skills/reuse-before-creating.md](../skills/reuse-before-creating.md) · [/context/simple-code-map.md](../context/simple-code-map.md) · [/memory/known-pitfalls.md](../memory/known-pitfalls.md)
