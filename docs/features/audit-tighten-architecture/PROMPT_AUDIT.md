# Audit Prompt — IronNest Backend Architecture Review

> Use this prompt to launch an independent agent that audits the IronNest repository from A-Z after the architecture-tightening work. The agent must read the actual files, produce evidence, and report gaps.

## Context

You are auditing the IronNest repository at `https://github.com/ihabkhaled/IronNest` (or the local checkout at `/Users/ihab/Desktop/Ihab/IronNest`). The repo is a strict NestJS backend operating system with a custom ESLint architecture plugin, comprehensive governance docs, and a small reference app (`articles` module).

A previous agent performed an architecture-tightening pass. Your job is to independently audit the repository and verify whether the tightening is complete, correct, and consistent. Do not trust the previous agent's report; inspect the actual files.

## Mandatory pre-audit reading

Before writing any findings, read:

1. `claude.md` (canonical policy).
2. `AGENTS.md`, `KIMI.md`, `GEMINI.md`, `GLM.md`, `QWEN.md`, `DEEPSEEK.md`.
3. `.cursor/rules/*.mdc` and `.cursorrules`.
4. `context/architecture-map.md`, `rules/00-non-negotiable-rules.md`, `rules/01-architecture-and-module-boundaries.md`, `rules/03-application-services-and-use-cases.md`, `rules/04-repositories-and-persistence.md`, `rules/06-types-enums-constants.md`, `rules/11-testing-and-coverage.md`, `rules/12-library-wrapping-and-adapters.md`, `testing/coverage-policy.md`.
5. `eslint/architecture-plugin.mjs`, `eslint/architecture.config.mjs`, `eslint/package-boundaries.config.mjs`, and every rule under `eslint/architecture-plugin/rules/`.
6. `src/modules/articles/**/*.ts` (controller, service, domain, repository, DTOs, model, lib, tests) and `src/bootstrap/configure-validation.ts`, `src/core/errors/error-body.mapper.ts`.
7. `test/eslint/architecture-plugin/rules/*.spec.mjs`.
8. `vitest.config.mts`, `package.json`, `tsconfig.json`.

## Audit checklist

For each item, inspect the actual files and report concrete evidence (file path + line number + snippet).

### 1. Folder structure and layer organization

- Does the canonical architecture still hold? (controller → application → domain → persistence → integration, cross-cutting core/config/shared)
- Is every feature module scaffolded with `api/`, `application/`, `domain/`, `infrastructure/`, `model/`, `lib/`?
- Does the `articles` reference module include a `domain/` layer? What does it own?
- Are there any modules missing a required layer?

### 2. Governance alignment

- Do `claude.md`, `AGENTS.md`, `codex.md`, `cursor.md`, `.cursorrules`, `.cursor/rules/*.mdc` all agree on canonical precedence?
- Are the new AI-agent entrypoints (`KIMI.md`, `GEMINI.md`, `GLM.md`, `QWEN.md`, `DEEPSEEK.md`) present and self-consistent?
- Do the entrypoints include: repo purpose, file precedence, backend architecture, layer rules, zero-inline-declaration rule, constants/enums/types placement, controller/service/use-case/repository/adapter rules, security/performance/readability, testing gates, "must never do", refactor strategy, and feature-addition guide?
- Is there any contradiction between the entrypoints and `claude.md`?

### 3. ESLint custom plugin

- How many custom `architecture/*` rules exist? List each. The expected set now includes `controller-no-logic`, `no-restricted-layer-imports`, `no-inline-layer-declarations`, `no-dto-import-in-domain-or-use-case`, `no-use-case-import-in-service`, and `no-cross-module-internal-imports`.
- Does each rule have a clear, documented purpose?
- Are the rules registered in `eslint/architecture-plugin.mjs`?
- Are the rules configured in `eslint/architecture.config.mjs` with the correct file patterns?
- Are there rule tests for **every** rule? Do they include both valid and invalid fixtures?
- Are the tests integrated into `npm run test` (i.e., does `vitest.config.mts` include them)?
- Do the new rules avoid false positives on mapper/helper/factory files that are not class-based layers?
- Does `controller-no-logic` correctly skip non-route handlers (private helpers, constructors, getters, setters) and catch class-property arrow route handlers?
- Does `no-restricted-layer-imports` catch computed, destructured, and rebound `process.env` access outside `config/`/`bootstrap/`?
- Are there still gaps between the written rules and the ESLint enforcement? (e.g., the written rules mention many expectations that the plugin may not catch)

### 4. Inline declarations

