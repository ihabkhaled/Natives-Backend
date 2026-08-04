# UN-P0-INV test strategy

The defect survived a large, well-tested codebase because every existing test
looked at the invitation receipt, which is built from the invitation alone and
was correct throughout. The strategy is therefore built around asserting the
_second_ request and the _resulting rows_, not the rendered outcome.

## Requirement to layer

| Requirement                                                       | Layer                    | Test                                                                                                       |
| ----------------------------------------------------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------- |
| Both requests carry one identical address                         | Unit                     | `invite-member-by-email.service.test.ts` — "gives the membership profile the SAME email as the invitation" |
| Casing/padding cannot split them                                  | Unit                     | same file — "normalizes once, so casing and padding cannot split the two records"                          |
| Normalization is trim + lower-case                                | Unit                     | `member-form.helper.test.ts`                                                                               |
| The wire body nests the address under `profile`                   | Unit                     | `members.gateway.test.ts`                                                                                  |
| Address survives the real client and mock server                  | Integration              | `members-directory-flow.integration.test.tsx` — asserts recorded invitation and membership addresses match |
| The field stays in the published contract                         | Contract                 | `members.contract.test.ts` — "keeps profile.email in the generated invite contract"                        |
| The server accepts the body                                       | Contract                 | `members.contract.test.ts` — "accepts an invite body carrying the invited email"                           |
| The whole journey sends both                                      | E2E                      | `invite-and-switch.spec.ts` — "sends the invited address on BOTH requests"                                 |
| Workbench is unreachable in production                            | Unit                     | `workbench.routes.test.ts` — "registers nothing in production"                                             |
| Detection SQL runs on the real schema                             | Integration (PostgreSQL) | `reconcile-invited-memberships.integration.spec.ts`                                                        |
| Pending repair restores the address only                          | Integration (PostgreSQL) | same file                                                                                                  |
| Accepted repair links, activates, and grants                      | Integration (PostgreSQL) | same file                                                                                                  |
| Two candidate memberships: refused                                | Unit + Integration       | `reconcile-invited-memberships.spec.ts` and the PostgreSQL spec                                            |
| Two invitations over one membership: refused, and no role granted | Unit + Integration       | both specs — the PostgreSQL one asserts zero role assignments                                              |
| No role grant when the link took no row                           | Unit                     | `reconcile-invited-memberships.spec.ts`                                                                    |
| A missing role key fails loudly                                   | Unit                     | `reconcile-invited-memberships.spec.ts`                                                                    |

## Negative and edge cases covered

- Address differing only by case or surrounding whitespace.
- More than one email-less candidate membership in a team.
- More than one orphaned invitation competing for a single candidate
  membership — the case that could grant a role to an account with no
  membership.
- The candidate membership disappearing between the scan and the write.
- A `team_role_key` that has left the role catalog since the invitation issued.
- Dry run mutating nothing (asserted by call count, not by inspection).
- Re-running apply after a repair (idempotent: the second pass finds nothing).

## Falsification

The integration guard was confirmed to fail with the fix reverted
(`expected null to be 'recruit@example.com'`) and to pass with it restored. A
regression test that has never been seen red is not evidence.

## Environments

Client layers run under Vitest with MSW. The PostgreSQL spec runs against the
disposable container in `docker-compose.test.yml`, on a schema created and
reversed by the spec itself.

## Not automated

Production reconciliation against real data. It is operator-run, dry-run first,
and reviewed by a human — deliberately, because the ambiguous cases need
judgement that no test can encode.
