# Bug Triage & Retest Standard

> How a defect is classified, reproduced, root-caused, fixed, and retested — with a failing test **first** and no defect closed without a verified retest. This implements the testing canon ([/testing/testing-strategy.md](./testing-strategy.md)) and [/rules/11-testing-and-coverage.md](../rules/11-testing-and-coverage.md) #1 (bug fixes ship a reproducing regression test) under [/rules/00-non-negotiable-rules.md](../rules/00-non-negotiable-rules.md) #42 (no behavior change without tests + docs).

A bug is not fixed when the symptom disappears. It is fixed when the root cause is understood, a test reproduces it (red → green), regression covers it, and the original reproduction steps now produce the expected behavior. Triage is the same disciplined pipeline as a feature — only the entry point differs.

---

## 1. Lifecycle at a glance

```text
Open → In Progress → Fixed → (retest) → Verified → Closed
                                  ↓ fails
                              Reopened → In Progress
```

| Status | Meaning | Who sets it |
| --- | --- | --- |
| Open | Reported, awaiting triage/assignment | Reporter |
| In Progress | A reproducing test is being written and the fix is underway | Engineer |
| Fixed | Fix committed; reproducing test now green; gates pass | Engineer |
| Verified | Retest of the exact steps passed | Reporter / QA |
| Closed | Adjacency + regression passed; merged | Reporter / QA |
| Reopened | Symptoms recurred or fix was incomplete | Reporter / QA |

The order is non-negotiable: **reproduce → write failing test → root-cause → fix → retest**. Skipping any step is how a "fix" ships that only masks a symptom.

---

## 2. Defect report — required fields

An incomplete report is returned to the reporter before triage. Capture, at minimum:

| Field | Notes |
| --- | --- |
| Id | Sequential `BUG-<n>`; link the request artifact and PR |
| Title | Specific and searchable — see below |
| Severity | `S1`–`S4` (impact; §3) |
| Priority | `P0`–`P3` (urgency; §4) |
| Module / feature | The `src/modules/<feature>` and layer involved |
| Found in | Commit / branch / release |
| Environment | Local, CI, staging, production |
| Actor / role | The role and tenant under which it reproduces |
| Steps to reproduce | Exact, numbered, no "sometimes" |
| Expected vs actual | What should happen vs what happens |
| Evidence | Sanitized logs, request/response sample, screenshots — never raw secrets/PII |
| Root cause | Filled by the engineer after investigation (§6) |

**Titles** name the module, the action, and the symptom — they are searchable:

| Bad | Good |
| --- | --- |
| Orders broken | `Order: 500 on POST /orders when items array is empty` |
| Login bug | `Auth: login accepts empty password and returns 500 instead of 400` |
| List is wrong | `Invoice: GET /invoices ignores the pagination cap and returns all rows` |

---

## 3. Severity — impact on the system

Severity is assigned by the reporter and confirmed at triage. It describes harm, independent of how fast we choose to fix it.

| Sev | Definition | Illustrative examples |
| --- | --- | --- |
| **S1 — Critical** | System unusable, data lost/corrupted, or security compromised; no workaround | Auth bypass or token/secret in a response or log; ownership/tenant check missing so actor A reads actor B's records (IDOR); a migration destroys data; events permanently lost to a dead-letter queue |
| **S2 — Major** | A primary workflow is blocked; any workaround is unreliable or needs many steps | A core route always 500s; a use-case commits the entity but the post-commit event never fires; pagination cap ignored so a list query is unbounded |
| **S3 — Minor** | Secondary workflow degraded; a simple workaround exists | Wrong total count but correct page; a non-blocking error surfaces an untranslated `messageKey`; a duplicate event handled but logged twice |
| **S4 — Cosmetic** | No functional impact | Off-by-one in a non-load-bearing label; an inconsistent log prefix; a typo in a non-user-facing string |

A latent **security or data-integrity** defect is **S1 even with no live impact** — the absence of an exploit is not the absence of the hole.

