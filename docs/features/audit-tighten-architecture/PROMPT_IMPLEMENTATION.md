# Implementation Prompt — IronNest Backend Architecture Tightening (Full A-Z Re-Check)

> Use this prompt to launch an agent that re-checks the entire IronNest backend architecture from A-Z and applies any missing or incorrect improvements. This is the original request plus the deltas discovered by the previous agent.

## Original repository

`https://github.com/ihabkhaled/IronNest` (local checkout at `/Users/ihab/Desktop/Ihab/IronNest`).

## Goal

Audit, tighten, and improve the existing IronNest backend architecture without doing a huge rewrite. Keep the existing architecture working; strengthen it.

## Follow-up deltas already applied (verify they remain correct)

A previous pass tightened the repo. The following must still be present and correct when you re-check:

- Six custom ESLint architecture rules: `controller-no-logic`, `no-restricted-layer-imports`, `no-inline-layer-declarations`, `no-dto-import-in-domain-or-use-case`, `no-use-case-import-in-service`, `no-cross-module-internal-imports`.
- Rule tests under `test/eslint/architecture-plugin/rules/` for every custom rule.
- `controller-no-logic` only inspects decorated route handlers and class-property arrow handlers; it skips private helpers, constructors, getters, and setters.
- `no-restricted-layer-imports` detects direct, computed (`process.env['X']`), destructured (`const { env } = process;`), and rebound (`const env = process.env;`) `process.env` access outside `config/`/`bootstrap/`.
- `no-cross-module-internal-imports` blocks private-layer imports (`api/`, `application/`, `domain/`, `infrastructure/`) across modules.
- `error-body.mapper.ts` uses a generic safe message for `HttpException`; it does not forward `exception.message` to clients.
- Global `ValidationPipe` explicitly sets `transformOptions: { enableImplicitConversion: false }` and `stopAtFirstError: false`.
- `agents/README.md` and `testing/quality-gates.md` correctly cite `v8` coverage provider and thresholds (95% statements/functions/lines, 90% branches).
- `rules/11-testing-and-coverage.md` and `testing/coverage-policy.md` exist and are referenced consistently.
- The `articles` reference module uses `model/*.types.ts` for service input and a `domain/` factory for entity creation.

If any of these are missing or broken, restore them as part of your implementation.

## Canonical backend architecture (must preserve and strengthen)

- Controller / HTTP transport: `api/*.controller.ts`
- API DTOs / routes / gateways: `api/dto/*.dto.ts`
- Application services: `application/*.service.ts`
- Use cases: `application/*.use-case.ts`
- Domain policies / entities / state machines: `domain/`
- Repositories / persistence: `infrastructure/*.repository.ts`
- Adapters / external libraries: `adapters/*.adapter.ts` or core-owned modules
- Utils / helpers / mappers / formatters: `lib/` or `@shared/`
- Types: `model/*.types.ts` or `@shared/types`
- Enums: `model/*.enums.ts` or `@shared/enums` (with `*_VALUES` arrays)
- Constants: `*.constants.ts`
- Core cross-cutting modules: `src/core`
- Config: `src/config`
- Shared building blocks: `src/shared`
- Tests: `*.spec.ts` / `*.e2e-spec.ts` / rule tests
- Governance docs / AI-agent instructions: `claude.md`, `AGENTS.md`, `codex.md`, `cursor.md`, `.cursorrules`, `.cursor/rules/*`, `rules/`, `skills/`, `context/`, `memory/`, `agents/`, `docs/`, `testing/`

## Main rule (non-negotiable)

Implementation files must contain only the class/function that belongs to that layer. No inline declarations in implementation layers.

Applies to: controllers, services, use cases, repositories, guards, interceptors, pipes, adapters, gateways, application handlers, core runtime logic where applicable.

These files must not define: local constants, local enums, local enum-like objects, local types, local interfaces, local DTOs, local request/response shapes, local config maps, local helper functions, local utility functions, local mapper functions, magic strings, magic numbers, reusable algorithms, duplicated logic, vendor-specific contracts, inline concurrency orchestration, hidden business rules.

Move each concern to its correct home:

