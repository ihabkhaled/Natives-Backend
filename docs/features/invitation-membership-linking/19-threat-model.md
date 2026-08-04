# UN-P0-INV threat model

## Scope

The invite request body, and the reconciliation routine's writes.

## Assets

Team membership (who is on a roster), team role assignments (what they may do),
and the email addresses on member profiles.

## Trust boundaries

1. Browser to API — the invite request. Unchanged: the address was already sent
   on the invitation request; this change adds it to a second request going to
   the same authenticated, permission-guarded endpoint.
2. Operator to database — the reconciliation CLI. New. It runs with database
   credentials and no acting principal.

## Threats considered

| #   | Threat                                                                 | Assessment                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T1  | Reconciliation attaches an account to the wrong person's roster record | The real risk. Mitigated by acting only when the pairing is forced: one email-less candidate membership in the team AND one orphaned invitation competing for it. Anything else is reported and skipped. Dry run is the default                                                                                                                                                                                                                     |
| T1b | Reconciliation grants a role to somebody it did not link               | Found by reviewing the first implementation, not by a test. Two orphaned invitations over one candidate membership both passed the single-candidate rule, both named the same row, and the second still reached the grant after its link matched nothing — a team role for an account with no membership. Closed twice over: the invitation count makes that team ambiguous, and the grant is now conditional on the guarded UPDATE returning a row |
| T2  | Reconciliation grants a role the inviter could not have granted        | Not possible: the key comes from `invitations.team_role_key`, ceiling-validated by `assertGrantable` when the invitation was issued. A key that has since left the catalog throws rather than falling back                                                                                                                                                                                                                                          |
| T3  | Reconciliation escalates an existing account                           | It only links memberships with `user_id IS NULL` and only inserts a role assignment when no live one exists for that user, role, and team                                                                                                                                                                                                                                                                                                           |
| T4  | Reconciliation runs unintentionally                                    | Not wired to startup, migrations, or seeds. Dry run without `--apply`; the whole apply is one transaction                                                                                                                                                                                                                                                                                                                                           |
| T5  | Email disclosure through the new request field                         | The address is one the caller just typed and already sent on the invitation request. No new information crosses the boundary                                                                                                                                                                                                                                                                                                                        |
| T6  | SQL injection through the role key or email                            | Every value is a bound parameter. The only interpolated string is the role key inside an error message, outside SQL                                                                                                                                                                                                                                                                                                                                 |
| T7  | Public workbench exposes internal surfaces                             | Closed by not registering the route in production. Not a permission check, so it does not depend on RBAC resolving                                                                                                                                                                                                                                                                                                                                  |
| T8  | Audit gap on privileged repair                                         | Every repair writes `security_events` with `reconciliation: true` and the invitation, membership, and team ids                                                                                                                                                                                                                                                                                                                                      |

## Residual risk

T1 is reduced, not eliminated: a team with exactly one email-less candidate and
exactly one orphaned invitation, where the roster row genuinely belongs to
somebody else, would still be matched. Accepted because the dry run is reviewed
by a human before `--apply`, and every link is auditable and individually
reversible.

T1b is closed. The value of the second mitigation is that it does not depend on
the first being right: even if some future scan marks a pair repairable that
should not be, no role is granted unless that specific membership was actually
taken by that specific repair.
