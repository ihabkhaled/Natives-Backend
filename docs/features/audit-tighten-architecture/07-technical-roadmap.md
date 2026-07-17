# 07 — Technical Roadmap

## Engineering milestones

| Milestone | Slice                                 | Branch strategy                                            |
| --------- | ------------------------------------- | ---------------------------------------------------------- |
| M1        | Formatting only                       | One commit on the feature branch.                          |
| M2        | Docs alignment + AI agent entrypoints | One commit or stacked commits on the same branch.          |
| M3        | ESLint rules + tests                  | One commit per rule or one commit for all new rules.       |
| M4        | Reference-app refactor                | One commit.                                                |
| M5        | Validation evidence                   | Update artifacts in the same branch; no additional branch. |

## Rollout sequence

1. `npm install` to ensure local dependencies are present.
2. `npm run format` to normalize the governance tree.
3. Create feature artifacts and audit report.
4. Update governance docs and add entrypoints.
5. Add ESLint rules and rule tests; run `npm run lint` after each rule.
6. Refactor the reference app; run `npm run test` after each change.
7. Run the full validation matrix.
8. Update documentation-changelog and dev-validation artifacts.

## Rollback sequence

- The work is source-control only. If a rule causes false positives, revert the specific rule file and its config entry; do not weaken the rule globally.
- If a reference-app test breaks, revert the relevant file change and fix the test before re-applying.

## Flag and compatibility notes

- No feature flags are required.
- The changes are backward-compatible for the reference app API (HTTP contract remains the same).
- The ESLint rules apply to all future code; existing code is brought into compliance.

## Schema evolution plan

No schema changes. The in-memory repository stays unchanged in shape.

## Known migration notes

- Consumers of the repository who copied the old `ArticlesService` pattern (importing DTOs) will need to update their code after pulling these changes. This is intentional and documented in the architecture rules.
