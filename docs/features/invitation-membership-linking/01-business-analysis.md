# UN-P0-INV business analysis

## Problem

Inviting somebody into a team does not produce a person who can use the product.
The invitee receives a link, sets a password, signs in — and lands in an
application with no team, no role, and a navigation menu reduced to the
destinations that need no permission. Practice is forbidden even though the
Member bundle grants `practice.read`.

## Who is affected

- **Every invited person.** This is the only route into the product; there is no
  open self-registration.
- **Team administrators**, who see the invitation reported as accepted while the
  member stays `invited` and unlinked in the roster, and whose Roles screen then
  refuses to assign anything because the member has no linked account.
- **The club**, which cannot onboard players, coaches, analysts, or scorekeepers
  at all.

## Current state

Two records, two requests. The invitation carries the address. The membership
does not. Acceptance links them by comparing the two addresses, so it claims
nothing, grants nothing, and still reports success.

## Desired state

An accepted invitation produces a linked, active membership with the promised
team role, and the memberships already stranded by this defect are repaired.

## Success metrics

- A newly invited member signs in, sees the intended navigation, and opens
  Practice.
- Zero accepted team invitations whose account holds no membership in that team.
- The reconciliation dry run reports nothing to repair.

## Cost of not doing it

The product cannot onboard anyone. Every other completed module is unreachable
for every user who was not seeded directly into the database.
