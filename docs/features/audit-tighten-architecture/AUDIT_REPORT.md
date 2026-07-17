# Architecture Audit Report — IronNest Backend

> Request: `ARCH-2026-07-08` — Audit, tighten, and improve the existing IronNest backend architecture without doing a huge rewrite.

## Executive summary

The IronNest repository is already well-structured and mostly compliant with its own governance. The reference app runs, all quality gates are green, and the custom ESLint plugin enforces the two most important layer boundaries. The audit found **no critical defects** and **no security breaches**. The main opportunities are:

1. The ESLint plugin is too small for the strictness described in the governance docs.
2. The reference app (`src/modules/articles`) skips the `domain/` layer and leaks the API DTO contract into the service.
3. A few literals remain inline that should be constants.
4. Governance docs are mostly aligned but lack the new stricter AI-agent entrypoints requested.
5. No ESLint rule tests exist today.

All findings are addressable with small, focused changes. The rest of this report is evidence-based and maps each finding to the governing rule or doc.

## 1. Current folder structure

```text
src/
├── main.ts
├── app.module.ts
├── bootstrap/          # create-app, configure-*, bootstrap.constants.ts
├── config/             # app.config, security.config, env.validation, AppConfigService
├── core/
│   ├── logger/         # AppLogger, logger.port, logger.constants
│   ├── errors/         # AppError hierarchy, exception filter, error types/constants
│   ├── health/         # HealthService, HealthController
│   ├── validation/     # validation vendor re-exports, exception factory
│   ├── openapi/        # swagger decorator re-exports
│   ├── rate-limit/     # @nestjs/throttler wrapper
│   └── http/           # structural HTTP types
├── shared/
│   ├── constants/      # http-status.constants.ts
│   ├── enums/          # node-env.enum.ts
│   └── utils/          # (empty today)
└── modules/
    └── articles/       # api/, application/, infrastructure/, model/, lib/
                        # domain/ is missing
```

## 2. Current modules and layer organization

| Module                                          | Layer      | Status                                               |
| ----------------------------------------------- | ---------- | ---------------------------------------------------- |
| `articles/api/articles.controller.ts`           | Controller | ✅ Thin, one delegation per method.                  |
| `articles/application/articles.service.ts`      | Service    | ⚠️ Imports API DTOs; generates id/timestamp inline.  |
| `articles/infrastructure/article.repository.ts` | Repository | ✅ Persistence-only, bounded list query.             |
| `articles/domain/`                              | Domain     | ❌ Missing.                                          |
| `articles/model/`                               | Model      | ✅ Types, enums, constants separated.                |
| `articles/lib/article.mapper.ts`                | Mapper     | ✅ Small, single-purpose.                            |
| `core/logger`                                   | Adapter    | ✅ Wraps `nestjs-pino` behind `AppLogger`.           |
| `core/validation`                               | Adapter    | ✅ Re-exports `class-validator`/`class-transformer`. |
| `core/openapi`                                  | Adapter    | ✅ Re-exports `@nestjs/swagger` decorators.          |
| `core/rate-limit`                               | Adapter    | ✅ Wraps `@nestjs/throttler`.                        |
| `config/`                                       | Config     | ✅ Typed config, env validation.                     |
| `bootstrap/`                                    | Bootstrap  | ✅ Allowed `process.env` reads.                      |

## 3. Existing rules, docs, skills, and agent files

The repository has a comprehensive governance tree:

- `claude.md` (canonical), `AGENTS.md`, `codex.md`, `cursor.md`, `.cursorrules`
- `.cursor/rules/*.mdc` (5 files)
- `rules/00-non-negotiable-rules.md` and 19 numbered rule files
- `skills/*.md` (24+ skills)
- `context/architecture-map.md`, `reference-patterns.md`, `stack-and-toolchain.md`, `codebase-navigation.md`
- `memory/*.md` (10+ durable decisions)
- `testing/*.md` (6 standards)
- `agents/*.md` (9 reviewer roles)
- `docs/sdlc/*.md` and `docs/features/_template/*.md`

