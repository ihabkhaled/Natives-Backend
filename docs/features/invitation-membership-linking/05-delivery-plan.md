# UN-P0-INV delivery plan

| #   | Workstream                                                                         | Repo            | Status |
| --- | ---------------------------------------------------------------------------------- | --------------- | ------ |
| 1   | Thread the invited address into the membership profile, single normalization owner | Natives-App     | Done   |
| 2   | Guard it at unit, integration, contract, and e2e level                             | Natives-App     | Done   |
| 3   | Reconciliation for memberships already written without the address                 | Natives-Backend | Done   |
| 4   | Operator documentation and support runbook entry                                   | Natives-Backend | Done   |

## Sequencing

The client repair ships without a server change: `profile.email` is already in
the published contract (1.7.0), so the two repositories are independent here and
the usual backend-contract-first rule does not bind.

Reconciliation is independent of the client repair and can land in either order.
Running it before the client repair is deployed is still correct — it simply has
more to repair on the next run.

## Rollout

1. Deploy the client repair. New invitations are correct from that moment.
2. Run `npm run reconcile:invited-memberships` (dry run) against production and
   review the plan.
3. Resolve any `ambiguous` rows by hand.
4. Re-run with `--apply`.
5. Re-run the dry run; it should report nothing.

## Rollback

The client repair is a request-body addition; reverting the commit restores the
previous behaviour with no data migration.

Reconciliation has no automatic rollback — it is forward-only data repair. That
is precisely why the dry run is the default, why the whole apply runs in one
transaction, and why ambiguous rows are refused rather than guessed.
