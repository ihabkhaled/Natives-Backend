# Coverage Policy

> The coverage contract for this workspace: **aggregate thresholds are mechanically enforced** by Vitest 4/V8 at pre-push, while every touched logic file is reviewed in the per-file report (critical paths near 100%). This implements the canon and is tied to the live [vitest.config.mts](../vitest.config.mts).

Coverage is a hard gate, not a vanity metric. A green coverage run proves _which lines executed_, not that behavior is correct — pair it with the scenario discipline in [coverage-policy](./coverage-policy.md)'s sibling standards ([unit](./unit-testing-standard.md), [integration](./integration-testing-standard.md), [e2e](./e2e-testing-standard.md)).

---

## 1. The thresholds

| Metric       | Floor (every touched module) | Target for critical logic      |
| ------------ | ---------------------------- | ------------------------------ |
| `statements` | 95%                          | near 100%                      |
| `branches`   | 90% (see note)               | near 100% of **real** branches |
| `functions`  | 95%                          | near 100%                      |
| `lines`      | 95%                          | near 100%                      |

> **Branch-floor note.** The decorator downlevel transform injects uncoverable synthetic branches on decorated class declarations under the configured V8 provider ([known-pitfalls §I3](../memory/known-pitfalls.md)). The 90% branch floor absorbs only that artifact; every **real** branch in changed code must still be covered.

**Critical logic** = domain policies, state machines, money/auth/permission/tenant code, and any path whose failure is unsafe. These aim for near-100% with rich scenario coverage (happy path + every validation/forbidden/conflict/boundary branch), not just a high number. A high percentage with shallow assertions is still inadequate.

These four numbers live in `coverage.thresholds` in [vitest.config.mts](../vitest.config.mts). Do **not** edit them down to make a red run pass — that is a silent waiver and is forbidden (see §6).

---

## 2. Per-module, not just global

A repository-wide average hides thin, untested files behind well-tested ones. This policy measures the **module you touched**, not the whole tree.

- **Mechanically:** run the gate scoped to the files in your change. `coverage.all: true` means even files with zero tests count against the floor, so a new untested file cannot ride on the global average.
- **In practice:** confirm touched logic clears 95% statements/functions/lines and every real branch; the 90% measured branch floor applies only to decorator-transform artifacts. Read the per-file table, not the summary line.
- **Per-file enforcement (recommended):** flip `thresholds.perFile: true` in [vitest.config.mts](../vitest.config.mts) so each source file must individually clear the floor. This makes "per touched module" mechanical instead of a code-review honor system. When `perFile` is on, the only way to pass is for every non-excluded file to stand on its own.

```ts
// Do — make the floor stand per file, so a thin file can't hide
coverage: {
  thresholds: { perFile: true, branches: 90, functions: 95, lines: 95, statements: 95 },
}
```

```ts
// Don't — lower the floor to silence a red run
coverage: {
  thresholds: {
    lines: 80;
  }
} // unrecorded waiver — forbidden
```

---

## 3. How it is measured (Vitest 4 + v8)

The provider is **`v8`**. Config (abridged from the live [vitest.config.mts](../vitest.config.mts) — when this doc and the config disagree, **the config wins**, then fix this doc):

```ts
coverage: {
  all: true,                 // count files with zero tests against the floor
  provider: 'v8',
  reporter: ['text', 'json-summary', 'lcov'],
  include: ['src/**/*.ts'],
  exclude: [ /* declarative / non-logic — see §4 */ ],
  thresholds: { branches: 90, functions: 95, lines: 95, statements: 95 },
}
```

> `branches: 90` is the decorator-artifact allowance explained above — **not** a licence to leave real branches untested. V8 is the only configured provider.

- `text` → human-readable per-file table in the terminal.
- `json-summary` → machine-readable totals for CI/agents to parse.
- `lcov` → upload artifact for the PR coverage view.

Run it:

```bash
npm run test:coverage   # vitest run --coverage — fails the process if any threshold is unmet
```

Aliases (`@core`, `@modules`, `@shared`, …) are mirrored from `tsconfig.json` into [vitest.config.mts](../vitest.config.mts); keep both in sync or coverage will mis-resolve modules.

---

## 4. What is excluded (and why)

Coverage measures **logic**. Declarative, generated, and bootstrap files carry no behavior to assert, so they are removed from the denominator. The exclude list in [vitest.config.mts](../vitest.config.mts):