---

## 4. Priority — urgency to fix

Priority is set at triage from severity, blast radius, and release timeline.

| Pri | Meaning | Default response |
| --- | --- | --- |
| **P0 — Blocker** | Any S1; anything blocking other testing or causing production data loss/security exposure | Fix starts immediately; treat as a hotfix |
| **P1 — Critical** | Most S2; S3 on critical-path features (auth, payments, ownership) | Fix this sprint; cannot ship without it |
| **P2 — Major** | Remaining S2 with reliable workarounds; S3 on secondary features | This sprint if capacity allows, else next with justification |
| **P3 — Minor** | All S4; S3 with trivial workarounds on rarely-used paths | Backlog |

### Severity → priority matrix

| | P0 | P1 | P2 | P3 |
| --- | --- | --- | --- | --- |
| **S1** | Always | — | — | — |
| **S2** | If it blocks release | Default | If a workaround exists | — |
| **S3** | If it blocks other testing | If critical-path | Default | If trivial workaround |
| **S4** | — | — | If demo-visible | Default |

**Disputes:** escalate to the technical owner; default to the **higher** severity until resolved; record the rationale for the final call.

---

## 5. Reproduce before you fix

No fix attempt begins until the bug reproduces from the reported steps. A bug you cannot reproduce, you cannot prove fixed.

If it won't reproduce, vary one axis at a time:

- **Environment** — local vs CI vs staging.
- **Role / tenant** — try each role; cross-tenant data; the actor from the report.
- **State** — empty store vs seeded vs the exact data shape in the report.
- **Timing** — repeat rapidly to surface a race; concurrent/duplicate requests for idempotency bugs.
- **Boundary** — at, above, and below limits (the list cap of 100, max string length, empty arrays).

If it is genuinely intermittent, document the reproduction rate (e.g. "3/10"), add structured logging via the `@core/logger` adapter to capture the conditions, and **do not close it as "cannot reproduce"** while the rate is non-zero.

```text
Reproducible ⇔  steps are exact · environment + role + tenant fixed · starting state stated · observed every run (or rate recorded)
```

---

## 6. Root-cause categories

Classify every fix so recurring classes surface. Most categories map to a rule that should have prevented them — the fix usually closes a rule gap, not just one line.

| Category | Symptom | Rule it points back to |
| --- | --- | --- |
| Logic error | Wrong result from a service/domain policy | [/rules/03](../rules/03-application-services-and-use-cases.md) |
| Missing validation | A bad payload reaches the service instead of `400` | [/rules/05](../rules/05-dto-and-validation.md) |
| Missing null/undefined handling | Crash on an absent optional field (strict mode would catch most) | [/rules/13](../rules/13-eslint-and-typescript.md) |
| Wrong enum / magic string | Domain value compared against a raw literal | [/rules/06](../rules/06-types-enums-constants.md) |
| Race / ordering | Concurrent or duplicate operations corrupt state | [/rules/19](../rules/19-async-events-and-jobs.md) |
| Missing transaction / event | Use-case commits but post-commit event is lost | [/rules/03](../rules/03-application-services-and-use-cases.md), [/rules/19](../rules/19-async-events-and-jobs.md) |
| Authorization gap | Auth without permissions, or no ownership/tenant check (IDOR) | [/rules/07](../rules/07-security-authn-authz.md) |
| Injection / unbounded query | Unparameterized SQL or a missing list cap | [/rules/08](../rules/08-database-and-injection-safety.md) |
| Error leakage | Stack/SQL/secret reaches the client; missing `messageKey` | [/rules/18](../rules/18-error-handling-and-exceptions.md) |
| Config / env error | Misread or unvalidated config; `process.env` outside `config/` | [/rules/17](../rules/17-configuration-and-environment.md) |
| Adapter / dependency | Vendor SDK called outside an adapter, or its contract drifted | [/rules/12](../rules/12-library-wrapping-and-adapters.md) |
| Missing i18n | User-facing text bypasses a `messageKey` | [/rules/16](../rules/16-i18n-and-messaging.md) |
| Schema / contract mismatch | DTO, model, and migration disagree | [/rules/04](../rules/04-repositories-and-persistence.md), [/rules/05](../rules/05-dto-and-validation.md) |

