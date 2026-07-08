# Memory — Release Checklist (Gates, Rollback, Observability, Approvals)

> Durable convention for how a change ships in this NestJS workspace: the hard gates it must pass, the rollback it must carry, the observability it must emit, and the approvals it must record. This memory ties the [SDLC policy](../claude.md) (phases 22–26) to the executable [review checklist](../rules/15-review-checklist.md) and is the source the [release gatekeeper](../agents/backend-release-gatekeeper.md) cross-checks. Decisions below are house standard; concrete projects fill the **Project records:** lines with their own specifics.

## Decision

A change is releasable only when **all** of the following hold, in order. A green CI run is necessary, not sufficient — behavior must be proven to move with its tests and docs, the change must be reversible, and the required humans must have signed off. Gates may compress timing for a hotfix; they never switch off (rule 42, [00-non-negotiable-rules.md](../rules/00-non-negotiable-rules.md)).

**Rationale.** Releases fail in predictable ways: a stale doc, a missing rollback, an absent ownership check, a forgotten locale, an unwatched failure mode. Encoding the gate as standing memory removes "looks green" optimism and makes the go/no-go decision a checklist a person — or an agent — runs the same way every time.

---

## 1. Hard gates — all green, no exceptions

These map 1:1 to the Husky `pre-push` hook and CI. Run them yourself and report failures with the command, the failing file(s), and the exact error — never claim green when a gate is red.

```bash
npm run lint            # 0 errors AND 0 warnings
npm run typecheck       # tsgo --noEmit, project-wide (not just staged)
npm run test            # vitest
npm run test:coverage   # ≥95% statements/branches/functions/lines; critical paths ~100%
npm run build           # nest build -p tsconfig.build.json
```

- Run integration/e2e suites when routes, persistence, migrations, or integrations changed.
- Touched-module coverage is proven, not hidden behind a high global average ([/testing/coverage-policy.md](../testing/coverage-policy.md)).
- Never bypass a hook with `--no-verify`. An emergency bypass is recorded: why, who approved, what was skipped, when it is restored ([stack-and-toolchain.md](../context/stack-and-toolchain.md)).

> **Project records:** authoritative CI workflow path, required-check names, and any project-specific suites (load, contract, snapshot) that join the gate.

## 2. Diff hygiene

- Staged with explicit paths — never `git add .`; `git diff --check` is clean.
- No secrets, tokens, certificates, `.env*`, credential files, data dumps, raw production data, `dist/`, or `coverage/` staged.
- Diff is scoped to one request/workstream; no unrelated refactors, dependency churn, or formatting noise smuggled in.
- No rule weakened, no useful docs deleted, no test deleted or skipped to make a gate pass.
- Commit messages follow Conventional Commits; commit/push only after the user approves the reviewed diff.

## 3. Behavior, security & i18n moved with the change

- Behavior change ships with its tests in the same change; every bug fix carries a regression test that **failed before** and **passes after** (rule 42, [11-testing-and-coverage.md](../rules/11-testing-and-coverage.md)).
- Protected routes chain **auth guard + permissions (RBAC) guard + ownership/tenant check**; identity comes from the verified token, never the client body ([07-security-authn-authz.md](../rules/07-security-authn-authz.md)).
- No secret/stack/SQL leak; every user-facing error is a typed `AppError` with a `messageKey`, sanitized by the global exception filter ([18-error-handling-and-exceptions.md](../rules/18-error-handling-and-exceptions.md)).
- Each new/changed `messageKey` is translated in **every supported locale** ([16-i18n-and-messaging.md](../rules/16-i18n-and-messaging.md)).
- Docs moved with behavior: module docs, the relevant `rules/` file, OpenAPI — no stale docs.

## 4. Rollback & data safety

Every change defines how to undo it **before** it ships. Reversibility is a release requirement, not an afterthought.

- Migrations are **additive and reversible**; never edit an already-applied migration in place — write an additive corrective change ([/skills/add-migration-backfill.md](../skills/add-migration-backfill.md)).
- A documented rollback or roll-forward path exists and is feasible: a destructive column, a non-defaulted `NOT NULL`, or an irreversible backfill without a recovery plan is a no-go ([/skills/migration-plan.md](../skills/migration-plan.md)).
- Backfills are chunked, resumable, observable, and safe to pause/retry; data scripts report rows touched, failures, and rerun safety.
- Feature flags / tenant-scoped enablement have a documented default state and explicit **rollback order** ([17-configuration-and-environment.md](../rules/17-configuration-and-environment.md)).
- Rollback feasibility holds until stability is confirmed in hypercare.

> **Project records:** rollback owner, the exact rollback command/runbook, migration roll-forward strategy, and the deploy strategy (blue-green, canary, staged, recreate) used for risk-bearing releases.

