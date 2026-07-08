# 11 — Test Strategy

## Requirement-to-test mapping

| Requirement                        | Test layer                                                                 | Evidence                       |
| ---------------------------------- | -------------------------------------------------------------------------- | ------------------------------ |
| Controllers stay thin              | ESLint rule `architecture/controller-no-logic` + existing controller tests | `npm run lint`                 |
| Services do not import API DTOs    | New ESLint rule `architecture/no-dto-import-in-application-layer`          | Rule fixtures + `npm run lint` |
| Domain layer owns entity creation  | Unit test for `article.factory.ts`                                         | `npm run test`                 |
| Repository saves complete entities | Unit test for `ArticleRepository.save`                                     | `npm run test`                 |
| Service orchestrates correctly     | Unit tests for `ArticlesService`                                           | `npm run test`                 |
| New ESLint rules detect violations | Rule tests under `test/eslint/`                                            | `npm run test`                 |
| No layer declaration leaks         | New rule `architecture/no-inline-layer-declarations`                       | Rule fixtures + `npm run lint` |
| Happy and error paths              | Existing service + e2e tests                                               | `npm run test`                 |
| Validation boundaries              | Existing DTO + e2e tests                                                   | `npm run test`                 |

## Test layers

- **Unit tests**: `src/**/*.spec.ts` for services, repositories, factories, mappers, core helpers.
- **ESLint rule tests**: `test/eslint/architecture-plugin/**/*.spec.ts` using `RuleTester`.
- **E2E tests**: `test/app.e2e-spec.ts` for the HTTP contract.

## Negative and edge cases

- Article not found → `NotFoundError` with `errors.article.notFound`.
- Pagination limit clamped to max.
- Offset default applied when omitted.
- DTO validation failure on short title or missing body.
- ESLint rule tests include invalid fixtures for each violation.

## Migration and rollback tests

- No data migration needed (in-memory store).
- Rollback is source-control revert; tests must pass before and after each commit.

## Environment needs

- Local Node ≥20 environment.
- `npm install` already run.

## Evidence plan

- Capture `npm run lint`, `npm run typecheck`, `npm run test`, `npm run test:coverage`, `npm run build`, `npm run format:check` output.
- Keep the ESLint rule test output in the dev-validation report.
