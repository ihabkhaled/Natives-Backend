# UN-P0-INV technical roadmap

## Slices, in the order they landed

1. `fix(members): give the invited membership the email acceptance links by` —
   types, gateway, service, the normalization owner, and four guards (unit,
   integration, contract, e2e).
2. `fix(ui-workbench): keep the internal component gallery out of production` —
   carried in the same branch. Unrelated to invitations, but the same P0 batch
   (pack `05-P0-RELIABILITY/145`).
3. Reconciliation routine, CLI, unit spec, real-PostgreSQL integration spec, and
   the operator runbook entry.

## Branch strategy

`fix/invitation-membership-linking` in each repository, branched from `main`.
Each repository keeps its own commits.

## Schema evolution

None. Reconciliation writes to existing columns only. The atomic redesign that
would add `invitations.membership_id` is deliberately not in this batch.

## Release sequence

Client repair, then reconciliation dry run, then apply. See
`05-delivery-plan.md`.
