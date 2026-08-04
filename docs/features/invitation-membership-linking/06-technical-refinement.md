# UN-P0-INV technical refinement

## Alternatives for the client repair

1. **Pass the address through the invite service to both requests.** Chosen.
   The service already receives it, so both writes are constructed from one
   value and cannot drift. Smallest possible change, no contract change.
2. **Add the address at the form/hook layer.** Rejected: the hook would hand the
   same value to two separate fields, which is the duplication that let them
   diverge in the first place.
3. **Replace both requests with one atomic backend endpoint.** The correct end
   state, and what the pack's `020`/`030`/`040` prompts describe. Rejected for
   this batch: it needs a migration (`invitations.membership_id`), a new members
   public surface, an acceptance path keyed on membership id, and a contract
   revision — none of which help the people who are broken right now, and all of
   which carry more risk than adding a field the server already accepts.
   Recorded as debt in `13-implementation-readiness.md`.

## Alternatives for repairing existing data

1. **Match invitation to membership by team plus a single email-less
   candidate.** Chosen. Refuses to act when more than one candidate exists.
2. **Match by creation-timestamp proximity.** Rejected: a heuristic that is most
   confident exactly when it is most likely to be wrong.
3. **Report only, repair by hand.** Rejected as the whole answer — it leaves
   every stranded person stranded — but kept as the behaviour for ambiguous
   rows.

## Why the role grant is not an escalation

The role comes from `invitations.team_role_key`, which
`EnsureRoleAssignmentService.assertGrantable` validated against the inviter's
privilege ceiling when the invitation was issued. Reconciliation delivers a
promise the system already made and audited. The only thing it infers is which
membership row that promise attaches to.

## Normalization

Trim and lower-case, owned by `normalizeInviteEmail` in the members form helper.
The claim query already compares case-insensitively, so casing is not strictly
required; it is applied anyway so the two stored values are byte-identical and a
human comparing them in a support session sees an obvious match.