Deep-dive procedure: [/skills/investigate-production-bug.md](../skills/investigate-production-bug.md).

---

## 7. Reproduce with a failing test — first

The defining rule of this standard: **before touching the production code, write a test that reproduces the bug.** It must be red for the right reason — failing because of the defect, not a typo. Then make it green with the fix. If you revert the fix, the test must fail again; that is the proof it guards the regression forever.

Pick the layer where the defect actually lives — fix it at the lowest layer that owns the logic, not at the boundary that surfaced it:

| Bug lives in | Reproduce with | Standard |
| --- | --- | --- |
| Service / use-case / domain logic | Unit test (`@nestjs/testing` + `vi` doubles) | [/testing/unit-testing-standard.md](./unit-testing-standard.md) |
| Controller, DTO validation, guard chain | Integration test (supertest through the real pipeline) | [/testing/integration-testing-standard.md](./integration-testing-standard.md) |
| Repository query / boundedness | Repository test against a real test DB | [/testing/integration-testing-standard.md](./integration-testing-standard.md) |
| Cross-module workflow | E2E test | [/testing/e2e-testing-standard.md](./e2e-testing-standard.md) |

```typescript
// DO — red first: this fails on the buggy code, passes once the ownership check is added.
// Bug: GET /orders/:id returned another tenant's order (IDOR).
it('should throw OrderForbiddenError when the order belongs to another user', async () => {
  repo.findById.mockResolvedValue(orderOwnedBy('user-2'));
  await expect(service.getOrder('order-1', 'user-1')).rejects.toBeInstanceOf(OrderForbiddenError);
});
```

```typescript
// DON'T — assert the symptom is gone without proving the cause. This passes even if the fix
// only swallowed the error, and it never goes red if the bug returns. It guards nothing.
it('should not crash', async () => {
  await expect(service.getOrder('order-1', 'user-1')).resolves.toBeDefined();
});
```

---

## 8. Fix requirements

A fix may not move to **Fixed** until all hold:

1. **Covering test** — the reproducing test from §7 is committed and green; reverting the fix turns it red.
2. **Root-caused** — the §6 category is recorded; the fix addresses the cause, not the symptom. No silent `catch`, no broadened type, no weakened assertion to make a test pass.
3. **Layer-matched** — the fix sits in the layer that owns the logic and respects the boundaries in [/rules/01](../rules/01-architecture-and-module-boundaries.md). A controller bug is rarely fixed in the controller.
4. **Class, not instance** — if the cause is a recurring pattern (a missing ownership check, an untranslated key), sweep adjacent code for the same hole and cover the representative cases.
5. **Scenario expansion** — add the unhappy/boundary scenarios the original suite was missing (§6 of [/rules/11](../rules/11-testing-and-coverage.md)), not just the single reproducer.
6. **No new debt** — gates green: `lint`, `typecheck`, `test`, `test:coverage` (≥ 95% on touched files), `build`. No `--no-verify`.
7. **Docs in the same change** — if behavior changed, update the feature docs and the relevant rule/memory note; record the pattern in [/memory/known-pitfalls.md](../memory/known-pitfalls.md).

---

## 9. Retest — no defect closed without it

A fix is the engineer's claim; the retest is the proof.