- Check every `*.controller.ts`, `*.service.ts`, `*.use-case.ts`, `*.repository.ts`, `*.adapter.ts`, and core guard/interceptor/pipe file for module-level declarations.
- Are there any module-level `const`, `enum`, `interface`, `type`, or `function` declarations that are not `LOG_PREFIX` or the main class/function?
- Are there any inline DTOs, request/response shapes, config maps, or helper functions inside implementation files?
- Are constants, enums, types, DTOs, mappers, helpers all in dedicated files?

### 5. Magic strings and magic numbers

- Search every service, use case, controller, repository, adapter, guard, interceptor, pipe, and helper for bare literals that should be constants.
- Are TTLs, timeouts, limits, pagination defaults, retry counts, backoff values, event names, message keys, route fragments, header names, cache keys, algorithm thresholds, etc. all extracted?
- Are there any `?? 0`, `minimum: 0`, `default: 0`, `minimum: 1`, or similar inline literals in DTOs or services?

### 6. Layer boundaries and imports

- Do controllers import repositories, infrastructure, or adapters directly?
- Do services import controllers?
- Do services import use cases?
- Do domain/use-case files import API DTOs?
- Do repositories import services, use cases, controllers, or API DTOs?
- Do any implementation files import private layers (`api/`, `application/`, `domain/`, `infrastructure/`) of another module? They should only import public barrels or `model/` types.
- Do adapters leak vendor types into business code?
- Are all external library imports only in their owning adapter/core module?
- Is `process.env` read only in `config/` and `bootstrap/`? Test direct, computed (`process.env['X']`), destructured (`const { env } = process;`), and rebound (`const env = process.env;`) forms.

### 7. Services, use cases, repositories

- Are services focused (one capability per service)?
- Are service methods ≤20 lines?
- Do services orchestrate rather than contain business rules/mapping/formatting?
- Do services contain inline concurrency (`Promise.all`, `allSettled`, `any`, `race`)?
- Are use cases used only for multi-entity transaction + ordered post-commit events?
- Are repositories persistence-only? Do they contain business decisions, authorization, or DTO mapping?
- Do repositories apply bounded pagination with a hard max limit?

### 8. Reference app (`articles` module)

- Does the controller stay thin (one delegation per method)?
- Does the service use model types for input rather than API DTOs?
- Does a domain factory/entity own article creation (id, status, timestamp)?
- Does the repository receive a complete entity and persist it?
- Are the DTOs using constants for validation metadata (`min`, `max`, `default`) rather than inline literals?
- Are there tests for the domain factory, the service, and the repository? Do they cover happy paths, error paths, and pagination defaults?

### 9. Security and observability

- Are there any secrets/tokens/credentials in code?
- Are sensitive fields redacted in logs (`logger.constants.ts`)?
- Are errors sanitized via the global exception filter (no raw stack traces to clients)?
- Does `error-body.mapper.ts` forward `HttpException.message` to the client? It must use a generic safe message.
- Does the global `ValidationPipe` explicitly set `transformOptions.enableImplicitConversion: false` and `stopAtFirstError: false`?
- Does every typed error have a `messageKey`?
- Are list endpoints bounded?
- Is there any `console.*` outside the logger adapter? (Check `no-console` rule.)
- Are auth/permission/ownership patterns documented even if not yet wired?

### 10. Performance and readability

- Is there any N+1 pattern, unbounded query, or `await` in a loop for independent I/O?
- Is there any repeated mapping/transformation or duplicated helper logic?
- Are method/class/file sizes reasonable?
- Are names explicit and meaningful?

### 11. Tests and coverage

- Do all tests pass (`npm run test`)?
- Does coverage meet thresholds (`npm run test:coverage`)?
- Are the new ESLint rule tests included and passing?
- Are tests deterministic and isolated?
- Is coverage measured on touched modules (not just global averages)?

### 12. Quality gates

Run and report the result of each:

```bash
npm run lint
npm run typecheck
npm run test
npm run test:coverage
npm run build
npm run format:check
npm run security:scan
```

## Deliverable

Produce a structured markdown audit report with:

1. Executive summary (overall verdict: pass / needs revision / fail).
2. Per-section findings table: item, severity, file path, line number, evidence snippet, rule violated, recommended fix.
3. List of contradictions between governance files.
4. List of remaining ESLint enforcement gaps.
5. Validation command results.
6. Concrete recommended next steps.

Be honest. If the previous agent did something wrong, say so. If something is missing, flag it. Do not label incomplete work as done.