## 5. Observability — the change is watchable

A change that cannot be observed in production is not ready. Wire telemetry **before** release, not after the first incident.

- Structured logs on critical paths via the `@core/logger` adapter; no `console.*`; no secret/PII in logs ([14-observability-and-logging.md](../rules/14-observability-and-logging.md)).
- Metrics and alerts exist for the material failure modes the change introduces; dashboards answer healthy / degraded / failing.
- Correlation/request id threaded through multi-step and async work; long-running workflows reach terminal states ([10-reliability-and-durability.md](../rules/10-reliability-and-durability.md), [19-async-events-and-jobs.md](../rules/19-async-events-and-jobs.md)).
- Smoke checks are defined and run immediately after deploy; logs/metrics inspected before the release is called complete.

> **Project records:** dashboard/alert locations, on-call ownership and escalation path, smoke-test script, and the SLO/error-budget impact expected vs. observed.

## 6. Approvals — recorded, not assumed

Map these responsibilities to local roles. No release proceeds with a required approval missing (SDLC phases 21–22, [/claude.md](../claude.md)).

| Sign-off                  | Owner (role)                                                                                                             | Required when                                                                  |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| Code review               | [backend-code-reviewer](../agents/backend-code-reviewer.md)                                                              | Always                                                                         |
| Security review           | [backend-security-reviewer](../agents/backend-security-reviewer.md)                                                      | Auth, permissions, tenant isolation, secrets, PII, money flow, new integration |
| QA sign-off               | [backend-test-engineer](../agents/backend-test-engineer.md)                                                              | Always (a QA-approved build exists)                                            |
| Data/migration review     | [database-reviewer](../agents/database-reviewer.md)                                                                      | Schema, migration, backfill, or query changes                                  |
| Reliability/observability | [reliability-engineer](../agents/reliability-engineer.md), [observability-reviewer](../agents/observability-reviewer.md) | Async/job/event work, new failure modes, telemetry gaps                        |
| UAT / business            | Business owner                                                                                                           | User-visible workflow or business-rule change                                  |
| Client approval           | External stakeholder                                                                                                     | Contractually required                                                         |
| Final GO / NO-GO          | [backend-release-gatekeeper](../agents/backend-release-gatekeeper.md)                                                    | Always                                                                         |

- Approvals are recorded in the change artifacts ([/docs/features/_template/22-go-no-go.md](../docs/features/_template/22-go-no-go.md)), not implied by a thumbs-up.
- An approval is never a substitute for missing evidence; materially changing the code after approval requires re-review.

> **Project records:** named approvers per role, the release-owner, and where go/no-go decisions are logged for this project.

---

## Hotfix exception

Hotfixes are **faster, not looser**. All sections still apply: gates run, diff stays clean, rollback is even more important, approvals are accelerated but not erased, and a retrospective is mandatory. Compress timing and parallelize review — never delete traceability.

## Anti-patterns (treat as a NO-GO)

- "Tests pass and it builds" with no diff read, no docs check, no rollback, no approval.
- A migration with no rollback, or an already-applied migration edited in place.
- A new failure mode with no log, no metric, and no alert.
- A new `messageKey` missing a translation in any supported locale.
- A flaky gate rerun until green instead of root-caused.
- A required approval assumed from a chat message rather than recorded in the artifact.

## Definition of done

A release is **GO** only when: hard gates are green with real output; the diff is scoped, clean, and secret-free; behavior moved with its tests and a regression test backs every fix; security holds (guards + ownership, no leaks, every locale translated); docs moved with behavior; the change is reversible with a documented rollback; observability and smoke checks are ready; and every required approval is recorded. Any unmet item is a **NO-GO** with the blocking finding named. When in doubt, hold the release.

---

## Related

- [/claude.md](../claude.md) — SDLC phases 22 (go/no-go), 23 (docs), 24 (risk/ops), 25 (release), 26 (hypercare)
- [/rules/15-review-checklist.md](../rules/15-review-checklist.md) — the executable pre-merge / release gate
- [/rules/00-non-negotiable-rules.md](../rules/00-non-negotiable-rules.md) — the hard rules this gate enforces
- [/agents/backend-release-gatekeeper.md](../agents/backend-release-gatekeeper.md) — the agent that runs this checklist
- [/testing/quality-gates.md](../testing/quality-gates.md) — authoritative gate commands and coverage floor
- [/skills/final-validation.md](../skills/final-validation.md) — end-to-end pre-merge run
- [/skills/migration-plan.md](../skills/migration-plan.md), [/skills/add-migration-backfill.md](../skills/add-migration-backfill.md) — rollback & data safety
- [/memory/known-pitfalls.md](../memory/known-pitfalls.md) — recurring traps that escape review
