# Code Simplicity Decisions

> Durable record of **why** IronNest enforces simple, boring, reuse-first code — the rationale behind [rules 20–24](../rules/README.md) and non-negotiable rules 43–46. Hard rules live in [00-non-negotiable-rules.md](../rules/00-non-negotiable-rules.md); this file records the standing decisions so future agents and engineers do not relitigate them.

Every line marked **Project records:** is a placeholder a concrete project fills in once. Until then, treat the stated default as the house standard.

---

## Decision: simple readable code is permanent policy

**What:** every change must be junior-readable and senior-trustworthy; the Simple Code Ladder (need → reuse → native → adapter → helper → direct → justified abstraction) runs before any new code.
**Why:** with mixed experience levels and heavy AI-agent authorship, review time and onboarding cost — not typing speed — dominate delivery cost. Boring code is the cheapest code to own.
**Specifics (this workspace):** rules [20](../rules/20-simple-readable-code.md)–[24](../rules/24-team-readable-code-review.md); mechanical backstops `complexity: 15`, `sonarjs/cognitive-complexity: 15`, `max-depth: 3`, `no-nested-ternary`, service methods ≤ 20 lines, `max-classes-per-file: 1` on layer files.
**Project records:** any project-specific threshold overrides (must be stricter, never looser) and the ADR that approved them.

---

## Decision: small code must still be safe code

**What:** minimalism means minimum **safe** code. DTO validation, auth/permission/ownership checks, `AppError`/`messageKey`, adapter wrapping, parameterized/bounded queries, observability, tests, and docs are never cut to save lines.
**Why:** "simple" that drops a guard is not simple — it is a latent incident. The cheapest failure mode to prevent is the one the checklist refuses to trade away.
**Specifics:** rule 46; MUST FIX blocker in [15 §2a](../rules/15-review-checklist.md).

---

## Decision: no clever TypeScript

**What:** no type gymnastics, unreadable conditional types, over-generic one-use helpers, or cast chains. The 30-second rule: a mid-level engineer must understand any type in 30 seconds, or it gets simplified or documented.
**Why:** clever types shift cost from the author (once) to every reader (forever) — the exact inversion of maintainable code.
**Specifics:** [20 §4](../rules/20-simple-readable-code.md); mechanical floor in [13](../rules/13-eslint-and-typescript.md) (`no-explicit-any`, `no-unnecessary-type-assertion`, `no-unnecessary-condition`).

---

## Decision: no speculative abstraction, reuse before create

**What:** abstractions require a real current reason (repetition, layer boundary, adapter, security isolation, transaction, testability). Before creating anything, search the owner and extend it — never ship a parallel duplicate. The 1–2–3 rule sets the extraction threshold; security/auth/error-mapping logic extracts early.
**Why:** speculative code guesses the future wrong and duplicates drift silently. The worst case this guards against — a forked ownership check shipping a subtly wrong copy that shadows the correct logic — is the failure mode [/rules/06-types-enums-constants.md](../rules/06-types-enums-constants.md) §6 names and [known-pitfalls](./known-pitfalls.md) J2 records as a pattern. **Project records:** link any real incident here when one occurs.
**Specifics:** rules 44–45; [21](../rules/21-yagni-and-minimalism.md), [22](../rules/22-reuse-before-creating.md); search map in [/context/simple-code-map.md](../context/simple-code-map.md).

---

## Decision: helpers are owners, not dumping grounds

**What:** a helper exists when a change would otherwise edit the same logic in many places. It has a verb-based name, one responsibility, typed input/output, tests when it owns logic, and the correct owner folder — never `utils.ts` catch-alls, never a wrapper around one obvious line.
**Why:** helper-driven maintainability collapses N-place edits into one; meaningless helpers do the opposite.
**Specifics:** [23 §4](../rules/23-function-service-file-size-discipline.md); [/skills/extract-helper-safely.md](../skills/extract-helper-safely.md).

---

## Decision: no token-burning output (human or AI)

**What:** no huge diffs, boilerplate repetition, needless wrappers/mocks/snapshots/config, or duplicated policy bodies across mirror docs. Mirrors point at the canonical file; rule and skill bodies stay short and concrete.
**Why:** reader time, reviewer time, AI context tokens, and CI minutes are shared team resources; burning them is a cost without a customer.
**Specifics:** [21 §5](../rules/21-yagni-and-minimalism.md); canonical-file rules in [/claude.md](../claude.md).

---

## Decision: rules stay canonical, skills stay procedural

**What:** the simplicity canon lives in `rules/20`–`rules/24`; the ten simplicity skills only apply it step by step. When a skill and a rule disagree, the rule wins; agent entrypoints carry a compact ladder pointer, never a restated rule body.
**Why:** one source of truth per concern — the same ownership rule the code follows.

---

## Decision checklist

- [ ] Simple Code Ladder run before new code (rule 43)
- [ ] Owner searched and reused; no parallel duplicate (rule 45)
- [ ] No speculative abstraction; 1–2–3 rule applied (rule 44)
- [ ] Boring direct version chosen; no clever TypeScript (rule 46)
- [ ] Nothing safety-relevant cut in the name of minimalism (rule 46)

**Related:** [known-pitfalls.md](./known-pitfalls.md) · [ai-context-map.md](./ai-context-map.md) · [../rules/20-simple-readable-code.md](../rules/20-simple-readable-code.md) · [../rules/21-yagni-and-minimalism.md](../rules/21-yagni-and-minimalism.md) · [../rules/22-reuse-before-creating.md](../rules/22-reuse-before-creating.md) · [../rules/23-function-service-file-size-discipline.md](../rules/23-function-service-file-size-discipline.md) · [../rules/24-team-readable-code-review.md](../rules/24-team-readable-code-review.md) · [../context/simple-code-map.md](../context/simple-code-map.md)
