# Skill: Final Validation (Pre-Commit / Pre-Push)

> Run the last diff review, git-safety checks, and every quality gate before you stage, commit, or push — so the change that lands is reviewable, clean, and green. Implements the canon in [/rules/15-review-checklist.md](../rules/15-review-checklist.md), [/rules/00-non-negotiable-rules.md](../rules/00-non-negotiable-rules.md), and [/context/stack-and-toolchain.md](../context/stack-and-toolchain.md).

This is the gate you run **immediately before** asking to commit or push. It is not a substitute for the review checklist or the test work — it is the final, mechanical pass that catches accidental files, leaked secrets, broken gates, and scope creep before they reach history. A green run here is a precondition for "done," never proof of it.

## Rules this skill enforces

- **Lint, typecheck, tests, coverage, build all green** — 0 errors AND 0 warnings; coverage ≥ 95% ([rules 1–2](../rules/00-non-negotiable-rules.md), [/testing/coverage-policy.md](../testing/coverage-policy.md)).
- **No behavior change without tests AND docs in the same change** ([rule 42](../rules/00-non-negotiable-rules.md)).
- **Never bypass a hook with `--no-verify`** without a recorded, approved emergency exception ([/context/stack-and-toolchain.md](../context/stack-and-toolchain.md)).
- **No secrets, env files, build/coverage output, or generated junk** committed — config via typed `@nestjs/config`, secrets via the secret manager ([rule 27](../rules/00-non-negotiable-rules.md), [/rules/17-configuration-and-environment.md](../rules/17-configuration-and-environment.md)).
- **Scope discipline** — one request, one logical change; no opportunistic refactors or formatting noise smuggled in.
- **Conventional Commits** — the message must pass `commitlint` ([/rules/15-review-checklist.md](../rules/15-review-checklist.md)).

---

## Tests FIRST

By the time you reach final validation, the tests already exist — they were written or adjusted **before** the implementation. This skill does not write tests; it confirms they run, cover the touched modules, and that no behavior change slipped in without a matching test ([rule 42](../rules/00-non-negotiable-rules.md)). If you find an uncovered branch or an untested behavior change here, stop and go back to [/skills/write-unit-tests.md](./write-unit-tests.md) — do not commit around the gap.

---

## Steps

### 1. See exactly what changed

Start with the full picture of working-tree state and the shape of the diff. Inspect, do not assume.

```bash
git status --short          # untracked + modified + staged, at a glance
git diff --stat             # which files, how many lines each
git diff                    # read the actual change, hunk by hunk
```

Read every hunk as if you were the reviewer. If a file appears that you did not intend to touch, that is the first signal of scope creep or an accidental include.

### 2. Catch whitespace and conflict-marker damage

`git diff --check` flags trailing whitespace, mixed indentation, and stray merge-conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`) that lint may not always surface in context.

```bash
git diff --check            # must print nothing
```

If it reports anything, fix it before continuing — leftover conflict markers are a classic way to ship a broken file that still compiles in part.

### 3. Confirm no junk, secrets, or build artifacts are included

Nothing generated, secret, or machine-local belongs in the commit. Verify the diff and the untracked list are clean of these categories:

| Must NOT be committed | Where it belongs instead |
| --- | --- |
| `.env`, `.env.*`, credential files | the secret manager; document the key in [/rules/17-configuration-and-environment.md](../rules/17-configuration-and-environment.md) |
| `dist/`, `build/`, compiled output | `.gitignore`; produced by `npm run build` |
| `coverage/`, test reports, `*.lcov` | `.gitignore`; produced by `npm run test:coverage` |
| `node_modules/`, lockfile churn you didn't intend | `.gitignore`; commit lockfile **only** when deps actually changed |
| debug logs, scratch files, editor/OS cruft | delete; add a global ignore |
| inline tokens / API keys / connection strings | typed config + secret manager ([rule 27](../rules/00-non-negotiable-rules.md)) |

```bash
# DO — scan staged + working changes for obvious secret patterns before staging
git diff --staged
grep -RniE 'password|secret|api[_-]?key|token|bearer|private[_-]?key' $(git diff --name-only)
```

If a secret was ever committed, treat it as compromised: rotate it, then scrub history — do not just delete it in a follow-up commit.

### 4. Check scope: one request, one change

A change should map to a single request/ticket. Skim the diff for unrelated edits — a stray rename, a reformatted neighbouring file, a dependency bump no one asked for. Pull them out into their own change.

```bash
git diff --name-only        # do these files all belong to THIS change?
```

If an unrelated cleanup is genuinely worth keeping, stage and commit it **separately** with its own Conventional Commit message — never fold it silently into a feature or fix.

### 5. Run every quality gate

These are the same commands the Husky hooks run (`pre-commit` = lint-staged + typecheck; `pre-push` = test:coverage + build). Run them yourself so failures surface here, not in the hook. Run **all** of them — a passing typecheck says nothing about coverage.

```bash
npm run lint            # 0 errors AND 0 warnings
npm run typecheck       # tsgo --noEmit, project-wide
npm run test            # vitest
npm run test:coverage   # statements/branches/functions/lines ≥ 95% (critical paths ~100%)
npm run build           # compiles clean
```

Fix every failure at the **root cause**. Never silence a gate with `eslint-disable`, `@ts-ignore`, a non-null assertion, a weakened threshold, or a skipped test ([rules 3–7](../rules/00-non-negotiable-rules.md)). See [/skills/fix-eslint-typecheck.md](./fix-eslint-typecheck.md).

### 6. Confirm coverage on the modules you touched

The workspace floor is 95%, but the gate is an average — a touched module can hide below it. Verify the files you changed are covered, with critical paths near 100%.

```bash
npx vitest run --coverage \
  --coverage.include="src/modules/<feature>/**"   # narrow to what you changed
