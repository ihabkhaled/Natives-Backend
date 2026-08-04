# UN-P0-INV engineering standards review

| Standard                                            | Verdict                                                                                                                                                                              |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `rules/00-non-negotiable-rules.md`                  | Met                                                                                                                                                                                  |
| `rules/04-repositories-and-persistence.md`          | Met — every statement parameterized; no string interpolation of values                                                                                                               |
| `rules/08-database-and-injection-safety.md`         | Met — the only interpolated value anywhere is the role key inside an error message, not inside SQL                                                                                   |
| `rules/19-async-events-and-jobs.md`                 | Met — operator-invoked, transactional, terminal, reports what it did                                                                                                                 |
| `rules/22-reuse-before-creating.md`                 | Followed the existing `backfill-member-roles` shape rather than inventing a second one; the deviation from reusing the application services is argued in `08-architecture-review.md` |
| `rules/23-function-service-file-size-discipline.md` | Met — the routine is decomposed into named single-purpose functions                                                                                                                  |
| `rules/30-declaration-ownership.md`                 | Met — no inline contracts; row and result shapes live in `reconcile-invited-memberships.types.ts`, strings in `.constants.ts`                                                        |
| Frontend `rules/32` (CI gates before commit)        | `npm run quality` run green before each frontend commit                                                                                                                              |
| Frontend `rules/33` (incremental commits)           | Two commits, each independently green                                                                                                                                                |

## Request-specific constraints adopted

- Reconciliation must never guess which membership belongs to an invitation.
  One candidate or nothing.
- Reconciliation must never invent a role. It uses the invitation's own
  ceiling-validated `team_role_key`, and fails loudly if that key has left the
  catalog.
- Email normalization has exactly one owner in the client.

## Permanent-rule updates

None. No new standing rule emerged; the existing rules covered this work.
