# UN-P0-INV internal bug log

| #   | Found during                       | Issue                                                                                                                                                                          | Severity      | Resolution                                                                                                                  |
| --- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 1   | Lint after adding the MSW recorder | `members-handlers.ts` invite handler complexity reached 9 against a limit of 8                                                                                                 | Blocking gate | Extracted `createInvitedMember`. Rule not weakened                                                                          |
| 2   | Lint, immediately after            | Same file crossed the 300-line module limit at 302                                                                                                                             | Blocking gate | Moved the invitation handlers to `members-invite-handlers.ts` and the shared actor/URL helpers to `members-actor.helper.ts` |
| 3   | Typecheck                          | `contract.components.schemas.PlayerProfileDto` rejected — index-signature access                                                                                               | Blocking gate | Bracket access                                                                                                              |
| 4   | First PostgreSQL run               | Reconciliation unit spec mocked `QueryRunner.query` by call order; the accepted-invitation path runs a different number of writes, so the role lookup landed on the wrong call | Test defect   | Replaced with a mock that answers by statement content                                                                      |
| 5   | First PostgreSQL run               | Integration spec never ran its migrations                                                                                                                                      | Test defect   | Added `beforeAll(runMigrations)`                                                                                            |
| 6   | Second PostgreSQL run              | `member_profiles.team_id` is NOT NULL; the seed omitted it                                                                                                                     | Test defect   | Seed writes `team_id`                                                                                                       |
| 7   | Backend lint                       | Three loop and assertion forms rejected in sequence (`prefer-for-of`, `no-unused-vars`, `no-unnecessary-type-assertion`)                                                       | Blocking gate | Introduced a typed `selectRows` helper and unrolled the migration teardown, matching the existing spec's style              |

| 8 | Self-review of the committed reconciliation | **Behaviour defect.** Two orphaned invitations over one candidate membership both passed the single-candidate rule. Both named the same row; the first repair took it; the second's guarded `UPDATE` matched nothing — and the code still called `grantInvitedRole`, assigning a team role to an account with no membership in that team | **High** — the exact privilege shape `19-threat-model.md` claimed was impossible | Two independent fixes: the scan now requires exactly one orphaned invitation per team as well, and the grant is conditional on the link `UPDATE` returning a row. Both verified by removing them and watching the new PostgreSQL test fail |

## Stability

No open internal defects.

Items 1–7 were gate or test defects caught before commit. **Item 8 was a real
behaviour defect, in code that had already been committed**, found by re-reading
the SQL rather than by any test — the unit spec, the PostgreSQL spec, lint,
typecheck, and the full 5436-test suite were all green over it.

Worth stating plainly: the threat model had already asserted that reconciliation
could not grant a role to somebody it had not linked. It was wrong, and it was
wrong in the document that exists specifically to catch that. The lesson is not
"review more"; it is that a claimed invariant deserves a test that fails when
it is violated, and this one now has two.