- constants → `*.constants.ts`
- enums → `*.enums.ts` or `*.enum.ts` (with `*_VALUES` array)
- types/interfaces → `*.types.ts`
- DTOs → `api/dto/*.dto.ts`
- request/response DTOs → `api/dto/`
- mappers → `lib/*.mapper.ts` / `lib/*.mappers.ts`
- helpers → `lib/*.helper.ts` / `lib/*.helpers.ts` or `@shared/utils`
- utils → shared or module-owned utils
- domain rules → `domain/*.policy.ts`, `domain/*.entity.ts`, `domain/*.state-machine.ts`
- external SDK/library usage → `adapters/*.adapter.ts` or owning core module
- persistence logic → `infrastructure/*.repository.ts`
- `process.env` reads → `config/` or `bootstrap/` only

## Layer discipline

### Controllers

- HTTP-only, thin, one delegation per method.
- May define route decorators, HTTP metadata, receive DTOs/params/query/headers/context, apply guards/pipes/interceptors/decorators, call exactly one application method, return the result.
- Must not contain business logic, branching, transformation, inline declarations, import repositories/infrastructure/adapters directly, call multiple services in one method, build response objects manually, catch/translate errors manually, read config/env, use vendor SDKs, or log business events directly.

### Services

- Default application layer; one focused capability per service.
- May orchestrate one logical operation, call repositories/adapters/domain policies/mappers, throw typed `AppError`s, return typed DTOs/entities/results.
- Must not contain inline declarations, local helpers, reusable algorithms, magic strings/numbers, long methods (>20 lines), business rules that belong in domain, mapping/formatting/validation that belongs elsewhere, direct HTTP/controller concerns, direct `process.env` reads, vendor client instantiation, controller imports, use-case imports, inline `Promise.all`/`allSettled`/`any`/`race`, or become a god service.
- Prefer model types (`model/*.types.ts`) for input. Response DTOs are acceptable only when produced by a mapper in `lib/`.

### Use cases

- Exceptional, not default. Use only for multi-step orchestration, multiple entities, transaction boundary, ordered post-commit events, or cross-service coordination.
- May call services, own transaction boundaries, coordinate domain policies, coordinate repositories through services/unit-of-work, emit events after commit, return typed results.
- Must not import controllers, import API DTOs (unless explicitly allowed by current repo policy), parse HTTP, contain inline declarations/magic values/vendor SDKs, hide large algorithms, do persistence details directly, or import services.

### Repositories

- Persistence only.
- May query, insert, update, delete, persist, apply safe bounded pagination, apply parameterized filters, map persistence rows only if that is the established repo convention.
- Must not contain business policies, decide permissions, decide state transitions, emit user-facing errors, import services/use cases/controllers/API DTOs, contain inline declarations, contain unbounded list queries, use unsafe SQL string interpolation, leak ORM/vendor types upward, or duplicate query/pagination algorithms.

### Adapters / gateways / libraries

- Every external library has one owner.
- May import vendor SDKs, translate vendor input/output into app-owned types, handle vendor-specific errors, apply timeout/retry/circuit-breaker policy, expose a typed app-owned interface.
- Must not leak vendor types into business layers, contain business rules/controller logic/inline declarations/raw config reads, or duplicate shared HTTP/retry/backoff logic.

## Secure coding (must strengthen)

- No secrets in code; no token leakage; no sensitive data in logs.
- Logger adapter only; never `console.*`; redact PII/secrets.
- No raw stack traces returned to clients; sanitized error bodies.
- Typed `AppError` with `messageKey`.
- No direct `process.env` outside `config`/`bootstrap`; fail-fast env validation.
- No raw SQL interpolation; parameterized queries only.
- List endpoints bounded by max limit.
- Auth guard on protected routes; permission guard where applicable; ownership/tenant checks for resource access; identity from verified token, never body.
- No vendor SDKs outside adapters.
- Secure headers/rate limiting preserved.
- DTO validation at trust boundaries; no unsafe deserialization; no unbounded payloads.
- No hidden fire-and-forget failures.

## Optimized coding (must strengthen)

- Bounded pagination on all list endpoints; max limit constants.
- No N+1 patterns; batch repository methods where needed.
- No `await` in loops for independent I/O; no inline concurrency inside services.
- Move concurrency orchestration to use case/helper/repo where appropriate.
- Keep transactions small; reads before transaction; side effects after commit.
- Explicit timeout/retry policy for integrations.
- Avoid unnecessary object cloning; avoid repeated mapping/transformation; no duplicated derived data; no large sync CPU work in request path unless justified.

## Readable code (must strengthen)

- Small methods, small classes, small files; one responsibility per file.
- Explicit helpers, explicit domain policies, clear use-case flow.
- Named constants, meaningful errors, testable pure functions.
- Reject huge methods/classes/files, deeply nested conditionals, smart one-liners, unreadable chained logic, mixed responsibilities, duplicate algorithms, hidden side effects, vague names, unexplained abstractions, over-engineered generic frameworks.

