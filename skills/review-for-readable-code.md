# Skill: Review for Readable Code

## Intent

Read the diff as the next maintainer, answer the nineteen questions, and report file-anchored MUST FIX/SHOULD FIX/FOLLOW-UP findings.

## When to use

Run before every PR, after AI-generated/refactored code, before merging governance changes, or whenever a reviewer cannot scan the diff.

## When not to use

This skill reports. Use simplification/refactor/security skills to implement fixes; do not substitute a readability review for dedicated security or QA execution.

---

## Rules this skill enforces

- **The nineteen questions gate every merge.** Each applicable question answers yes, or the "no" becomes a finding ([24 §1](../rules/24-team-readable-code-review.md), rule 46).
- **Complexity is fixed, never explained.** If the code needs an essay in the PR description, the code is the defect ([24 §2](../rules/24-team-readable-code-review.md)).
- **Findings use blocker language.** MUST FIX / SHOULD FIX / FOLLOW-UP, file-anchored, exactly as [15-review-checklist.md](../rules/15-review-checklist.md) defines them.
- **Reuse and size discipline apply to the diff.** Duplicate owners and oversized methods are findings ([22-reuse-before-creating.md](../rules/22-reuse-before-creating.md), [23-function-service-file-size-discipline.md](../rules/23-function-service-file-size-discipline.md)).
- **Simplicity never cuts safety.** DTO validation, auth/permission/ownership checks, `AppError`/`messageKey`, adapters, parameterized/bounded queries, tests, and docs always stay — cutting any is MUST FIX (rule 46).

---

## Step 1 — Read the diff as the next maintainer, not the author

Forget why the code works. Read the touched flow cold, end to end (controller → application → domain → repository → adapter):

```bash
git diff --stat origin/main...HEAD
git diff origin/main...HEAD
```

If you need the PR description to understand the diff, that is already a finding. Check [../memory/known-pitfalls.md](../memory/known-pitfalls.md) for defects this codebase has shipped before.

## Step 2 — Walk the nineteen questions

Walk [24 §1](../rules/24-team-readable-code-review.md) top to bottom — do not restate them, answer them. Lint and typecheck give **partial** mechanical help on some questions and answer **none of them outright**. Four require a human read with no mechanical proxy at all:

- **Q1 — junior-followable.** Can a junior backend engineer follow the flow without a guide?
- **Q2 — senior-trustworthy boundaries.** Can a senior trust the layer/module boundaries at a glance?
- **Q14 — readable tests.** Scenario-stating names, no mystery setup, mocks only at the adapter/repository boundary?
- **Q17 — next-change-easy.** Is the **next** change to this code easy, or did this diff paint it into a corner?

A green build proves none of these. **Q9** (auth/permission/ownership checks preserved), **Q11** (existing owners reused), **Q16** (no speculative abstraction), and **Q18** (docs updated) have no lint rule behind them either — and **Q9 is the safety-critical one**: a dropped guard, the rule-46 nightmare case, is visible only to a reader. Never delegate Q9 to the toolchain.

## Step 3 — Tests FIRST — verify they exist and read like scenarios

Before hunting style defects, confirm the behavior is pinned: every behavior change ships tests in the same diff (rule 42), every bug fix carries a regression test that failed before the fix, and refactors carry characterization tests proving behavior did not move. Missing tests for changed behavior ⇒ **MUST FIX** — route the author to [write-unit-tests.md](./write-unit-tests.md). Unreadable tests fail Q14 and are findings too.

## Step 4 — Hunt the defect classes

Sweep the diff for each class ([24 §3](../rules/24-team-readable-code-review.md)) and name the fix skill in the finding:

- **Unnecessary code to remove** — dead branches, speculative hooks, unused params → [remove-unnecessary-code.md](./remove-unnecessary-code.md) ([21](../rules/21-yagni-and-minimalism.md))
- **Duplicate owners to merge** — a parallel helper/constant/mapper beside the existing owner → [reuse-before-creating.md](./reuse-before-creating.md) ([22](../rules/22-reuse-before-creating.md))
- **Unclear names** — rename until the comment is unnecessary ([20 §3](../rules/20-simple-readable-code.md))
- **Long methods / god files** → [extract-helper-safely.md](./extract-helper-safely.md) · [decompose-large-file.md](./decompose-large-file.md) ([23](../rules/23-function-service-file-size-discipline.md))
- **Clever TypeScript** — nested ternaries, dense chains, type gymnastics → [refactor-smart-code-to-boring-code.md](./refactor-smart-code-to-boring-code.md) ([20 §4](../rules/20-simple-readable-code.md))
- **Missing helpers for repeated logic** — the same 3 lines in two places with no owner → [extract-helper-safely.md](./extract-helper-safely.md)
- **Missing tests · missing docs** — MUST FIX (rule 42)
- **Safety gaps** — **always MUST FIX** (rule 46)

