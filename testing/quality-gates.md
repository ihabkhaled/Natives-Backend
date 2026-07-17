# Quality Gates

> The complete set of automated gates that block delivery, the exact scripts behind them, and how Husky and CI enforce them. Implements the canon: [/context/stack-and-toolchain.md](../context/stack-and-toolchain.md), [/rules/00-non-negotiable-rules.md](../rules/00-non-negotiable-rules.md), and [/rules/11-testing-and-coverage.md](../rules/11-testing-and-coverage.md).

A gate is **binary**: it passes or it blocks. There is no "mostly passes," no "passes with caveats," no "we'll fix it after launch." A red gate blocks merge and release until it turns green and is re-verified. Every gate exists because a specific class of defect escaped without it.

## The seven CI gates

| #   | Gate              | Command                 | Proves                                                      | Blocks              |
| --- | ----------------- | ----------------------- | ----------------------------------------------------------- | ------------------- |
| 1   | Lint + format     | `npm run lint` + format | 0 errors/warnings; architecture and formatting upheld       | commit, push, merge |
| 2   | Type check        | `npm run typecheck`     | full strict TypeScript contracts are clean                  | commit, push, merge |
| 3   | Unit/static tests | `npm run test:unit`     | source and custom ESLint-rule suites are green              | push, merge         |
| 4   | Backend E2E       | `npm run test:e2e`      | Nest/Fastify/Supertest production wiring works              | push, merge         |
| 5   | Coverage          | `npm run test:coverage` | statements/functions/lines ≥ 95%, branches ≥ 90%            | push, merge         |
| 6   | Build             | `npm run build`         | production artifact compiles cleanly                        | push, merge, deploy |
| 7   | Security          | audit + Trivy + review  | dependencies, secrets, misconfig, and judgment checks clear | merge, deploy       |

All seven checks are automated in GitHub Actions using authoritative npm scripts. Gate 7 also retains the structured human/agent review in [/skills/security-review.md](../skills/security-review.md) whenever a change touches auth, permissions, secrets, data access, file handling, or an external boundary.

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
npm run typecheck   # tsc --pretty --noEmit --incremental false
```

Project-wide type check with every strict flag on (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitReturns`, `useUnknownInCatchVariables`, …). A failure means a contract between layers is broken: a DTO no longer matches its consumer, a new enum member left a `switch` non-exhaustive, a nullable was not handled.

The default `tsc` comes from `@typescript/native` (`npm:typescript@7.0.2`). The package named `typescript` is the TypeScript 6 compatibility API (`npm:@typescript/typescript6@6.0.2`) for lint/tool consumers and does not own this gate.

**Pass criteria:** zero TypeScript 7 errors. This command type-checks only — it never executes `.ts` and never emits.

### Gate 3 — Unit/static tests (`npm run test:unit`)

```bash
npm run test:unit   # Vitest except the backend E2E entrypoint
```

Every source-level suite and custom ESLint-rule regression suite must pass with zero failures and zero unexpected skips.

### Gate 4 — Backend E2E (`npm run test:e2e`)

```bash
npm run test:e2e    # Vitest + Nest/Fastify/Supertest
```

This gate exercises production `createApp()` wiring and real HTTP flows without a browser. IronNest has no Playwright dependency.

### Gate 5 — Coverage (`npm run test:coverage`)

```bash
npm run test:coverage   # vitest run --coverage (v8 provider)
```

Coverage thresholds: statements/functions/lines at the **95%** workspace floor, branches at **90%** because decorator downlevel emit injects uncoverable synthetic branches. Touched modules aim higher, critical paths near 100%. A high global average never excuses a thin patch on changed code — measure the modules you touched. Full policy and waiver process: [/testing/coverage-policy.md](./coverage-policy.md).

**Pass criteria:** each metric meets its configured threshold and the command exits 0; real changed branches are reviewed separately from synthetic decorator branches.

### Gate 6 — Build (`npm run build`)

```bash
npm run build       # tsc -p tsconfig.build.json
```

Uses the TypeScript 7 native CLI and produces the deployable artifact in `dist/`. Catches problems type-check and tests can miss: a broken runtime import, a circular dependency, a misconfigured module, a dependency missing from `dependencies`. The artifact that builds clean is the artifact promoted to production.

### Gate 7 — Security scan and review

CI runs `npm run security:audit` and the blocking Trivy `npm run security:scan`, then uploads SARIF. A structured pass against [/rules/07-security-authn-authz.md](../rules/07-security-authn-authz.md), [/rules/08-database-and-injection-safety.md](../rules/08-database-and-injection-safety.md), and [/rules/14-observability-and-logging.md](../rules/14-observability-and-logging.md) remains mandatory for judgment calls.

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
# Independent required jobs; each starts with checkout, Node setup, and npm ci.
required-checks:
  - lint
  - typecheck
  - test:unit
  - test:e2e
  - test:coverage
  - build
  - security:scan
```

The workflows live under [`.github/workflows`](../.github/workflows), and exact branch-protection setup lives in [`runbooks/github-required-checks.md`](../runbooks/github-required-checks.md). CI is the source of truth for merge eligibility: a pull request merges only when every required job is green. A flaky pipeline is a defect—fix the root cause; do not rerun until green.

## Do / Don't

Do — fix at the root and re-run the full gate set:

```bash
npm run validate && npm run test:e2e && npm run security:audit && npm run security:scan
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
- [ ] `npm run test:unit` — source and static-rule suites pass
- [ ] `npm run test:e2e` — backend HTTP suite passes without Playwright
- [ ] `npm run test:coverage` — statements/functions/lines ≥95%, measured branches ≥90%, all real changed branches covered
- [ ] `npm run build` — compiles clean to `dist/`
- [ ] `npm run security:audit` and `npm run security:scan` pass; human security review is cleared for the change's risk
- [ ] Husky hooks ran (no `--no-verify`); CI required jobs green
- [ ] Tests and docs updated in the same change; behavior changes called out

## Related

[/testing/README.md](./README.md) · [/testing/testing-strategy.md](./testing-strategy.md) · [/testing/coverage-policy.md](./coverage-policy.md) · [/testing/bug-triage-and-retest.md](./bug-triage-and-retest.md) · [/skills/final-validation.md](../skills/final-validation.md) · [/skills/fix-eslint-typecheck.md](../skills/fix-eslint-typecheck.md) · [/rules/15-review-checklist.md](../rules/15-review-checklist.md) · [/agents/backend-release-gatekeeper.md](../agents/backend-release-gatekeeper.md) · [/context/stack-and-toolchain.md](../context/stack-and-toolchain.md)