| Excluded glob                 | Why                                                                                                                                                                                                           |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/**/*.module.ts`          | DI wiring, no branch logic                                                                                                                                                                                    |
| `src/**/*.dto.ts`             | Validation lives in decorators; covered via controller/e2e tests                                                                                                                                              |
| `src/**/index.ts`             | Public-surface barrels — re-exports only                                                                                                                                                                      |
| `src/**/*.spec.ts`, `test/**` | The tests themselves                                                                                                                                                                                          |
| `src/main.ts`                 | Entrypoint; bootstrap is exercised by e2e                                                                                                                                                                     |
| `eslint/**/*.mjs`             | ESLint rule behavior is executed with `RuleTester` plus resolved-config activation tests; these modules load outside the application V8 transform and are reviewed by scenario count, not the app denominator |

Extend the exclude list (consistent with the canon's "zero inline declarations") for pure declaration files when your project adds them: `*.types.ts`, `*.enums.ts`, `*.constants.ts`, `*.interface.ts`, and `src/shared/{enums,constants,types}/**` / `src/modules/**/model/**`. ORM entity files (`*.entity.ts`) may need exclusion too — decorator metadata injects synthetic, uncoverable branches on every property; test their real hooks elsewhere.

> **Strategic consequence:** extracting types/enums/constants into their proper `model/` and `@shared` files (an architecture rule — [/rules/06-types-enums-constants.md](../rules/06-types-enums-constants.md)) also _removes them from the coverage denominator_. Keeping declarations out of logic files is both clean architecture and a coverage strategy — your real logic files reach the floor more easily.

Never add application/service/use-case/repository/domain logic to the exclude list to dodge the gate. ESLint MJS remains acceptable only while its RuleTester/config-activation suites cover every policy path changed.

---

## 5. How it is enforced (pre-push)

The floor is enforced where it cannot be skipped: the **Husky pre-push hook** (see [/context/stack-and-toolchain.md](../context/stack-and-toolchain.md)).

| Gate                 | Hook         | Runs                                          | Blocks   |
| -------------------- | ------------ | --------------------------------------------- | -------- |
| Lint + typecheck     | pre-commit   | `lint-staged` + `npm run typecheck`           | commit   |
| Commit format        | commit-msg   | `commitlint` (Conventional Commits)           | commit   |
| **Coverage + build** | **pre-push** | **`npm run test:coverage` + `npm run build`** | **push** |

A red suite or a coverage dip below any threshold makes `npm run test:coverage` exit non-zero, which fails pre-push and stops the push. CI re-runs the same command in a clean environment so the gate cannot be a local-only illusion.

- **Never** bypass with `git push --no-verify` (or `git commit --no-verify`) — banned by [/rules/00-non-negotiable-rules.md](../rules/00-non-negotiable-rules.md) and the SDLC policy in [/claude.md](../claude.md).
- The local hook and CI use the **same** `npm run test:coverage` entrypoint — no divergent shadow steps.

---

## 6. Waiver rules

The floor is the default; a waiver is the rare, recorded exception.

A waiver is only valid when **all** of the following hold:

1. **Genuinely unreachable defensive code** — e.g. a fall-through arm that an earlier guard already made impossible, or framework-injected synthetic branches. Not "I ran out of time."
2. **Narrowly scoped** with a V8 hint _and_ a one-line justification comment, attached to the smallest possible region:
   ```ts
   /* v8 ignore next -- unreachable: prior guard rejects every other status */
   throw new UnexpectedStatusError(status);
   ```
3. **Recorded as a decision** in [/memory/testing-strategy.md](../memory/testing-strategy.md) (or the request's `12-coverage-plan.md` under [/docs/sdlc/](../docs/sdlc/)) with: what was waived, why it is unreachable/unsafe-to-test, who approved it, and the residual risk.
4. **Approved** by a reviewer with authority over the area — security/auth/money/tenant code requires the relevant security reviewer ([/agents/backend-security-reviewer.md](../agents/backend-security-reviewer.md)).

What is **not** a waiver: lowering a `thresholds.*` number, adding a logic file to `coverage.exclude`, deleting assertions to make a branch "covered", or `--no-verify`. Each of those is an unrecorded, blanket waiver and is forbidden.

> Prefer **refactoring for testability** over a waiver. An untestable branch usually signals a design smell — extract the policy to `domain/`, the side effect to an adapter, or the orchestration to a use case. See [/skills/decompose-large-file.md](../skills/decompose-large-file.md).

---

## 7. Workflow checklist

Tests come **first** ([/rules/11-testing-and-coverage.md](../rules/11-testing-and-coverage.md)): write/adjust the failing test, implement the minimal change, then prove the floor.

- [ ] Wrote/updated tests **before** the implementation change.
- [ ] `npm run test:coverage` is green — process exit 0, all four thresholds met.
- [ ] Each **touched** logic file clears 95% statements/functions/lines and every real branch; any branch shortfall is only documented decorator-transform output.
- [ ] Critical logic (auth, permissions, tenant, money, state machines) is near 100% with branch-level scenarios, not just a high number.
- [ ] Security surface tested where applicable: 401 unauthenticated, 403 unauthorized, IDOR/tenant isolation, 400 on malformed input, parameterized queries ([/testing/integration-testing-standard.md](./integration-testing-standard.md)).
- [ ] No threshold lowered, no logic file added to `exclude`, no deleted assertions to fake a branch.
- [ ] Any waiver is V8-scoped, justified inline, **and** recorded + approved per §6.
- [ ] Pre-push gate (`test:coverage` + `build`) passes without `--no-verify`.

---

## Related

[/testing/quality-gates.md](./quality-gates.md) · [/testing/testing-strategy.md](./testing-strategy.md) · [/testing/unit-testing-standard.md](./unit-testing-standard.md) · [/testing/integration-testing-standard.md](./integration-testing-standard.md) · [/rules/11-testing-and-coverage.md](../rules/11-testing-and-coverage.md) · [/context/stack-and-toolchain.md](../context/stack-and-toolchain.md) · [vitest.config.mts](../vitest.config.mts) · [/memory/testing-strategy.md](../memory/testing-strategy.md)
