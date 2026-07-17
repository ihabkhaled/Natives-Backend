# 24 — Team-Readable Code Review

> **Every change must be junior-readable and senior-trustworthy before it merges.** This is the readability gate that feeds the consolidated pre-merge checklist in [15-review-checklist.md](./15-review-checklist.md). Implements rule **46** of [00-non-negotiable-rules.md](./00-non-negotiable-rules.md). Backs [/agents/backend-code-reviewer.md](../agents/backend-code-reviewer.md) and [/skills/review-for-readable-code.md](../skills/review-for-readable-code.md).

Use the blocker language of [15](./15-review-checklist.md): **MUST FIX** for safety/architecture regressions, **SHOULD FIX** for readability defects, **FOLLOW-UP** only with an owner and due date.

---

## 1. The nineteen questions

Every reviewed change must answer **yes** to each applicable question:

- [ ] 1. Can a junior backend engineer follow the flow?
- [ ] 2. Can a senior backend engineer trust the boundaries?
- [ ] 3. Is the controller still thin (one delegation per method)?
- [ ] 4. Is the use case only orchestration?
- [ ] 5. Is the service focused (≤ 20 lines/method)?
- [ ] 6. Is the repository persistence-only and bounded?
- [ ] 7. Are DTOs doing boundary validation?
- [ ] 8. Are `AppError`s and `messageKey`s clear and complete?
- [ ] 9. Are auth/permission/ownership checks preserved?
- [ ] 10. Are external libraries still behind app-owned ports/adapters, with vendor types contained?
- [ ] 11. Did we reuse existing owners ([22](./22-reuse-before-creating.md))?
- [ ] 12. Did we avoid inline/anonymous declarations and duplicate constants/helpers ([30](./30-declaration-ownership.md))?
- [ ] 13. Are functions short ([23](./23-function-service-file-size-discipline.md))?
- [ ] 14. Are tests readable (scenario-stating names, no mystery setup)?
- [ ] 15. Did we avoid clever TypeScript and pass the 30-second type rule ([25](./25-no-clever-typescript.md))?
- [ ] 16. Did we avoid speculative abstractions ([21](./21-yagni-and-minimalism.md))?
- [ ] 17. Is the **next** change easy, with one owner and no token-burning indirection?
- [ ] 18. Are docs updated?
- [ ] 19. Are gates green?

## 2. When any answer is no

Refactor, rename, extract a helper, remove unnecessary code, update tests, update docs — **do not explain complexity away.** A paragraph of justification in the PR description is not a substitute for readable code; if the code needs an essay, the code is the defect.

> **A green build is not proof of readability.** Questions 1, 2, 14, and 17 require actually reading the diff as the next maintainer would — the linter cannot answer them.

## 3. What the reviewer reports

The review output names, with file anchors: unnecessary code to remove · duplicate owners to merge · unclear names to improve · long methods to split · clever TypeScript to simplify · missing helpers (repeated logic without an owner) · missing tests · missing docs · safety gaps (always MUST FIX).

---

## 4. Checklist

- [ ] All nineteen questions answered yes, or the "no"s carry MUST FIX / SHOULD FIX findings
- [ ] No complexity "explained away" in prose instead of fixed in code
- [ ] Findings are file-anchored and use the 15-review blocker language
- [ ] Gates green: `npm run lint` · `npm run typecheck` · `npm run test` · `npm run test:coverage` · `npm run build`

**Related:** [15-review-checklist.md](./15-review-checklist.md) · [20-simple-readable-code.md](./20-simple-readable-code.md) · [25-no-clever-typescript.md](./25-no-clever-typescript.md) · [26-helper-driven-maintainability.md](./26-helper-driven-maintainability.md) · [27-no-token-burning-code.md](./27-no-token-burning-code.md) · [28-codebase-refactor-discipline.md](./28-codebase-refactor-discipline.md) · [30-declaration-ownership.md](./30-declaration-ownership.md) · [/skills/review-for-readable-code.md](../skills/review-for-readable-code.md) · [/agents/backend-code-reviewer.md](../agents/backend-code-reviewer.md)