The content is high-quality and mutually reinforcing. The main gaps are missing agent entrypoints for Kimi, Gemini, GLM, Qwen, and DeepSeek, and the ESLint plugin not yet catching all the violations the rulebook describes.

## 4. Existing ESLint custom plugin rules

The plugin in `eslint/architecture-plugin.mjs` exports exactly two rules:

1. `architecture/controller-no-logic` — controller methods must be a single delegation.
2. `architecture/no-restricted-layer-imports` — path-based import boundaries + `process.env` restriction.

The `architecture.config.mjs` adds generic `no-restricted-syntax` selectors for:

- Module-level `const`/`enum`/`interface`/`type` in controllers and repositories.
- Module-level declarations and `Promise.all|allSettled|any|race` in services.
- `max-lines-per-function: 20` in services.

## 5. Current gaps in ESLint enforcement

The governance docs describe many expectations that the current plugin does **not** mechanically enforce:

- Use cases and domain files are not covered by module-level declaration restrictions.
- Adapters, guards, interceptors, pipes, and helpers/mappers are not covered by the declaration restrictions.
- Services importing API DTOs are allowed today (the application layer can import DTOs, but the architecture map prefers model types).
- Domain/repository importing API DTOs is not explicitly banned.
- Use-case imports into services are not explicitly banned.
- `Promise.all` etc. in use cases/adapters are not banned.
- No dedicated `no-process-env-outside-config` or `no-console-outside-logger` architecture rules (covered by existing `no-console` and `no-restricted-layer-imports`, but not as a named architecture rule).
- No rule tests or fixtures exist for the custom plugin.

## 6. Inline constants, types, interfaces, enums, functions

### Findings

| File                                                      | Line   | Finding                                                                  | Severity   | Fix                                                                       |
| --------------------------------------------------------- | ------ | ------------------------------------------------------------------------ | ---------- | ------------------------------------------------------------------------- |
| `src/modules/articles/api/dto/list-articles.query.dto.ts` | 14, 22 | `minimum: 1`, `default: 0`, `minimum: 0` are inline literals.            | Should-fix | Move to `article.constants.ts`.                                           |
| `src/modules/articles/application/articles.service.ts`    | 24     | `randomUUID()` and `new Date().toISOString()` are inline infra concerns. | Should-fix | Move to a domain factory.                                                 |
| `src/modules/articles/application/articles.service.ts`    | 47     | `query.offset ?? 0` uses inline literal `0`.                             | Should-fix | Use `ARTICLE_LIST_DEFAULT_OFFSET`.                                        |
| `src/core/health/health.service.ts`                       | 12     | `new Date().toISOString()` inline.                                       | Follow-up  | Consider a `ClockPort` in core if more modules need it.                   |
| `src/config/env.validation.ts`                            | 36-41  | Error message built inline with template literal.                        | Follow-up  | Move to `error.constants.ts` or keep as bootstrap-only (not user-facing). |

No module-level `const`/`enum`/`interface`/`type` declarations were found in controllers, services, repositories, adapters, or core implementation files. The existing `no-restricted-syntax` rules are effective for the layers they target.

## 7. Magic strings or magic numbers

| File                         | Line | Literal                    | Should be                               |
| ---------------------------- | ---- | -------------------------- | --------------------------------------- |
| `list-articles.query.dto.ts` | 14   | `minimum: 1`               | `ARTICLE_LIST_MIN_LIMIT`                |
| `list-articles.query.dto.ts` | 22   | `default: 0`, `minimum: 0` | `ARTICLE_LIST_DEFAULT_OFFSET`           |
| `articles.service.ts`        | 47   | `?? 0`                     | `ARTICLE_LIST_DEFAULT_OFFSET`           |
| `health.service.ts`          | 12   | `new Date().toISOString()` | `Clock.now()` (if future modules adopt) |