```ts
// Don't — raw status literal (rule 9) + nested ternary (`no-nested-ternary`) + no owner.
// Both are MUST FIX: each violates a non-negotiable rule and fails the hard lint gate.
// src/modules/article/application/article.service.ts
return articles.map(a => ({
  ...a,
  label: a.status === 'published' ? 'live' : a.deletedAt ? 'gone' : 'draft',
}));

// Do — enum comparison, simple branches, named mapper with one owner
// src/modules/article/lib/article.mappers.ts
export function toArticleLabel(article: Article): ArticleLabel {
  if (article.status === ArticleStatus.Published) {
    return ArticleLabel.Live;
  }
  return isDeleted(article) ? ArticleLabel.Gone : ArticleLabel.Draft;
}
```

> **Severity comes from the rule, not from how the defect looks.** A domain string comparison (rule 9) and a nested ternary both break a non-negotiable rule and a hard gate ⇒ **MUST FIX**, never SHOULD FIX ([15 §1, §3](../rules/15-review-checklist.md)). SHOULD FIX is for real defects that violate no non-negotiable — an unclear name, a missing helper, an oversized-but-legal method.

```ts
// Don't — the "simplified" lookup dropped tenant scoping (safety gap ⇒ MUST FIX, rule 46)
// src/modules/article/application/get-article.use-case.ts
const article = await this.articles.findById(id);

// Do — ownership stays; simplicity never cuts a guard, and "not yours" reads as not found
const article = await this.articles.findByIdAndTenant(id, user.tenantId);
if (article === null) throw new ArticleNotFoundError(id); // errors.article.notFound
```

## Step 5 — Report file-anchored findings

Every finding names **file, line, defect class, rule, and severity** — "feels complex" is not actionable. Use the blocker language of [15](../rules/15-review-checklist.md): **MUST FIX** blocks merge, **SHOULD FIX** is fixed now or explicitly acknowledged, **FOLLOW-UP** only with an owner and due date.

## Step 6 — Verify fixes landed

Re-read the amended diff with the same cold eyes. A paragraph of justification in the PR description is **not** a resolution — complexity is never "explained away" ([24 §2](../rules/24-team-readable-code-review.md)). A finding closes when the code changed, the tests/docs moved with it, and the gates are green.

## What the review must produce

A finding list — every entry anchored `path:line` and classed:

| Finding category                                                                                         | Severity              |
| -------------------------------------------------------------------------------------------------------- | --------------------- |
| Safety gap — validation, guard, ownership, `AppError`/`messageKey`, adapter, bounds, test, or doc cut    | **MUST FIX** — always |
| Missing tests or missing docs for changed behavior                                                       | **MUST FIX**          |
| Any non-negotiable-rule violation (domain string literal, inline declaration, nested ternary, `any`, …)  | **MUST FIX**          |
| Duplicate owner · unclear name · long method · clever TypeScript · missing helper · unnecessary new code | **SHOULD FIX**        |
| Pre-existing debt found while reading, with an owner and due date                                        | **FOLLOW-UP**         |

Close with a verdict: **merge-ready**, or blocked on the open MUST FIXes.

---

## Checklist

- [ ] Nineteen questions answered against real code/tests, not author explanation.
- [ ] Declaration owners, clever types, duplicate helpers, and token cost reviewed.
- [ ] Security/validation/auth/ownership/tests/docs gaps are MUST FIX.
- [ ] Every finding has path, line, rule, severity, and fix direction.
- [ ] Closed findings were re-read and gates rerun.

## Quality gates

```bash
npm run lint
npm run typecheck
npm run test
npm run test:coverage
npm run build
```

Never bypass Husky with `--no-verify`.

## Pitfalls

- **Reviewing with author context in your head.** You already know why it works, so everything reads fine ⇒ read cold; if the diff needs the description, file the finding.
- **Accepting a justification paragraph as a fix.** Explained complexity merges as complexity ⇒ keep the finding open until the code changes ([24 §2](../rules/24-team-readable-code-review.md)).
- **Downgrading a safety gap because the diff got smaller.** A dropped guard/DTO/bound is a rule-46 violation ⇒ always MUST FIX, never FOLLOW-UP.
- **Findings without file anchors.** Vague verdicts produce vague fixes ⇒ every finding names file, line, class, rule, severity.
- **Trusting green gates as readability proof.** The linter cannot answer Q1/Q2/Q14/Q17 ⇒ the human read is the gate.
- **Skipping the review for docs/rules diffs.** Unreadable rules breed unreadable code ⇒ same walk, same blocker language.
- **FOLLOW-UP as a landfill.** No owner + due date means it never happens ⇒ without both, it stays SHOULD FIX.

## Related

[write-simple-readable-code.md](./write-simple-readable-code.md) · [simplify-existing-code.md](./simplify-existing-code.md) · [refactor-smart-code-to-boring-code.md](./refactor-smart-code-to-boring-code.md) · [remove-unnecessary-code.md](./remove-unnecessary-code.md) · [reuse-before-creating.md](./reuse-before-creating.md) · [extract-helper-safely.md](./extract-helper-safely.md) · [security-review.md](./security-review.md) · [final-validation.md](./final-validation.md) · [../rules/24-team-readable-code-review.md](../rules/24-team-readable-code-review.md) · [../rules/15-review-checklist.md](../rules/15-review-checklist.md) · [../rules/20-simple-readable-code.md](../rules/20-simple-readable-code.md) · [../context/simple-code-map.md](../context/simple-code-map.md) · [../memory/known-pitfalls.md](../memory/known-pitfalls.md) · [README.md](./README.md)
