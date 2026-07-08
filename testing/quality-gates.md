# Quality Gates

> The complete set of automated gates that block delivery, the exact scripts behind them, and how Husky and CI enforce them. Implements the canon: [/context/stack-and-toolchain.md](../context/stack-and-toolchain.md), [/rules/00-non-negotiable-rules.md](../rules/00-non-negotiable-rules.md), and [/rules/11-testing-and-coverage.md](../rules/11-testing-and-coverage.md).

A gate is **binary**: it passes or it blocks. There is no "mostly passes," no "passes with caveats," no "we'll fix it after launch." A red gate blocks merge and release until it turns green and is re-verified. Every gate exists because a specific class of defect escaped without it.

## The six gates

| #   | Gate                | Command                 | Proves                                                      | Blocks              |
| --- | ------------------- | ----------------------- | ----------------------------------------------------------- | ------------------- |
| 1   | Lint + architecture | `npm run lint`          | 0 errors AND 0 warnings; layer/boundary/inline rules upheld | commit, push, merge |
| 2   | Type check          | `npm run typecheck`     | `tsgo --noEmit` clean under full strict TS                  | commit, push, merge |
| 3   | Tests               | `npm run test`          | every Vitest suite green, 0 failures, 0 stray skips         | push, merge         |
| 4   | Coverage            | `npm run test:coverage` | statements/functions/lines ≥ 95%, branches ≥ 90%            | push, merge         |
| 5   | Build               | `npm run build`         | compiles to `dist/` clean — production artifact is valid    | push, merge, deploy |
| 6   | Security review     | manual + scanners       | authz, secrets, injection, leakage cleared for the risk     | merge, deploy       |

Gates 1–5 are automated and run identically locally (Husky) and in CI. Gate 6 is a structured human/agent review gated by [/skills/security-review.md](../skills/security-review.md); it is mandatory whenever a change touches auth, permissions, secrets, data access, file handling, or an external boundary.

## What each gate proves

### Gate 1 — Lint + architecture (`npm run lint`)

```bash
npm run lint        # 0 errors AND 0 warnings
npm run lint:fix    # auto-fix what is mechanically fixable
```

The ESLint flat config bundles `strictTypeChecked` + `stylisticTypeChecked`, security/sonarjs/unicorn/promise plugins, Prettier-as-lint, **and the custom architecture plugin**. A red lint means one of:

- a banned token (`any`, `eslint-disable`, `@ts-ignore`, non-null `!`, `console.*`);
- an inline `const`/`enum`/`interface`/`type` inside a controller, service, repository, or use-case;
- a forbidden cross-layer import (controller → repository, service → controller, vendor SDK outside an adapter, `process.env` outside `config/`/`bootstrap/`);
- `Promise.all|allSettled|any|race` inside a service, or a service method over 20 lines.

**Pass criteria:** exit 0 with zero errors and zero warnings. Warnings are not "acceptable noise" here — the floor is zero. Fix the root cause; never suppress.

### Gate 2 — Type check (`npm run typecheck`)

```bash
npm run typecheck   # tsgo --pretty --noEmit --incremental false
```

