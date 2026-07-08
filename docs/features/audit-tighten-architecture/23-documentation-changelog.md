# 23 — Documentation Changelog

## Updated documents

| Document                                         | Why it changed                                                                                                                                                                                                                                           |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `README.md`                                      | Updated the reference-app flow to include the `domain/` layer; listed the new AI-agent entrypoints in the tool compatibility section.                                                                                                                    |
| `claude.md`                                      | Added the five new AI-agent entrypoints to the canonical file precedence list.                                                                                                                                                                           |
| `AGENTS.md`                                      | Added the AI-agent entrypoints section and listed them in the precedence/conflict clause.                                                                                                                                                                |
| `codex.md`                                       | Mirrored the `claude.md` precedence update.                                                                                                                                                                                                              |
| `cursor.md`                                      | Mirrored the `claude.md` precedence update.                                                                                                                                                                                                              |
| `.cursorrules`                                   | Added the new AI-agent entrypoints to the legacy precedence list.                                                                                                                                                                                        |
| `.cursor/rules/00-canonical-policy.mdc`          | Added the new AI-agent entrypoints to the Cursor precedence list.                                                                                                                                                                                        |
| `.cursor/rules/40-nestjs-engineering-os.mdc`     | Strengthened the zero-inline-declarations rule description; added the DTO-import boundary and service→use-case direction rules.                                                                                                                          |
| `context/architecture-map.md`                    | Documented the three new custom ESLint architecture rules (`no-inline-layer-declarations`, `no-dto-import-in-domain-or-use-case`, `no-use-case-import-in-service`) and the follow-up `no-cross-module-internal-imports` rule in the enforcement section. |
| `agents/README.md`                               | Fixed precedence to list `claude.md` first; corrected coverage provider to `v8` and thresholds to 95% statements/functions/lines, 90% branches.                                                                                                          |
| `testing/quality-gates.md`                       | Corrected coverage provider to `v8` and thresholds to 95% statements/functions/lines, 90% branches.                                                                                                                                                      |
| `rules/03-application-services-and-use-cases.md` | Clarified that services should prefer model types for input; added the DTO/model boundary subsection; updated the dependency-direction note to include the new service→use-case rule.                                                                    |
| `rules/06-types-enums-constants.md`              | Updated the zero-inline policy to reference `architecture/no-inline-layer-declarations`; added the DTO vs. model types boundary; updated the checklist to include helper functions.                                                                      |
| `skills/create-service.md`                       | Added the rule to prefer model types for input; updated the example to use `PublishArticleData` instead of a DTO; added the DTO-import pitfall.                                                                                                          |
| `docs/features/audit-tighten-architecture/`      | New feature artifact folder with SDLC phases `00`–`13`, audit report, dev validation report, and this changelog.                                                                                                                                         |

## New documents

| Document                                                                             | Purpose                                                                                                          |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `KIMI.md`                                                                            | Entrypoint for Kimi-family AI agents.                                                                            |
| `GEMINI.md`                                                                          | Entrypoint for Gemini-family AI agents.                                                                          |
| `GLM.md`                                                                             | Entrypoint for GLM-family AI agents.                                                                             |
| `QWEN.md`                                                                            | Entrypoint for Qwen-family AI agents.                                                                            |
| `DEEPSEEK.md`                                                                        | Entrypoint for DeepSeek-family AI agents.                                                                        |
| `eslint/architecture-plugin/rules/no-inline-layer-declarations.mjs`                  | New custom ESLint rule + inline docs.                                                                            |
| `eslint/architecture-plugin/rules/no-dto-import-in-domain-or-use-case.mjs`           | New custom ESLint rule + inline docs.                                                                            |
| `eslint/architecture-plugin/rules/no-use-case-import-in-service.mjs`                 | New custom ESLint rule + inline docs.                                                                            |
| `test/eslint/architecture-plugin/rules/no-inline-layer-declarations.spec.mjs`        | Rule tests with valid/invalid fixtures.                                                                          |
| `test/eslint/architecture-plugin/rules/no-dto-import-in-domain-or-use-case.spec.mjs` | Rule tests with valid/invalid fixtures.                                                                          |
| `test/eslint/architecture-plugin/rules/no-use-case-import-in-service.spec.mjs`       | Rule tests with valid/invalid fixtures.                                                                          |
| `eslint/architecture-plugin/rules/controller-no-logic.mjs`                           | Updated to skip non-route-handler methods, getters, setters; added class-property arrow handler support.         |
| `test/eslint/architecture-plugin/rules/controller-no-logic.spec.mjs`                 | Rule tests with valid/invalid fixtures for controller route-handler logic.                                       |
| `test/eslint/architecture-plugin/rules/no-restricted-layer-imports.spec.mjs`         | Rule tests with valid/invalid fixtures for layer imports and process.env access.                                 |
| `eslint/architecture-plugin/rules/no-restricted-layer-imports.mjs`                   | Strengthened to catch computed, destructured, and rebound `process.env` access.                                  |
| `eslint/architecture-plugin/rules/no-cross-module-internal-imports.mjs`              | New custom ESLint rule + inline docs.                                                                            |
| `test/eslint/architecture-plugin/rules/no-cross-module-internal-imports.spec.mjs`    | Rule tests with valid/invalid fixtures.                                                                          |
| `rules/11-testing-and-coverage.md`                                                   | New hard coverage and test-discipline rule document.                                                             |
| `testing/coverage-policy.md`                                                         | New operational coverage policy document.                                                                        |
| `src/core/errors/error-body.mapper.ts`                                               | Stopped forwarding `HttpException.message` verbatim to clients.                                                  |
| `src/core/errors/error-body.mapper.spec.ts`                                          | Updated assertion that HttpException message is not leaked.                                                      |
| `src/bootstrap/configure-validation.ts`                                              | Added explicit `transformOptions.enableImplicitConversion: false` and `stopAtFirstError: false`.                 |
| `src/modules/articles/api/articles.controller.ts`                                    | Added explicit `@HttpCode(CREATED)`, `ParseUUIDPipe` on `:id`, and per-route OpenAPI decorators.                 |
| `src/core/openapi/openapi.vendor.ts`                                                 | Re-exported `ApiOperation`, `ApiCreatedResponse`, `ApiOkResponse`, `ApiNotFoundResponse` from `@nestjs/swagger`. |
| `test/app.e2e-spec.ts`                                                               | Updated not-found test to use a valid UUID v4 and added a 400-test for invalid ids.                              |

