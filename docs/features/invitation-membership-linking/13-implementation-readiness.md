# UN-P0-INV implementation readiness

- **Branch**: `fix/invitation-membership-linking` in each repository.
- **Flags**: none. The client repair is unconditional; the workbench gate keys
  off the existing `isProduction` execution context.
- **Config**: none.
- **Migrations**: none.
- **Rollback**: revert the client commit (no data implications). Reconciliation
  is forward-only; see `05-delivery-plan.md`.
- **Observability**: repairs land in `security_events` with
  `reconciliation: true`.

## Accepted debt

1. **The invite is still two requests.** The repair makes them carry the same
   address; it does not make them atomic. A network failure between them still
   leaves an invitation with no membership, and acceptance will then claim
   nothing — the same end state, from a different cause. Closing this needs the
   atomic endpoint described in pack prompts `020`/`030`/`040`:
   `invitations.membership_id`, a members public surface for creating the
   invited membership inside the caller's transaction, and acceptance keyed on
   membership id instead of email discovery.

2. **Acceptance still succeeds silently when it claims zero memberships.** It
   should refuse, so the invitation stays pending and is recoverable rather than
   spent. Deferred because flipping it while invitations created by the old
   client are still in flight converts a silent failure into a hard one for
   people mid-onboarding. The order is: deploy the client repair, reconcile
   until the dry run is clean, then make acceptance strict.

3. **The workbench container still ships in the production bundle.** It is
   unreachable, but present, because routes are statically imported. Making it a
   lazy chunk would remove the code as well.

## Readiness gaps

None blocking. The three items above are recorded, not hidden.