Project-wide type check with every strict flag on (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitReturns`, `useUnknownInCatchVariables`, …). A failure means a contract between layers is broken: a DTO no longer matches its consumer, a new enum member left a `switch` non-exhaustive, a nullable was not handled.

**Pass criteria:** zero type errors. `tsgo` type-checks only — it never executes `.ts` and never emits.

### Gate 3 — Tests (`npm run test`)

```bash
npm run test        # vitest run
```

Every unit, integration, and e2e suite (`@nestjs/testing` + `supertest`) must pass. Zero failures and zero unexpected skips. A failure means a behavior contract regressed or new code shipped without adequate coverage of its branches. Write or adjust tests **first**; see [/testing/testing-strategy.md](./testing-strategy.md).

### Gate 4 — Coverage (`npm run test:coverage`)

```bash
npm run test:coverage   # vitest run --coverage (v8 provider)
```

Coverage thresholds: statements/functions/lines at the **95%** workspace floor, branches at **90%** because decorator downlevel emit injects uncoverable synthetic branches. Touched modules aim higher, critical paths near 100%. A high global average never excuses a thin patch on changed code — measure the modules you touched. Full policy and waiver process: [/testing/coverage-policy.md](./coverage-policy.md).

**Pass criteria:** all four metrics meet or exceed the threshold; the command exits 0 (Vitest fails the run when a threshold is missed).

### Gate 5 — Build (`npm run build`)

```bash
npm run build       # nest build -p tsconfig.build.json
```

Produces the deployable artifact in `dist/`. Catches problems type-check and tests can miss: a broken runtime import, a circular dependency, a misconfigured module, a dependency missing from `dependencies`. The artifact that builds clean is the artifact promoted to production.

### Gate 6 — Security review (manual + scanners)

Not a single npm script — a structured pass against [/rules/07-security-authn-authz.md](../rules/07-security-authn-authz.md), [/rules/08-database-and-injection-safety.md](../rules/08-database-and-injection-safety.md), and [/rules/14-observability-and-logging.md](../rules/14-observability-and-logging.md). The `eslint-plugin-security` and `sonarjs` rules in Gate 1 do the mechanical scanning; a reviewer or the [backend-security-reviewer](../agents/backend-security-reviewer.md) confirms the judgment calls.

**Pass criteria (when in scope):** every protected route chains auth guard + permissions guard + ownership/tenant check; identity comes from the verified token, never the client body; queries are parameterized and bounded; no secrets/PII/stack traces leak to clients or logs. No unresolved critical/high finding ships without a written, approved waiver.

## How enforcement works — Husky

Hooks live in [`.husky/`](../.husky) and run the **same scripts** as CI, so a clean local pass predicts a clean pipeline.

| Hook         | Runs                                                   | Why here                                                                       |
| ------------ | ------------------------------------------------------ | ------------------------------------------------------------------------------ |
| `pre-commit` | `lint-staged` (eslint `--fix` on staged) + `typecheck` | catch violations before they enter history; fast feedback on staged files      |
| `commit-msg` | `commitlint` (Conventional Commits)                    | enforce machine-readable, traceable history                                    |
| `pre-push`   | `test:coverage` + `build`                              | nothing reaches the remote without green tests, coverage, and a valid artifact |

The split is deliberate: cheap checks (lint-staged, typecheck) gate every commit; the slower full test + coverage + build gate the push. `lint-staged` ([`.lintstagedrc.cjs`](../.lintstagedrc.cjs)) lints and re-stages only changed files for speed; the project-wide `typecheck` still runs because a staged change can break an unstaged file.

```jsonc
// Conceptual hook flow — do NOT bypass with --no-verify
// pre-commit  : lint-staged  &&  npm run typecheck
// commit-msg  : commitlint --edit "$1"
// pre-push    : npm run test:coverage  &&  npm run build
```

Hooks install on `npm install` (Husky `prepare`). If a fresh clone shows no enforcement, run the install step before committing.

## How enforcement works — CI

CI reproduces the authoritative scripts in a clean environment — never a divergent shadow set of steps. Required jobs are version-controlled and enforced; none is marked optional or allow-failure.

```yaml
# Conceptual pipeline — mirrors the local gates, in order
steps:
  - run: npm ci
  - run: npm run lint # Gate 1
  - run: npm run typecheck # Gate 2
  - run: npm run test:coverage # Gates 3 + 4 (tests + thresholds)
  - run: npm run build # Gate 5
  # Gate 6: security review job / required reviewer approval
```

CI is the source of truth for merge eligibility: a pull request merges only when every required job is green. A flaky pipeline is a defect — fix the root cause; do not rerun until green.

## Do / Don't

Do — fix at the root and re-run the full gate set:

```bash
npm run lint && npm run typecheck && npm run test:coverage && npm run build
```

Don't — bypass, suppress, or weaken a gate:

```bash
git commit --no-verify          # bans the safety net entirely
git push   --no-verify          # ships unverified code
# // eslint-disable-next-line  -> fix the rule violation instead
# lowering the coverage threshold to make a patch "pass"
```

`--no-verify` and rule suppression are prohibited. The only exception is a recorded, approved emergency (see [/rules/00-non-negotiable-rules.md](../rules/00-non-negotiable-rules.md) and the SDLC policy in [/claude.md](../claude.md)); even then, the skipped gates must be restored and re-run within the documented window.

## Blocker severity

| Severity | Definition                                                                    | Action                           |
| -------- | ----------------------------------------------------------------------------- | -------------------------------- |
| CRITICAL | auth bypass, data loss, secret/PII leak, injection, tenant-isolation break    | no merge, no deploy; fix now     |
| HIGH     | any red automated gate (lint/typecheck/test/coverage/build); core path broken | no merge until green             |
| MEDIUM   | degraded behavior with a workaround, no data/security impact                  | fix before release               |
| LOW      | cosmetic or wording issue, no functional impact                               | track as follow-up; non-blocking |

Any red automated gate is at least HIGH by definition. CRITICAL findings block regardless of deadline or business pressure.

## Re-run protocol

When a gate fails:

1. Identify the failing gate and the precise reason.
2. Distinguish a real defect from a transient (flaky test, network) — flakiness is itself a defect to fix, not to ignore.
3. Fix the root cause through the normal flow — no shortcuts, no `--no-verify`.
4. Re-run the **entire** gate set, not just the one that failed. Partial passes stitched from multiple runs are not valid.
5. Record what failed and how it was resolved in the change's artifacts.

A change is gate-approved only when all gates are green in a single, uninterrupted evaluation.

## Definition of done (automated gates)

- [ ] `npm run lint` — 0 errors AND 0 warnings
- [ ] `npm run typecheck` — 0 errors, project-wide
- [ ] `npm run test` — all suites pass, 0 failures, 0 stray skips
- [ ] `npm run test:coverage` — all four metrics ≥ 95% floor; touched modules higher
- [ ] `npm run build` — compiles clean to `dist/`
- [ ] Security review cleared for the change's risk (Gate 6)
- [ ] Husky hooks ran (no `--no-verify`); CI required jobs green
- [ ] Tests and docs updated in the same change; behavior changes called out

## Related

[/testing/README.md](./README.md) · [/testing/testing-strategy.md](./testing-strategy.md) · [/testing/coverage-policy.md](./coverage-policy.md) · [/testing/bug-triage-and-retest.md](./bug-triage-and-retest.md) · [/skills/final-validation.md](../skills/final-validation.md) · [/skills/fix-eslint-typecheck.md](../skills/fix-eslint-typecheck.md) · [/rules/15-review-checklist.md](../rules/15-review-checklist.md) · [/agents/backend-release-gatekeeper.md](../agents/backend-release-gatekeeper.md) · [/context/stack-and-toolchain.md](../context/stack-and-toolchain.md)