## ESLint custom architecture plugin (must strengthen)

The plugin must now include the following rules, all registered, configured, and tested:

- `architecture/controller-no-logic` — route handlers delegate directly; skip non-route methods, getters, setters, constructors.
- `architecture/no-restricted-layer-imports` — path-based layer boundaries + restricted runtime access (`process.env`, etc.).
- `architecture/no-inline-layer-declarations` — implementation-layer files contain only the layer class/function.
- `architecture/no-dto-import-in-domain-or-use-case` — domain and use cases depend on model types, not API DTOs.
- `architecture/no-use-case-import-in-service` — one-way dependency: use cases call services, not vice versa.
- `architecture/no-cross-module-internal-imports` — private implementation layers of one module cannot be imported from another module.

The following are still desirable but may remain manual or future rules; only add them if they do not introduce false positives:

- `architecture/no-magic-values-in-implementation-layers` (new if feasible)
- `architecture/require-bounded-list-query` (new if feasible)
- `architecture/require-message-key-errors` (new if feasible)
- `architecture/no-raw-error-message-leak` (new if feasible)

`service-no-inline-concurrency` is enforced via `no-restricted-syntax`; `service-method-max-complexity` via `max-lines-per-function`; `no-vendor-import-outside-owner` via `packageImportBoundaries`; `no-console-outside-logger` via `no-console`.

Make rules strict but practical. Avoid false positives. Add docs for every new rule. Add invalid fixtures and valid fixtures. Update ESLint architecture unit tests.

## Docs/governance update (must align)

Audit and update at least:

- `README.md`
- `package.json` description if needed
- `claude.md`
- `AGENTS.md`
- `codex.md`
- `cursor.md`
- `.cursorrules`
- `.cursor/rules/*`
- `context/architecture-map.md`
- `context/reference-patterns.md`
- `context/stack-and-toolchain.md`
- `context/codebase-navigation.md`
- `rules/*`
- `skills/*`
- `docs/*`
- `testing/*`
- `agents/*`
- `memory/*`

Add new AI agent entrypoint files: `KIMI.md`, `GEMINI.md`, `GLM.md`, `QWEN.md`, `DEEPSEEK.md`. Each must include: repo purpose, canonical file precedence, backend architecture, strict layer responsibilities, zero-inline-declaration rule, constants/enums/types placement, controller/service/use-case/repository/adapter rules, security rules, performance rules, readability rules, testing expectations, quality gates, what the agent must never do, how to refactor safely, how to add a feature correctly.

## Refactor strategy (incremental)

Step 1: Audit and list concrete findings.
Step 2: Update docs and governance contradictions.
Step 3: Strengthen ESLint custom rules and tests.
Step 4: Run lint and see what new violations are exposed.
Step 5: Fix real violations in small safe changes.
Step 6: Unify duplicated helpers/logic where safe.
Step 7: Run validation and report results.

Do not: rewrite the entire repo, rename every folder, replace the existing architecture, change behavior casually, weaken strict rules to make lint pass, add `eslint-disable`, bypass Husky, skip tests, add duplicate helper files, hide magic values under different names, introduce god services, leak vendors into business code, turn shared into a dumping ground.

## Validation (must run)

At minimum:

```bash
npm run lint
npm run typecheck
npm run test
npm run test:coverage
npm run build
```

Also run where practical:

```bash
npm run security:scan
npm run format:check
```

If any command fails because of your changes, fix it. If a command cannot run because of environment limitations, report that honestly.

## What the previous agent already did

The previous agent completed the following (verify each, do not assume it is correct):

- Formatted the governance tree (152 files) so `npm run format:check` passes.
- Created a feature artifact folder `docs/features/audit-tighten-architecture/` with SDLC phases `00`–`13`, audit report, dev validation report, and documentation changelog.
- Added six ESLint architecture rules:
  - `architecture/controller-no-logic` (updated to skip non-route methods, getters, setters; catch class-property arrow handlers).
  - `architecture/no-restricted-layer-imports` (updated to catch computed, destructured, and rebound `process.env` access).
  - `architecture/no-inline-layer-declarations` (covers controllers, services, use cases, repositories, adapters, guards, interceptors, pipes; allows only `LOG_PREFIX` const).
  - `architecture/no-dto-import-in-domain-or-use-case` (bans domain and use-case files from importing `api/dto/`).
  - `architecture/no-use-case-import-in-service` (bans service files from importing use cases).
  - `architecture/no-cross-module-internal-imports` (blocks private-layer imports across modules).
