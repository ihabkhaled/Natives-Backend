# UN-P0-INV product requirements

## Stories

1. As an administrator inviting a new person, when I submit the invite form, the
   roster record I create is the one the invitee's account attaches to.
2. As an invited person, when I accept and sign in, I have my team, my role, and
   the navigation those grant.
3. As an operator, I can find every invitation whose membership cannot be
   claimed, and repair the unambiguous ones.

## Acceptance criteria

- The membership request carries the same address as the invitation request,
  normalized identically.
- Casing and surrounding whitespace typed into the form cannot separate them.
- A pending invitation's repair restores the address only; the ordinary accept
  path still performs the linking and the role grant.
- An accepted invitation's repair links the membership, activates it, and grants
  the role the invitation already promised.
- A team holding more than one candidate membership is reported, never guessed.
- Every repair writes an audit row.

## Out of scope

- Replacing the two-request invite composition with a single atomic endpoint.
  Recorded as debt below.
- Contextual "invite this roster member" from the Roles screen
  (pack `06-P1/020`).
- Making acceptance fail loudly when it claims zero memberships. That is a
  behaviour change for invitations already in flight and belongs after
  reconciliation reports clean.

## Definition of done

Requirements above are covered by unit, integration, contract, e2e, and
real-PostgreSQL tests, and the repair is documented for operators.
