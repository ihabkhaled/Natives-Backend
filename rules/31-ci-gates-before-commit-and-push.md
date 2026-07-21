# 31 — CI gates before commit and push

**Non-negotiable rule 52.** Every CI gate must be green **before** you commit and
**before** you push. A red gate on `main` is an outage of the engineering system:
it hides the next real defect behind noise, and it teaches the team to ignore the
signal that is supposed to stop bad code.

## The rule

1. Run the full local gate set and see it pass **before** `git commit`.
2. Run it again **before** `git push` if anything changed after the commit.
3. Never push knowing a gate is red. "CI will tell me" is not a plan — CI telling
   you is the failure, not the check.
4. Never merge, tag, or release while any required check is failing.

## The full gate set (all must pass)

Run `npm run validate` (the aggregate) or each gate individually:

| Gate                         | Command                                                               | What it protects                           |
| ---------------------------- | --------------------------------------------------------------------- | ------------------------------------------ |
| Formatting                   | `npm run format:check`                                                | Diff noise, review signal                  |
| Lint                         | `npm run lint`                                                        | Architecture rules, zero warnings          |
| Typecheck                    | `npm run typecheck`                                                   | Type safety                                |
| Unit tests                   | `npm run test:unit`                                                   | Behaviour                                  |
| Coverage                     | `npm run test:coverage`                                               | Coverage floors 95/90/95/95                |
| E2E                          | `npm run test:e2e`                                                    | Transport, authorization matrix            |
| Build                        | `npm run build`                                                       | Compilable, shippable output               |
| **Knowledge build/validate** | `npm run knowledge:build` then `knowledge:check` + `knowledge:verify` | The `.ai/` layer matching the real corpus  |
| OpenAPI contract             | `npm run contract:check`                                              | The canonical cross-repository contract    |
| Security                     | `npm run security:audit` + `npm run security:scan`                    | Vulnerabilities, secrets, misconfiguration |
| **All gates green**          | every job above                                                       | The aggregate signal a release depends on  |

## Knowledge gates are not optional

`knowledge:check` fails whenever a `src/**/*.ts` file or a corpus document
(`rules|skills|context|memory|agents|testing`) changed without rebuilding `.ai/`.
That is a **real staleness defect**, not a formality: `.ai/` is what an agent reads
to orient itself, so a stale manifest routes the next contributor — human or
model — to the wrong file.

**Therefore: after ANY change under `src/**` or the corpus, run
`npm run knowledge:build` and commit the regenerated `.ai/**` in the same commit.**

## All-gates-green is the release signal

The aggregate job exists so one check can gate a merge or a release. It is green
only when every individual gate is green. Never mark it optional, never make a
failing gate `continue-on-error` to get it passing, and never treat a red
aggregate as "probably just flake" — investigate the specific job that failed.

## Fixing, not bypassing

When a gate fails:

1. Read the actual failing job log — do not guess.
2. Fix the **root cause** in the correct layer.
3. Re-run the gate and confirm it passes.

Forbidden ways to "make it pass":

- weakening or deleting a rule, threshold, or coverage floor
- adding an undocumented `eslint-disable` / `@ts-ignore`
- deleting, skipping, or `.only`-ing a test
- excluding a logic file from coverage
- marking a required check optional or `continue-on-error`

`--no-verify` is permitted **only** for a batched commit whose gates were already
run and observed green in the same session; it is never a way to skip a red gate.

## Environment honesty

A gate that genuinely cannot run in the current environment (no Docker, no
Android SDK, no macOS) is reported **UNVERIFIED with the exact reason** — never
claimed as passing. CI runs it on a suitable runner.