- Updated `eslint/architecture-plugin.mjs` and `eslint/architecture.config.mjs` to register and configure the rules.
- Added Vitest-integrated rule tests with valid and invalid fixtures under `test/eslint/architecture-plugin/rules/` for every custom rule.
- Enabled `globals: true` in `vitest.config.mts` and added `test/**/*.spec.mjs` to the include pattern; added `src/modules/**/domain/**/*.ts` to coverage include.
- Refactored the `articles` reference module:
  - Added `src/modules/articles/domain/article.entity.ts` with a `createArticle` factory.
  - Changed `ArticlesService` to use `CreateArticleData` and `ListArticlesQuery` from `model/` instead of API DTOs for input.
  - Changed `ArticleRepository` from `create(id, data, createdAt)` to `save(article)` and added defensive pagination defaults.
  - Extracted `ARTICLE_LIST_MIN_LIMIT` and `ARTICLE_LIST_DEFAULT_OFFSET` into `article.constants.ts` and used them in the DTO and service.
- Updated tests: `articles.service.spec.ts`, `article.repository.spec.ts`, and new `article.entity.spec.ts`.
- Updated governance docs: `README.md`, `AGENTS.md`, `claude.md`, `codex.md`, `cursor.md`, `.cursorrules`, `.cursor/rules/*.mdc`, `context/architecture-map.md`, `rules/03-application-services-and-use-cases.md`, `rules/06-types-enums-constants.md`, `rules/11-testing-and-coverage.md`, `skills/create-service.md`, `testing/coverage-policy.md`, `testing/quality-gates.md`, `agents/README.md`.
- Created AI-agent entrypoints: `KIMI.md`, `GEMINI.md`, `GLM.md`, `QWEN.md`, `DEEPSEEK.md`.
- Fixed `src/core/errors/error-body.mapper.ts` so it does not leak `HttpException.message` to clients.
- Fixed `src/bootstrap/configure-validation.ts` to explicitly set `transformOptions: { enableImplicitConversion: false }` and `stopAtFirstError: false`.
- Kept all gates green: `lint`, `typecheck`, `test` (81 tests), `test:coverage` (91.66% branches, 100% statements/functions/lines), `build`, `format:check`, `security:scan` (0 vulnerabilities/secrets/misconfig).

## Your task

1. Re-audit the entire repository from A-Z using the checklist in `PROMPT_AUDIT.md`.
2. Verify whether the previous agent's work is complete and correct.
3. Apply any missing improvements that are needed to satisfy the original acceptance criteria.
4. If you find something wrong, fix it at the root cause.
5. If you find a contradiction or gap in governance docs, fix it and align the mirrors.
6. If the ESLint rules are incomplete or have false positives, improve them and add tests.
7. If the reference app still has misplaced constants/types/DTOs/helpers or magic values, extract them.
8. If there are duplicated helpers/algorithms, unify them safely.
9. Keep every gate green.
10. Update the feature artifacts if you change behavior or docs.

## Acceptance criteria (must all be true at the end)

- Implementation layers contain no misplaced constants/types/interfaces/enums/helpers.
- Services and use cases contain no magic values.
- Controllers stay thin.
- Repositories stay persistence-only.
- Adapters own external libraries.
- Constants live in constants files; enums live in enum files; types/interfaces live in types files.
- Duplicated helpers/algorithms are unified.
- Custom ESLint rejects architecture contradictions.
- Docs/rules/skills/context/memory/agents are aligned.
- AI agent files exist for Claude, Codex, Cursor, Kimi, Gemini, GLM, Qwen, and DeepSeek.
- Secure coding rules are strengthened.
- Performance rules are strengthened.
- Readability rules are strengthened.
- Validation commands are run or limitations are clearly reported.

## Final deliverable

When you are done, provide:

1. A summary of what you verified, what you changed, and what you left unchanged.
2. A list of files changed.
3. The validation command results.
4. Any remaining TODOs or recommended follow-ups.
5. Updated `docs/features/audit-tighten-architecture/15-dev-validation-report.md` and `23-documentation-changelog.md` if your work changed behavior or docs.

Be honest. If the previous agent did everything correctly, say so and show the evidence. If something is still missing, fix it or clearly state the blocker.
