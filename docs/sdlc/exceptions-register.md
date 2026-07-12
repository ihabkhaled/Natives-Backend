# Exceptions Register

## Purpose

This repository **bans blind suppressions**: no `eslint-disable`, no `@ts-ignore`, no weakened threshold "to make the gate pass" ([`rules/00`](../../rules/00-non-negotiable-rules.md) §4–6, [`rules/13`](../../rules/13-eslint-and-typescript.md)). The narrow, deliberate relaxations the project _does_ allow are not exceptions to that ban — they are **documented, owned, reviewable decisions**, and this file is the single discoverable index of every one of them.

The standing rule: **a relaxation that is not in this register does not exist.** If a rule is turned off, a threshold is lowered, or a file is excluded from a check, it is either recorded here with a justification and an owner, or it is a defect to be removed. A blind suppression comment in the codebase is always a rule-00 violation, never a valid exception.

This register is enforced discoverable: the contradiction-check (`npm run knowledge:verify`) asserts no blind suppression exists in `src/`, and every relaxation below points at the file that implements it so a reviewer can trace claim → code.

## How to read an entry

| Field                | Meaning                                                    |
| -------------------- | ---------------------------------------------------------- |
| Relaxation           | What is turned off / lowered / excluded                    |
| Scope                | Exactly where it applies (never broader than needed)       |
| Justification        | Why the strict default is wrong _here_ specifically        |
| Compensating control | What still protects the surface despite the relaxation     |
| Owner                | Who accepts the risk and reviews it                        |
| Review trigger       | The event that forces re-examination (not a calendar date) |

## Active relaxations

### EX-01 — Test files loosen type-safety and layer rules

- **Relaxation:** in `*.spec.ts` / `test/**`, these are `off`: `@typescript-eslint/no-unsafe-{argument,assignment,call,member-access,return}`, `unbound-method`, `consistent-type-imports`, `no-extraneous-class`, `prefer-nullish-coalescing`, `only-throw-error`, `promise/prefer-await-to-then`, `security/detect-object-injection`, `max-lines-per-function`, `max-classes-per-file`, `architecture/no-restricted-layer-imports`, `architecture/no-inline-layer-declarations`.
- **Scope:** test files only — [`eslint/test.config.mjs`](../../eslint/test.config.mjs) (each `off` carries an inline rationale).
- **Justification:** tests assemble mocked/`any`-shaped fixtures, reach across layers to build arrange blocks, and run long setup — applying production type/layer discipline to them adds noise without safety.
- **Compensating control:** the same file KEEPS `no-explicit-any`, `no-non-null-assertion`, and `no-unnecessary-type-assertion` on, and bans `.only`. Production code is unaffected.
- **Owner:** repository architect. **Review trigger:** any change to `eslint/test.config.mjs`.

### EX-02 — Lint scope excludes generated and non-typed files

- **Relaxation:** ESLint does not lint `dist/`, `node_modules/`, `coverage/`, `logs/`, `*.tsbuildinfo`, `test/**/*.js`, `vitest.config.mts`, root `*.spec.ts`, and all `**/*.{js,mjs,cjs}`.
- **Scope:** lint target only — [`eslint/ignores.config.mjs`](../../eslint/ignores.config.mjs).
- **Justification:** generated output and dependencies are not source; the flat-config modules, the knowledge tooling, and hook scripts are `.mjs` outside the typed-TypeScript lint target.
- **Compensating control:** the excluded tooling is validated by its own Vitest specs (`test/eslint/**`, `test/tooling/knowledge/**`) rather than by lint; generated artifacts are validated by `knowledge:check`/`knowledge:verify`.
- **Owner:** repository architect. **Review trigger:** adding a new `.mjs` tool that warrants linting, or a rule that should apply to config files.

### EX-03 — Coverage branch floor is 90%, not 95%

