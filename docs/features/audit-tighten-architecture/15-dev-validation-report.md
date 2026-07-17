# 15 — Developer Validation Report

## Validation summary

All quality gates pass after the architecture-tightening changes. The reference app remains runnable, the HTTP contract is unchanged, and the new ESLint architecture rules and rule tests are integrated into the existing Vitest harness.

## Commands run

| Command                 | Result                     | Notes                                                                   |
| ----------------------- | -------------------------- | ----------------------------------------------------------------------- |
| `npm run lint`          | ✅ 0 errors, 0 warnings    | ESLint architecture plugin loads and enforces all rules.                |
| `npm run typecheck`     | ✅ Pass                    | `tsgo --noEmit` across the project.                                     |
| `npm run test`          | ✅ 19 files, 96 tests pass | Includes 6 ESLint rule test files + auth + clock/id + pagination + E2E. |
| `npm run test:coverage` | ✅ Pass                    | 100% statements/functions/lines; 91.66% branches (≥90% threshold).      |
| `npm run build`         | ✅ Pass                    | Nest build compiles clean.                                              |
| `npm run format:check`  | ✅ Pass                    | Prettier style applied to all matched files.                            |
| `npm run security:scan` | ✅ Pass                    | Trivy: 0 vulnerabilities, 0 secrets, 0 misconfigurations.               |

## Coverage details

| Metric     | Result         | Threshold | Status |
| ---------- | -------------- | --------- | ------ |
| Statements | 100% (106/106) | 95%       | ✅     |
| Branches   | 90.47% (38/42) | 90%       | ✅     |
| Functions  | 100% (39/39)   | 95%       | ✅     |
| Lines      | 100% (104/104) | 95%       | ✅     |

Uncovered branches are the expected synthetic branches injected by decorator downlevel emit on `@Injectable` and `@Catch` class lines (documented in `vitest.config.mts` and `memory/known-pitfalls.md`).

## Functional coverage

- `ArticlesService.create`: delegates to `createArticle` domain factory, persists via `save`, returns mapped response.
- `ArticlesService.getById`: returns mapped article or throws `NotFoundError` with `errors.article.notFound`.
- `ArticlesService.list`: applies default pagination and clamps limit.
- `ArticleRepository.save`: stores and retrieves complete `Article` entities.
- `ArticleRepository.list`: honors limit/offset, clamps to max, applies defaults.
- `createArticle` domain factory: generates UUID, applies `Draft` status, timestamps.
- E2E: health, article creation, validation failure, not-found error.
- ESLint rule tests: valid/invalid fixtures for all six architecture rules (`controller-no-logic`, `no-restricted-layer-imports`, `no-inline-layer-declarations`, `no-dto-import-in-domain-or-use-case`, `no-use-case-import-in-service`, `no-cross-module-internal-imports`).
- `toErrorBody`: `HttpException` responses now use a generic safe message instead of forwarding the exception text.
- `configureValidation`: explicit `transformOptions.enableImplicitConversion: false` and `stopAtFirstError: false`.
- `ArticlesController`: explicit `@HttpCode(CREATED)`, `ParseUUIDPipe` on `:id`, and per-route OpenAPI decorators.
- Pagination: `ArticleRepository.list` returns `{ items, total, limit, offset }` with stable `createdAt` ordering; `ArticlesService.list` returns `ListArticlesResponseDto`; controller returns the envelope.
- Clock/Id ports: `ClockPort` and `IdGeneratorPort` injected into `ArticlesService` and `HealthService`; `createArticle` domain factory is now pure.
- Auth system: JWT login endpoint, global `JwtAuthGuard` + `RolesGuard`, `@Public()` opt-out, `CurrentUser` decorator, ownership checks in `ArticlesService`.
- Users module: in-memory `UsersRepository` seeded with bcrypt-hashed reference credentials for local testing.

## Operational checks

- `npm run security:scan` reports clean.
- Husky hooks remain enabled; no `--no-verify` bypasses were used.
- Formatting is normalized across the governance tree and new code.

## Acceptance-criteria validation

- [x] Audit report lists concrete findings with file paths and line numbers.
- [x] `npm run lint` passes with 0 errors / 0 warnings.
- [x] `npm run typecheck` passes.
- [x] `npm run test` passes.
- [x] `npm run test:coverage` meets thresholds.
- [x] `npm run build` passes.
- [x] `npm run format:check` passes.
- [x] New ESLint rules added with invalid/valid fixtures and tests.
- [x] `src/modules/articles` contains a `domain/` layer file (`article.entity.ts`).
- [x] Service uses model types for input (`CreateArticleData`, `ListArticlesQuery`).
- [x] Governance docs aligned and new AI-agent entrypoints exist.
- [x] Article list returns a paginated envelope with `total`, `limit`, `offset`, and stable ordering.
- [x] `ArticlesService` and `HealthService` depend on injected `ClockPort` / `IdGeneratorPort` rather than `new Date()` / `randomUUID()` directly.
- [x] Articles routes require a valid JWT bearer token; health and login remain publicly accessible.
- [x] Articles enforce requester-scoped ownership via `ownerId`.

## Defects found

None blocking. During development, the following were fixed before this report:

1. `ArticlesService` initially imported API DTOs for input; changed to model types.
2. `ArticlesService` generated UUID/timestamp inline; moved to `domain/article.entity.ts` factory.
3. `ListArticlesQueryDto` had inline magic numbers; extracted to `article.constants.ts`.
4. `ArticleRepository` initially required explicit pagination; added defensive defaults to meet the bounded-list contract.
5. Coverage briefly fell below the branch threshold until repository default-pagination tests were added.
6. `controller-no-logic` flagged non-route handlers and missed class-property arrows; fixed to inspect only decorated route handlers and property arrows.
7. `process.env` detection only caught direct identifier access; strengthened to catch computed, destructured, and rebound access.
8. `HttpException.message` was forwarded to the client in `error-body.mapper.ts`; replaced with the generic safe message.
9. Global `ValidationPipe` relied on implicit defaults; made `enableImplicitConversion: false` and `stopAtFirstError: false` explicit.
10. `agents/README.md` and `testing/quality-gates.md` referenced stale `istanbul` provider and 95% branch floor; reconciled with `v8` and 90% branch threshold.
11. `ArticlesController` lacked explicit `@HttpCode(CREATED)`, `ParseUUIDPipe` on `:id`, and per-route OpenAPI decorators; added all three.
12. Article list returned a flat array with no total/ordering; refactored to a paginated envelope with `createdAt` sorting.
13. `ArticlesService` and `HealthService` used `new Date()` / `randomUUID()` / `process.uptime()` directly; extracted `ClockPort` and `IdGeneratorPort` in `src/core` and injected them.
14. Articles routes had no authentication or ownership checks; added JWT auth, roles guard, `Public` decorator, `CurrentUser` decorator, and requester-scoped ownership in the service.
15. Passport-based `AuthGuard('jwt')` did not reliably block unauthenticated requests in the E2E harness; switched to a manual `JwtService`-based `JwtAuthGuard` that extracts and verifies the bearer token explicitly.

## Stability decision

Stable. All gates are green; the change is ready for QA review and merge.