The remaining constants are already extracted (title/body lengths, pagination limits, error message keys, config defaults, redaction paths, etc.).

## 8. Duplicated helpers, algorithms, transformations, mappings

No duplicated helpers or algorithms were found. The only mapper (`article.mapper.ts`) is a single 1:1 mapping. No other module has a mapper yet, so there is nothing to unify. The shared `toErrorMessage` or similar helper does not exist in duplicate form.

## 9. Services doing too much

`ArticlesService` is small but takes on two responsibilities that belong elsewhere:

1. **Entity identity and timestamp generation** (`randomUUID()`, `new Date().toISOString()`). This is a domain/persistence concern, not an application orchestration concern.
2. **Using API DTOs as its input contract** (`CreateArticleDto`, `ListArticlesQueryDto`). The application layer should depend on model types, not the HTTP boundary.

`HealthService` is appropriately small. `AppLogger` only adapts the vendor.

## 10. Use case vs. service boundaries

No use cases exist in the repository today. The reference app is simple CRUD, so a use case is not required. This is correct per `rules/03-application-services-and-use-cases.md`: "Default = Service." No service currently calls a use case or should be converted to a use case.

## 11. Repositories containing business decisions

`ArticleRepository` is persistence-only. It does not throw `NotFoundError`, decide permissions, or map to DTOs. It correctly applies the max-limit cap and returns raw entities. The only non-ideal contract is that the old `create(id, data, createdAt)` method receives identity and timestamp from the service; after the refactor, the repository will receive a complete entity via `save(article)`.

## 12. Controllers doing more than one delegation

`ArticlesController` and `HealthController` are both thin. Each method has exactly one return statement delegating to one application method. No branching, transformation, or response shaping. ✅

## 13. Adapters leaking vendor types

No vendor types leak into business code. The adapters (`core/logger`, `core/validation`, `core/openapi`, `core/rate-limit`) are correctly wrapped. The `AppLogger` service implements `AppLoggerPort`; DTOs import decorators from `@core/openapi`; DTOs import validators from `@core/validation`. ✅

## 14. Direct vendor imports outside owning modules

No direct vendor imports were found outside their owners. The `packageImportBoundaries` in `eslint/package-boundaries.config.mjs` are effective. ✅

## 15. Direct `process.env` reads outside config/bootstrap

No violations found. The only `process.env` reads are in `src/config/` and `src/bootstrap/`. The `architecture/no-restricted-layer-imports` rule catches this. ✅

## 16. Security and observability gaps

### Security

- No secrets, tokens, or credentials in code. ✅
- `pino-http` redaction paths cover `authorization`, `cookie`, `password`, `token`, `secret`, `set-cookie`. ✅
- Global exception filter returns sanitized `{ messageKey }` and does not leak stacks. ✅
- DTO validation is applied at the HTTP boundary. ✅
- Rate limiting is globally applied via `@nestjs/throttler`. ✅
- Helmet security headers are applied in `bootstrap/configure-security.ts`. ✅

### Gaps / follow-ups

- No auth/permissions/ownership guards are wired yet. This is documented as a future feature, not a defect in this scope.
- `validateEnv` in `src/config/env.validation.ts` throws a raw `Error` with a concatenated message. This happens at startup before the app is created, so it is acceptable, but the message could be a constant.

### Observability

- Structured request logging via `pino-http` is in place. ✅
- Health endpoint exists. ✅
- No new runtime observability is required for this refactor.

## 17. Performance and readability issues

### Performance

- Pagination is bounded in both the DTO and the repository. ✅
- No N+1 patterns. ✅
- No `await` in loops. ✅
- No inline concurrency. ✅

### Readability

- Most methods are short and recipe-like. ✅
- `ArticlesService.create` is 6 lines but mixes orchestration with infrastructure concerns (UUID/time). Fix this.
- `env.validation.ts` inlines the error message construction. Minor.

## 18. Stale or incomplete governance docs