- **R1 — Same reporter retests.** The person who found it verifies it; they know the exact conditions and can tell a real fix from a similar-looking symptom.
- **R2 — Exact steps.** Follow the reported steps verbatim — no shortcuts, no alternative path. The original steps must now produce the expected behavior.
- **R3 — Adjacency check.** Verify the features that share the changed code path. A fix in a use-case means re-checking every route that triggers it; a shared service or adapter change means checking more than one consumer. Map dependencies with [/context/codebase-navigation.md](../context/codebase-navigation.md).
- **R4 — Regression for S1/S2.** Run the full automated suite plus the affected feature pack and its adjacency, per [/testing/testing-strategy.md](./testing-strategy.md). Re-run the *pack*, not just the one failing test — a real regression rarely arrives alone.
- **R5 — Layer-matched verification.** Verify through the layer where the bug lived: re-issue the API request and assert the contract; query persisted state after a write; for a fire-and-forget side effect, assert the terminal outcome (delivered, or failed-and-logged — never silently dropped).

```text
S3 / S4  →  R1 + R2 + R3
S1 / S2  →  R1 + R2 + R3 + R4 + R5  (full regression mandatory before Close)
```

A defect may move to **Closed** only when: the exact-steps retest passed · adjacency verified · regression green (S1/S2) · the covering test exists and passes · no new defect introduced · the change is merged.

---

## 10. Reopening — trust erosion

Reopen the **same** defect (do not file a new one) when the same symptoms recur, the original steps reproduce it again, or the covering test now fails.

1. Append the new evidence (commit, logs, steps) to the original report — never overwrite the failing history.
2. **Raise severity by one level** — a defect that escaped a "fix" has shown the previous fix and its test were inadequate.
3. Return to **In Progress**; the new fix must explain why the first reproducing test did not catch the recurrence and must add the case that does.

---

## 11. Hotfix track (P0/S1)

Hotfixes are **faster, not looser** — every step still exists.

- Triage and root-cause are compressed in time, never skipped.
- The reproducing test is still written first; for a true production fire, capture the exact reproduction steps and residual risk in the artifact and backfill the automated test in the same PR before merge.
- Rollback readiness matters **more**, not less: confirm the change is reversible and observable before deploy ([/rules/10](../rules/10-reliability-and-durability.md)).
- A retrospective is mandatory; the durable lesson lands in [/memory/known-pitfalls.md](../memory/known-pitfalls.md) and, if it is a permanent rule, in the relevant rule file.

---

## Quality gate

```bash
npm run lint            # 0 errors AND 0 warnings
npm run typecheck       # tsgo --noEmit, project-wide
npm run test            # vitest — reproducing test green; revert the fix → it goes red
npm run test:coverage   # ≥ 95% on touched files; critical paths near 100%
npm run build           # compiles clean
```

## Checklist

- [ ] Report complete: severity, priority, module/layer, exact steps, role/tenant, environment, sanitized evidence
- [ ] Severity (impact) and priority (urgency) assigned via the matrix; disputes default higher and are recorded
- [ ] Bug reproduced from the reported steps (or reproduction rate documented)
- [ ] Root-cause category recorded; fix targets the cause, not the symptom
- [ ] **Reproducing test written first**, red for the right reason, green after the fix, red again if reverted
- [ ] Fix sits at the owning layer; adjacent instances of the same class swept and covered
- [ ] Gates green; touched-file coverage ≥ 95%; docs + [/memory/known-pitfalls.md](../memory/known-pitfalls.md) updated
- [ ] Retest by the same reporter using exact steps; adjacency checked; regression run for S1/S2
- [ ] Reopens raise severity and explain the gap the prior test missed
- [ ] No defect marked Closed without a verified retest

**Related:** [/testing/testing-strategy.md](./testing-strategy.md) · [/testing/quality-gates.md](./quality-gates.md) · [/testing/coverage-policy.md](./coverage-policy.md) · [/testing/test-data-and-fixtures.md](./test-data-and-fixtures.md) · [/rules/11-testing-and-coverage.md](../rules/11-testing-and-coverage.md) · [/skills/investigate-production-bug.md](../skills/investigate-production-bug.md) · [/agents/backend-test-engineer.md](../agents/backend-test-engineer.md) · [/memory/known-pitfalls.md](../memory/known-pitfalls.md)