```

Uncovered branch? Add the case before committing — do not pad data-only files (`*.types.ts`, `*.enums.ts`, `*.constants.ts`, DTOs, migrations) to game the number.

### 7. Confirm docs and artifacts moved with the behavior

If behavior changed, the matching docs, runbooks, release notes, and feature artifacts under [/docs/features/_template/](../docs/features/_template/) must change in the **same** change ([rule 42](../rules/00-non-negotiable-rules.md), [/rules/15-review-checklist.md](../rules/15-review-checklist.md)). A new adapter, config value, event, or migration each carry their own doc/wiring requirements ([rule 41](../rules/00-non-negotiable-rules.md)).

### 8. Walk the review checklist one last time

Mechanical gates miss design problems. Do a final human-eyes pass against [/rules/15-review-checklist.md](../rules/15-review-checklist.md): thin controllers, ≤20-line services, transactional use cases, parameterized + bounded repositories, auth + permissions + ownership on protected routes, typed `AppError` with a `messageKey`, no leaked stack/SQL/secrets.

### 9. Stage explicitly, then write a Conventional Commit

Stage the intended files by path — never `git add -A` blindly, which is how junk slips in. Get the user's approval before committing on their behalf.

```bash
git add <explicit paths>          # not `-A`, not `.`
git commit                        # commit-msg hook runs commitlint
# subject: type(scope): imperative summary — e.g. feat(order): add submit transition
```

The subject must be intent-revealing — no `update`, `fix stuff`, `wip`, or `misc`. Let the hooks run; do not pass `--no-verify`.

---

## Quality gate

```bash
npm run lint            # 0 errors AND 0 warnings
npm run typecheck       # tsgo --noEmit, project-wide
npm run test            # vitest
npm run test:coverage   # statements/branches/functions/lines ≥ 95% (critical paths ~100%)
npm run build           # compiles clean
```

Every gate must be green before you commit, and again (via `pre-push`) before you push. A green run is the floor, not the ceiling — only declare "done" once behavior is proven, docs are updated, and remaining risks are explicit.

---

## Pitfalls

- **Trusting the hook to catch it.** The hook runs the gates, but if it fails mid-commit you've already lost flow — run the gates yourself first so the commit is uneventful.
- **`git add -A` / `git add .`.** The fastest way to commit a `.env`, a `coverage/` folder, or an unrelated file. Stage explicit paths.
- **Bypassing with `--no-verify`.** Banned without a recorded, approved emergency exception. A skipped gate is a defect waiting in `main`.
- **Silencing a gate instead of fixing it.** `eslint-disable`, `@ts-ignore`, `!`, lowered thresholds, `it.skip` — all hide the problem and rot. Fix the root cause ([rules 3–7](../rules/00-non-negotiable-rules.md)).
- **Average coverage masking a thin module.** 95% overall can hide an uncovered branch in the file you just wrote. Narrow the report to your module.
- **Scope creep.** Opportunistic refactors and formatting noise folded into a feature branch make review and rollback harder. Split them out.
- **Behavior change without tests/docs.** If logic changed and no test or doc changed, the change is incomplete — go back, don't commit.
- **Leftover conflict markers or debug code.** `console.*`, commented-out blocks, `<<<<<<<` markers — caught by `git diff --check` and the lint rule, not by a successful build.
- **Committing the lockfile by accident** (or failing to commit it when deps really changed). Both cause confusing, non-reproducible builds.
- **Vague commit subjects.** `update`, `wip`, `misc` fail intent review and break the changelog. Use Conventional Commits with a real summary.

---

**Related:** [/rules/15-review-checklist.md](../rules/15-review-checklist.md) · [/rules/00-non-negotiable-rules.md](../rules/00-non-negotiable-rules.md) · [/rules/11-testing-and-coverage.md](../rules/11-testing-and-coverage.md) · [/rules/17-configuration-and-environment.md](../rules/17-configuration-and-environment.md) · [/skills/fix-eslint-typecheck.md](./fix-eslint-typecheck.md) · [/skills/write-unit-tests.md](./write-unit-tests.md) · [/skills/security-review.md](./security-review.md) · [/testing/quality-gates.md](../testing/quality-gates.md) · [/testing/coverage-policy.md](../testing/coverage-policy.md) · [/context/stack-and-toolchain.md](../context/stack-and-toolchain.md) · [/memory/release-checklist.md](../memory/release-checklist.md) · [/memory/known-pitfalls.md](../memory/known-pitfalls.md)
