# UN-P0-INV retrospective

## What went well

- The audit started from current source rather than the prompt pack's audited
  baseline. Four of the five P0s the pack's predecessor recorded were already
  fixed; only two were still live. Re-verifying saved rebuilding work that had
  already shipped.
- The fix was tiny because the server was already right. Reading both sides
  before writing anything is what kept this from becoming an endpoint redesign.
- Reverting the fix to watch the new guard fail took two minutes and was worth
  it. It is the only thing that distinguishes a regression test from a comment.

## What did not

- **A well-tested codebase tested the wrong thing.** Six thousand frontend tests
  and the invite flow still shipped broken, because every test asserted the
  receipt — which is built from the invitation alone and looked right the entire
  time the defect was live. Nothing asserted the second request's body.
- **The type system was not asked to help.** `InviteMemberInput` described the
  wire payload but omitted the field the whole linkage depended on, so leaving
  it out was not an error — it was the only option.
- **A near-miss on the same class of mistake.** The security review was written
  claiming the CLI does not log addresses, while a comment in that CLI said the
  report "has to name them". The code was right and the comment was wrong, but
  the comment is what a future reader would have believed.

- **The threat model asserted an invariant the code did not hold.** It said
  reconciliation could not grant a role to somebody it had not linked. With two
  orphaned invitations over one candidate membership, it could — see item 8 in
  `16-dev-bug-log.md`. Everything was green over that defect: both specs, lint,
  typecheck, and 5436 backend tests. It was found by re-reading the SQL, which
  is the least reliable detection method available.

  This is the same failure as the original defect, one level up. The original
  bug survived because 6000 tests asserted the wrong thing. This one survived
  because the document that names the danger was not connected to anything that
  could fail.

## Improvements

1. When two requests must agree on a value, construct both from one variable in
   one function. The bug was possible because two call sites each formatted the
   address independently.
2. Test the request, not only the render, wherever the render is built from
   different data than the thing under test.
3. Documenting an invariant is not the same as enforcing it. The invite service
   now derives the second address from the first; that, not the comment above
   it, is what holds.
4. Every line in a threat model that says "cannot happen" is a test that has not
   been written yet. Both mitigations for T1b were verified by removing them and
   watching a test go red — the claim is now falsifiable, which is the only
   thing that makes it worth writing down.
5. Prefer guards that do not depend on each other being right. The invitation
   count and the conditional grant close the same hole independently; if a
   future change gets the scan wrong, the write still refuses.

## Standing rules to add

None. Every rule needed here already existed in `rules/` — reuse before
creating, declaration ownership, move the code when a limit is hit. They were
followed, including when lint pushed back three times in a row.

## Follow-ups

The three accepted debts in `13-implementation-readiness.md`, in order of value:

1. Make acceptance refuse a team invitation that claims zero memberships — after
   reconciliation reports clean.
2. Collapse the two invite requests into one atomic endpoint (pack `020`–`040`).
3. Lazy-load the workbench container so production stops shipping it.
