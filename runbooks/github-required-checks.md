# GitHub Required Checks Runbook

## Purpose

Activate and maintain IronNest merge gates without creating a lockout or allowing unverified changes into `main`.

## Preconditions

- Workflow changes were reviewed and pushed.
- Each workflow completed successfully at least once.
- The operator has repository administration permission.
- No required check is being renamed or removed during an active pull request.

## Required check names

Require all seven:

1. `lint`
2. `typecheck`
3. `test:unit`
4. `test:e2e`
5. `test:coverage`
6. `build`
7. `security:scan`

## Activation

1. Open repository Settings → Rules → Rulesets (preferred) or Branches → Branch protection.
2. Target the `main` branch.
3. Require a pull request before merging.
4. Require status checks to pass and select the seven names above.
5. Require branches to be up to date before merging.
6. Block force pushes and branch deletion.
7. Do not permit bypass for ordinary contributor or agent workflows.
8. Save the ruleset and validate it with a test pull request.

Do not guess check names before their first remote run; GitHub only offers checks it has observed.

## Validation

Use a pull request that changes documentation only:

1. Confirm all seven checks start.
2. Confirm each check links to its own workflow/job logs.
3. Confirm merge is blocked while a check is pending.
4. Confirm merge is blocked when a check fails.
5. Confirm merge becomes available only after every check passes and review requirements are met.
6. Confirm Trivy SARIF appears under Security → Code scanning for same-repository events.

## Troubleshooting

- Check never appears: verify trigger, workflow syntax, Actions enablement, and exact job `name`.
- Check remains expected: the configured name differs from the workflow job name or the workflow did not run for the commit.
- SARIF upload fails on a fork: fork pull requests receive read-only tokens, so upload is skipped while the blocking scan still runs.
- `npm ci` rejects Node: ensure `.nvmrc`, `package.json` engines, and runner setup agree.
- Gate is flaky: treat it as a defect; do not normalize reruns or make the check optional.

## Rollback

1. Remove an old required-check entry before removing or renaming its workflow.
2. Revert or replace the workflow.
3. Run the replacement check successfully.
4. Add the replacement check to the ruleset.
5. Revalidate merge blocking with a pull request.

Never leave branch protection requiring a check that can no longer be emitted.