| File                                                           | Status         | Gap                                                                |
| -------------------------------------------------------------- | -------------- | ------------------------------------------------------------------ |
| `claude.md`                                                    | Mostly aligned | Needs a small note about the new AI-agent entrypoints.             |
| `AGENTS.md`                                                    | Mostly aligned | Needs to list the new entrypoint files.                            |
| `codex.md` / `cursor.md`                                       | Mirrors        | Must stay in sync with `claude.md` and `AGENTS.md`.                |
| `.cursorrules`                                                 | Legacy shim    | Already correct; must reference the new entrypoints.               |
| `.cursor/rules/*.mdc`                                          | Active rules   | Already aligned; may need a stricter note about DTO imports.       |
| `context/architecture-map.md`                                  | Canonical      | Already correct; could reference the new ESLint rules.             |
| `rules/06-types-enums-constants.md`                            | Detailed       | Could explicitly list the DTO/model boundary.                      |
| `rules/03-application-services-and-use-cases.md`               | Detailed       | Could state that services should prefer model types over API DTOs. |
| `KIMI.md` / `GEMINI.md` / `GLM.md` / `QWEN.md` / `DEEPSEEK.md` | ❌ Missing     | Must be created.                                                   |

## 19. Missing AI-agent entrypoint files

The repository currently provides `claude.md`, `AGENTS.md`, `codex.md`, `cursor.md`, and `.cursorrules`. It does **not** provide dedicated entrypoints for:

- `KIMI.md`
- `GEMINI.md`
- `GLM.md`
- `QWEN.md`
- `DEEPSEEK.md`

These must be created with the same canonical structure: repo purpose, file precedence, backend architecture, layer rules, zero-inline-declaration rule, security/performance/readability expectations, testing gates, and what the agent must never do.

## 20. Contradictions between governance files

No major contradictions were found. Minor wording differences exist:

- `architecture-map.md` says use cases "may accept/return API DTOs as their I/O contract" in one note, while `rules/03-application-services-and-use-cases.md` says use cases "must not" import controllers or API DTOs. The stricter interpretation (use cases should not import API DTOs) will be enforced.
- `architecture-map.md` says services may "accept/return API DTOs" in the import-boundary note, while the stricter tightening in this request wants services to prefer model types. This will be documented and enforced by the new `architecture/no-dto-import-in-application-layer` rule.

These are not contradictions in the sense of conflicting rules, but rather differences in strictness that this request resolves in favor of the tighter interpretation.

## Findings summary table

| #   | Finding                                                         | Severity   | Owner         | Resolution                                                |
| --- | --------------------------------------------------------------- | ---------- | ------------- | --------------------------------------------------------- |
| 1   | ESLint plugin has only 2 rules vs. many documented expectations | Medium     | This delivery | Add focused rules + tests.                                |
| 2   | No ESLint rule tests exist                                      | Medium     | This delivery | Add Vitest-integrated rule tests.                         |
| 3   | `articles` module has no `domain/` layer                        | Medium     | This delivery | Add `domain/article.factory.ts`.                          |
| 4   | `ArticlesService` imports API DTOs                              | Should-fix | This delivery | Use model types; new ESLint rule.                         |
| 5   | `ArticlesService` generates UUID/timestamp inline               | Should-fix | This delivery | Move to domain factory.                                   |
| 6   | Inline pagination literals in DTO                               | Should-fix | This delivery | Extract constants.                                        |
| 7   | Missing AI-agent entrypoints                                    | Medium     | This delivery | Create 5 files.                                           |
| 8   | Minor inline date/error literals                                | Follow-up  | Future        | Add `ClockPort` / message constant if more modules adopt. |
| 9   | Formatting drift across 152 files                               | Low        | This delivery | Run `npm run format`.                                     |

## Recommended next steps

1. Apply the formatting commit.
2. Update governance docs and add AI-agent entrypoints.
3. Add ESLint rules and rule tests.
4. Refactor the reference app to demonstrate the stricter rules.
5. Run the full validation matrix and publish the dev-validation report.
