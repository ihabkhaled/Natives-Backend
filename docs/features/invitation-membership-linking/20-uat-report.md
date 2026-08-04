# UN-P0-INV UAT

## Status

**Script prepared; not executed.** UAT for this change means inviting a real
person into a real team and watching them sign in. That needs an authenticated
session against a deployed environment and a controlled mailbox, neither of
which was available. Nothing below is reported as passed.

Automated evidence covering the same behaviour is in `17-qa-report.md`. It is
not a substitute: it proves the requests carry the same address, not that a
human ends up with a working application.

## Preconditions

- A deployed build containing the client repair. Confirm the build identity
  before starting — a stale service worker serving the previous bundle would
  reproduce the defect and look like a failed fix.
- A team administrator account.
- A mailbox the tester controls. Never a real member's address.
- Test records prefixed `[AUDIT-<UTC timestamp>]` per the pack's production-data
  policy.

## UAT-1 — A newly invited member can actually use the product

1. Sign in as the team administrator. Open Members.
2. Invite, using the controlled mailbox: full name, team role **Member**.
3. **Expect** the receipt to state the team, the granted role, and a one-time
   accept link.
4. Open the accept link in a clean profile (no shared session). Set a password.
5. **Expect** to land signed in, on Home, with a dashboard that has content —
   not "your dashboard has no cards for your role yet".
6. **Expect** navigation to include the Member destinations: Practices, My
   Attendance, My Points, Leaderboard, Team.
7. Open **Practices**. **Expect** the calendar to load — an honest empty state
   is a pass; a permission error is a failure.
8. Open **My Attendance**. **Expect** it to load.
9. Sign out, sign back in. **Expect** the same navigation. Team context must
   survive a fresh session, not just the one issued at acceptance.

**Fails if** the menu shows only Home, Notifications, and Settings. That is the
original defect.

## UAT-2 — The roster agrees with the account

1. As the administrator, open Members and find the invited person.
2. **Expect** status **active**, not still **invited**.
3. Open their Roles. **Expect** the role controls to be usable, and **not** the
   message "this member hasn't joined with an account yet".

## UAT-3 — Casing and spacing do not break it

1. Repeat UAT-1 typing the address with a leading space and mixed case, e.g.
   ` Player.Two@Example.com`.
2. **Expect** an identical result. The stored address should be trimmed and
   lower-cased.

## UAT-4 — Each grantable role

Repeat UAT-1 for Coach, Analyst, and Scorekeeper. **Expect** each to land with
that role's navigation, and **expect** no role to receive management surfaces it
should not have.

## UAT-5 — Repairing someone already stranded

Run only if UAT-1 to UAT-4 pass.

1. Identify an existing stranded person: accepted invitation, account exists, no
   membership in the team.
2. Run `npm run reconcile:invited-memberships` against that environment.
3. **Expect** the dry run to list them as `repairable`, and to write nothing.
4. Review every listed row. **Expect** any `ambiguous` row to be left alone.
5. Re-run with `--apply`.
6. Have that person sign in. **Expect** the UAT-1 outcome.
7. Re-run the dry run. **Expect** nothing to reconcile.

## UAT-6 — The workbench is gone

1. Signed out, open `/workbench` on the deployed frontend.
2. **Expect** the product's ordinary not-found page — no component gallery, no
   mock records.

## Cleanup

Deactivate or archive every `[AUDIT-...]` member created, revoke unused
invitations, and record what was removed. Do not hard-delete or anonymize
anything belonging to a real person.

## Sign-off

| Role                                  | Name | Decision | Date |
| ------------------------------------- | ---- | -------- | ---- |
| Business owner                        |      |          |      |
| Team administrator (executing tester) |      |          |      |