|| `test/app.e2e-spec.ts` | Updated not-found test to use a valid UUID v4 and added a 400-test for invalid ids; articles tests now authenticate. |
|| `src/modules/articles/model/article.types.ts` | Added `ownerId` to `Article` and `ListArticlesResult` envelope type. |
|| `src/modules/articles/api/dto/list-articles.response.dto.ts` | New paginated list response envelope DTO. |
|| `src/modules/articles/infrastructure/article.repository.ts` | `list()` now returns `{ items, total, limit, offset }` and sorts by `createdAt`. |
|| `src/modules/articles/application/articles.service.ts` | `list()` returns the paginated envelope; `create`/`getById`/`list` accept a requester id for ownership. |
|| `src/modules/articles/api/articles.controller.ts` | List endpoint now returns `ListArticlesResponseDto`; routes use `CurrentUser` and enforce ownership. |
|| `src/modules/articles/lib/article.mapper.ts` | Added `toListArticlesResponse` and mapped `ownerId`. |
|| `src/core/clock/clock.port.ts` / `clock.module.ts` / `system-clock.service.ts` | New `ClockPort` abstraction injected into `HealthService` and `ArticlesService`. |
|| `src/core/id-generator/id-generator.port.ts` / `id-generator.module.ts` / `uuid-id-generator.service.ts` | New `IdGeneratorPort` abstraction injected into `ArticlesService`. |
|| `src/modules/articles/domain/article.entity.ts` | `createArticle` is now pure: caller supplies id, ownerId, and timestamp via ports. |
|| `src/modules/auth/` | New JWT auth module with `AuthService`, `AuthController`, `JwtAuthGuard`, `RolesGuard`, `Public`/`Roles`/`CurrentUser` decorators. |
|| `src/modules/users/` | New in-memory users module seeded for reference testing; supports `AuthService` password verification. |
|| `src/app.module.ts` | Imports `AuthModule`; global guards are wired in `create-app.ts`. |
|| `src/bootstrap/create-app.ts` | Registers `JwtAuthGuard` and `RolesGuard` globally via `app.useGlobalGuards()`. |
|| `src/core/health/health.controller.ts` | Marked health endpoint `@Public()` so the global auth guard allows it. |
|| `src/config/config.types.ts` / `security.config.ts` / `config.constants.ts` | Added `jwtSecret` and `jwtExpiresInSeconds` to typed security configuration. |
|| `src/core/validation/validation.vendor.ts` | Re-exported `IsEmail` from class-validator for the login DTO. |
|| `src/core/openapi/openapi.vendor.ts` | Re-exported `ApiUnauthorizedResponse` and `ApiForbiddenResponse`. |

## Remaining documentation gaps

None identified. All changed behavior is documented, and the new AI-agent entrypoints cover the major model families requested.

## Owners

- Architecture and governance updates: senior backend architect / AI-assisted delivery agent.
- AI-agent entrypoints: same.
- ESLint rule documentation: same.