- **Relaxation:** the branch threshold is `90` while statements/functions/lines are `95`.
- **Scope:** coverage gate only — [`vitest.config.mts`](../../vitest.config.mts) (documented in [`testing/coverage-policy.md`](../../testing/coverage-policy.md) and [`testing/quality-gates.md`](../../testing/quality-gates.md)).
- **Justification:** the decorator downlevel emit injects one uncoverable synthetic branch per decorated class declaration; the 90 floor absorbs only that artifact.
- **Compensating control:** every **real** branch in changed code must still be covered; reviewers read the per-file table, and lowering any threshold further to absorb untested logic remains forbidden ([coverage-policy §6](../../testing/coverage-policy.md)).
- **Owner:** repository architect / test engineer. **Review trigger:** a decorator-transform toolchain change, or a genuine branch-coverage miss hiding behind the allowance.

### EX-04 — Template expressions allow `boolean` and `number`

- **Relaxation:** `@typescript-eslint/restrict-template-expressions` sets `allowBoolean: true`, `allowNumber: true`.
- **Scope:** all source — [`eslint/typescript.config.mjs`](../../eslint/typescript.config.mjs).
- **Justification:** interpolating a `number` or `boolean` into a template is unambiguous and safe; forbidding it forces noisy `String(...)` wrapping.
- **Compensating control:** objects/unknowns are still rejected; `no-base-to-string` still bans `[object Object]` stringification.
- **Owner:** repository architect. **Review trigger:** a template-string bug traced to a coerced value.

### EX-05 — Generated `.ai/` artifacts are exempt from Prettier

- **Relaxation:** `.ai/BOOTSTRAP.md`, `.ai/manifests/`, and `.ai/local/` are Prettier-ignored.
- **Scope:** formatting only — [`.prettierignore`](../../.prettierignore) (the hand-authored `.ai/README.md` is intentionally NOT ignored).
- **Justification:** the generator's deterministic byte-stable output is the source of truth; letting Prettier reformat it creates a format↔build loop.
- **Compensating control:** `knowledge:check` fails the build if the committed artifacts drift from a fresh generate; the generator is the only writer.
- **Owner:** repository architect. **Review trigger:** any change to the generator's output format.

### EX-06 — `@ts-expect-error` allowed only with a linked justification

- **Relaxation:** `@ts-expect-error` is permitted where `@ts-ignore` is banned.
- **Scope:** all source — `ban-ts-comment` with `minimumDescriptionLength` ([`rules/13`](../../rules/13-eslint-and-typescript.md), [`rules/00`](../../rules/00-non-negotiable-rules.md) §6).
- **Justification:** a genuinely necessary compiler-boundary suppression is safer as an _expected_ error (which fails if the underlying issue is fixed) than as a silent ignore.
- **Compensating control:** it requires a ≥5-char description and a linked decision; **there are currently zero uses in `src/`** (the contradiction-check would surface any).
- **Owner:** the author of each use, recorded in the linked decision. **Review trigger:** each new use; removal when the upstream type is fixed.

## Adding a new exception (template)

Copy this block into "Active relaxations" and fill every field. If you cannot complete a field honestly, you do not have an exception — you have a defect to fix at the root cause.

```markdown
### EX-NN — <one-line title>

- **Relaxation:** <the exact rule/threshold/exclusion being relaxed>
- **Scope:** <exact files/globs> — [`path`](../../path)
- **Justification:** <why the strict default is wrong _here_, specifically>
- **Compensating control:** <what still protects this surface>
- **Owner:** <role/person who accepts the risk>. **Review trigger:** <the event that forces re-examination>
```

## What never qualifies

- A blind `eslint-disable` / `@ts-ignore` anywhere in `src/` (rule-00 violation — remove it).
- Lowering a coverage/lint/type threshold to make a red gate green (fix the code).
- "Temporary" suppressions with no owner and no review trigger.
- A relaxation added to config but not recorded here (the register is the source of truth; an unrecorded relaxation is a defect).

## Related

- [`rules/00-non-negotiable-rules.md`](../../rules/00-non-negotiable-rules.md) §4–6 — the suppression bans this register is the sanctioned exception surface for.
- [`rules/13-eslint-and-typescript.md`](../../rules/13-eslint-and-typescript.md) — the strictness catalog and root-cause-fix table.
- [`testing/coverage-policy.md`](../../testing/coverage-policy.md) §6 — the coverage-waiver rules.
- [`docs/sdlc/company-sdlc-policy.md`](./company-sdlc-policy.md) — the SDLC waiver/exception policy (approver, business reason, expiry).
