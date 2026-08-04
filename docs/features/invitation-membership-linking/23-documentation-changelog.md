# UN-P0-INV documentation changelog

| Document                                           | Change                                                                                                                                    | Why                                                                                                                                          |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/identity.md`                                 | New section "Reconciling invitations whose membership carries no email", plus a runbook line mapping the reported symptom to this cause   | Support hears "my menu is empty" or "Practice is forbidden", neither of which points at invitations. The mapping is the whole value          |
| `Natives-App` `src/modules/ui-workbench/README.md` | New "Where it is available" section and an invariant                                                                                      | Records that the route is non-production, that this is deliberately not a permission check, and that the container still ships in the bundle |
| `docs/features/invitation-membership-linking/`     | This artifact set                                                                                                                         | Repository SDLC policy                                                                                                                       |
| Code comments                                      | The invite service, gateway, `InviteMemberInput`, the reconciliation routine, and each guard test carry the failure they exist to prevent | The defect was invisible precisely because nothing said what the address was for                                                             |

## Not changed

- **OpenAPI contract** — unchanged; `profile.email` was already published.
- **Architecture map / ADRs** — no decision changed.
- **Release notes** — the user-visible change is "invitations now work"; drafting
  that belongs with the release, which has not happened.

## Remaining gap

`docs/identity.md` documents the reconciliation but the older
`backfill:member-roles` CLI is still undocumented in markdown. Out of scope
here; the new section cross-references it so the difference between the two is
at least discoverable.
