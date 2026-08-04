# UN-P0-INV cross-functional refinement

| Function   | Finding                                                                                                                                                                                                            |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Backend    | The server was already correct: `PlayerProfileDto.email` is accepted and persisted, and acceptance is atomic and grants the invited role. The defect was entirely in what the client sent.                         |
| Frontend   | The address existed in the invite service the whole time; it was passed to one of the two requests. Normalization was duplicated at the call site (`form.email.trim()`), which is how the two values could differ. |
| QA         | No existing test asserted the second request's body. Every test checked the receipt, which is built from the invitation alone and looked correct throughout.                                                       |
| Security   | Reconciliation grants a team role, so it must derive that role from the invitation rather than infer it, and must refuse ambiguous matches.                                                                        |
| Operations | Repair must be dry-run first, transactional, and audited, and must never run at startup.                                                                                                                           |
| Support    | The symptom presents as "my menu is empty" or "Practice is forbidden", neither of which points at invitations. The runbook needs that mapping.                                                                     |

## Hidden work surfaced

- Existing stranded memberships are not fixed by fixing the client. They need
  their own repair path, which is the larger half of this request.
- `backfill:member-roles` looked like it already covered this. It does not: it
  only considers memberships that are already linked (`user_id IS NOT NULL`).
  The memberships this defect produces are never linked at all.

## Open questions

- Whether acceptance should reject a team invitation that claims zero
  memberships. Deferred deliberately — see `03-product-requirements.md`.
