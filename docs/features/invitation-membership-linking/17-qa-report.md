# UN-P0-INV QA report

## Inputs

Both branches at `fix/invitation-membership-linking`, the test strategy in
`11-test-strategy.md`, and the acceptance criteria in
`03-product-requirements.md`.

## Scenario matrix

| #   | Scenario                                                                   | Layer                    | Result                                             |
| --- | -------------------------------------------------------------------------- | ------------------------ | -------------------------------------------------- |
| 1   | Administrator invites a new person; both requests carry the same address   | E2E + integration + unit | Pass                                               |
| 2   | Address typed with padding and mixed case                                  | Unit + integration       | Pass — both requests receive `recruit@example.com` |
| 3   | Invite form refuses an empty address before any request                    | E2E                      | Pass (pre-existing)                                |
| 4   | Invitation refused (duplicate / above ceiling) leaves no orphan roster row | Unit                     | Pass (pre-existing, still green)                   |
| 5   | Member persona never sees the invite affordance                            | E2E + integration        | Pass                                               |
| 6   | `profile.email` present in the published contract                          | Contract                 | Pass                                               |
| 7   | Server accepts an invite body carrying the address                         | Contract                 | Pass                                               |
| 8   | `/workbench` registered outside production                                 | Unit                     | Pass                                               |
| 9   | `/workbench` not registered in production                                  | Unit                     | Pass                                               |
| 10  | Reconciliation dry run mutates nothing                                     | Unit                     | Pass — asserted by query count                     |
| 11  | Pending invitation: address restored, membership untouched                 | PostgreSQL               | Pass                                               |
| 12  | Accepted invitation: membership linked, activated, role granted once       | PostgreSQL               | Pass                                               |
| 13  | Two email-less candidates: refused and reported                            | Unit + PostgreSQL        | Pass                                               |
| 14  | Role key absent from the catalog                                           | Unit                     | Pass — throws rather than granting something else  |
| 15  | Clean database: reconciliation finds nothing                               | PostgreSQL               | Pass                                               |

## API validation

`POST /teams/:teamId/members/invite` accepts `profile.email` and returns a
membership with status `invited` (contract test 7). `PlayerProfileDto.email` is
present in `contracts/openapi.json` 1.7.0 (contract test 6).

## Findings

None outstanding. The seven issues found during development are logged in
`16-dev-bug-log.md`; all were gate or test defects, resolved before commit.

## QA decision

**Pass for the scope delivered**, with the limitation recorded in
`13-implementation-readiness.md`: the invite is still two requests, so a network
failure between them reproduces the same end state by a different route.

## Not covered by QA here

No independent QA pass was performed against a deployed environment. Everything
above is automated-suite evidence on local branches. Deployed persona testing is
the outstanding gate — see `22-go-no-go.md`.
