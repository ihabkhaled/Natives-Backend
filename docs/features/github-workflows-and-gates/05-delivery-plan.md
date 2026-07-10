# 05 — Delivery Plan

## Workstreams

1. Restore runtime/toolchain pin and authoritative CI scripts.
2. Add seven single-purpose workflows.
3. Repair Dependabot.
4. Add CI/branch-protection documentation and operational guidance.
5. Validate scripts locally, statically inspect workflow YAML, and run all repository gates.
6. Complete post-implementation evidence for review.

## Milestones

- M1: phases 00–13 approved for implementation.
- M2: workflows and scripts implemented.
- M3: local clean gates and workflow consistency review complete.
- M4: owner review.
- M5: later commit/push and GitHub required-check configuration.

## Rollout

After review, commit and push workflows. Observe first Actions run, then configure `main` to require the seven documented checks.

## Rollback

Revert workflow/config/script/docs files together. Branch-protection settings, if later applied, must be relaxed before reverting check names.
