# Codebase Cleanup SDLC Baseline

Repository-wide cleanup is a standard-track engineering change, not permission to skip lifecycle phases or rewrite unrelated code.

Before implementation, phases 00–13 must record the baseline, findings by owner, security/validation/auth risk, behavior-preservation strategy, test/coverage plan, rollout, and rollback.

Implementation proceeds in small responsibility slices:

1. pin behavior and negative/security paths;
2. move or delete one concern;
3. update DI/imports/exports/docs;
4. run focused validation;
5. continue only when green.

Completion requires developer validation, defect log, independent QA/security/UAT decisions as applicable, documentation changelog, risk/go-no-go status, and explicit release/hypercare ownership. A local refactor is not a production release.

The engineering procedure is [skills/full-codebase-cleanup.md](../../skills/full-codebase-cleanup.md); canonical rules are [rules/28](../../rules/28-codebase-refactor-discipline.md) and [rules/30](../../rules/30-declaration-ownership.md).
