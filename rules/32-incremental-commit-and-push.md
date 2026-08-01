# 32 — Commit and push incrementally

**Non-negotiable rule 53.** Work is committed and pushed in small, self-contained,
green increments — bunch by bunch, as each coherent unit reaches green — **never**
accumulated and pushed only at the very end. A giant end-of-work batch is an
engineering-system risk: it loses work on any interruption, defeats review and
`git bisect`, hides breakage inside noise, and delays integration until the
riskiest possible moment.

## The rule

1. Commit and push each coherent unit of work **as soon as it reaches green** —
   module by module, feature by feature, fix by fix.
2. **Do not** hold multiple independent finished units in the working tree waiting
   for one final mega-commit at the end of the session.
3. One logical unit = one commit + one push. Unrelated units get their own
   commit + push; never bundle them.
4. Every increment must independently pass the **full gate set** (rule 52,
   `rules/31-ci-gates-before-commit-and-push.md`) before it is committed and
   pushed. This composes with the CI-gates rule: every push is green.
5. This does **not** license committing red, broken, or partial code. Increments
   are green and coherent — just small and frequent, not large and deferred.

## Why batching to the end is forbidden

| Failure of end-of-work batching | What small green pushes give you       |
| ------------------------------- | -------------------------------------- |
| Interruption loses all work     | Recoverable — pushed work is safe      |
| Unreviewable giant diff         | Reviewable, focused diffs              |
| `git bisect` useless            | Bisectable — one unit per commit       |
| Breakage hidden in the noise    | Breakage isolated to its own increment |
| Integration delayed to the end  | Continuous integration, earlier signal |

## Concretely

- After a module/feature/fix reaches green, run the full gate set, then commit it
  with a conventional-commit message (lowercase subject) and **push immediately**.
- Keep the working tree from accumulating several independent, already-green units.
  If two changes are unrelated, split them into two commits and two pushes.
- A single logical unit stays a single commit even when it touches several files
  (source + its tests + docs + regenerated `.ai/**` belong together in that one
  commit — see rule 52).
- A batched commit is only acceptable when the batch **is itself one coherent
  unit** whose gates were run and observed green in the same session.

## This is not an excuse to skip gates or ship red

Small and frequent never means fast and loose. Each increment still runs the full
gate set green before commit and before push, still fixes failures at the root
cause, and still rebuilds and commits `.ai/**` when `src/**` or the corpus
changed. Frequency raises the bar; it never lowers it.
