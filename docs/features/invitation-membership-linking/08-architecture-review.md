# UN-P0-INV architecture review

## Client

The repair stays inside the members module. The gateway builds the request body,
the service owns composition and normalization, the hook stays a form binding.
No layer boundary moved and no new dependency appeared.

`InviteMemberInput` was split so the two concepts are visible in the type system:
`InviteProfileInput` is what the form collects, and `InviteMemberInput` is what
the wire carries — that profile plus the address the linkage depends on. The
split is what makes it hard to reintroduce the defect by writing a new caller.

The MSW fake server grew a recorder for both addresses. `members-handlers.ts`
would have crossed the 300-line module limit, so the invitation handlers moved
to `members-invite-handlers.ts` and the shared actor/URL helpers to
`members-actor.helper.ts` — the rule was satisfied by moving code, not by
raising the limit.

## Server

The reconciliation follows the shape `backfill-member-roles` already
established: a `QueryRunner`-based routine under `src/database/seeds`, a thin
CLI that owns the transaction, dry-run by default, `--apply` to act.

It deliberately stays out of the application layer. Booting the Nest application
context and calling `linkUserAndActivate` and `ensureTeamRole` would drag
request-scoped concerns — an acting principal, permission checks, a resolved
team context — into a job that has no actor. The existing backfill made the same
trade-off, and consistency with it is worth more than removing the small amount
of duplicated SQL.

The cost of that choice is real: the repair writes membership and role rows
without going through the state machine that normally guards them. It is
mitigated by the `WHERE` clauses reproducing the state machine's preconditions
(`user_id IS NULL AND status = 'invited' AND deleted_at IS NULL`), by the
duplicate-guarded role insert, and by the real-PostgreSQL integration spec.

## ADR

No new ADR. Neither change alters a decision an existing ADR records.
