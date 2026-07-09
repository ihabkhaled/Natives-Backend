# QWEN.md — IronNest Backend Agent Entrypoint

> This is the Qwen-family agent entrypoint for the IronNest repository. Read this file first, then `claude.md` as the canonical long-form operating policy. If this file ever contradicts `claude.md`, `claude.md` wins unless this file is temporarily stricter for safety.

## Repository purpose

IronNest is a generic enterprise SDLC operating system for NestJS backends. It ships with:

- A strict, one-way layered architecture (controller → application → domain → persistence → integration).
- A custom ESLint architecture plugin that mechanically enforces the layers.
- Strict TypeScript, typed config, a logger adapter, typed errors, and a small runnable Fastify + Pino reference app.
- A governance tree (`claude.md`, `AGENTS.md`, `rules/`, `skills/`, `context/`, `memory/`, `agents/`, `testing/`) that documents how to work safely.

Your job is to keep the architecture tight, not to rewrite it. Prefer small, focused, reviewable changes. Every behavior change ships with tests and docs in the same delivery stream.

## Canonical file precedence

When guidance conflicts, the stricter interpretation wins. Consult files in this order:

1. `QWEN.md` (this entrypoint) — how Qwen agents bootstrap for this repo.
2. `claude.md` — canonical long-form SDLC and engineering policy.
3. `AGENTS.md` — Codex bootstrap; tells other agents to read `claude.md`.
4. `.cursor/rules/*.mdc` — Cursor-compatible active rules.
5. `.cursorrules` — legacy Cursor compatibility only.
6. `codex.md` and `cursor.md` — mirror/reference copies of `claude.md` for humans or custom tooling.

Whenever a new permanent rule appears, update `claude.md` first, then keep the mirrors and entrypoints aligned in the same delivery stream.

## Backend architecture (one-way dependencies)

```text
HTTP → Controller   api/*.controller.ts          thin transport, one delegation/method
       Application  application/*.use-case.ts   multi-step orchestration + transactions
                    *.service.ts                  focused capability, ≤20 lines/method
       Domain       domain/                       policies, entities, state machines, pure
       Persistence  infrastructure/*.repository.ts data access only, parameterized, bounded
       Integration  adapters/*.adapter.ts         wraps one external library
       Cross-cutting: src/core (logger, errors, guards, interceptors, pipes, events)
                       src/config (typed config, validated env)
                       src/shared (enums, constants, types, utils)
```

Dependencies point **inward and downward only**. Read `context/architecture-map.md` and `rules/00-non-negotiable-rules.md` before writing code.

## Zero inline declarations

Implementation files must contain **only** the class or function that belongs to that layer. They must not define:

- local constants (except `LOG_PREFIX`)
- local enums or enum-like objects
- local types or interfaces
- local DTOs or request/response shapes
- local config maps or permission maps
- local helper functions (extract to `lib/` or `shared/`)
- vendor-specific contracts

Move each concern to its correct home:

- constants → `*.constants.ts`
- enums → `*.enums.ts` or `*.enum.ts` (with a `*_VALUES` array)
- types/interfaces → `*.types.ts`
- DTOs → `api/dto/*.dto.ts`
- mappers → `lib/*.mapper.ts` / `lib/*.mappers.ts`
- helpers → `lib/*.helper.ts` / `lib/*.helpers.ts` or `@shared/utils`
- domain rules → `domain/*.policy.ts`, `domain/*.entity.ts`, `domain/*.state-machine.ts`
- external SDK usage → `adapters/*.adapter.ts` or the owning core module
- persistence logic → `infrastructure/*.repository.ts`
- `process.env` reads → `config/` or `bootstrap/` only

## Controller rules

Controllers are HTTP-only and thin.

- May: route decorators, HTTP metadata, receive DTOs/params/query/headers/context, apply guards/pipes/interceptors, call exactly one application method, return the result.
- Must not: contain business logic, branching, transformation, inline declarations, import repositories/infrastructure/adapters directly, catch and translate errors manually, read config/env, use vendor SDKs, log business events directly.

## Service rules

Services are the default application layer.

- One focused capability per service.
- May: orchestrate one logical operation, call repositories/adapters/domain policies/mappers, throw typed `AppError`s, return typed results.
- Must not: contain inline declarations, local helpers, magic strings/numbers, long methods, business rules that belong in domain, mapping/formatting that belongs in mappers/formatters, validation that belongs in DTOs, direct HTTP/controller concerns, direct `process.env` reads, instantiate vendor clients, import controllers, call use cases, or do inline `Promise.all`/`allSettled`/`any`/`race`.
- Keep methods recipe-like: load/check → delegate → persist/call → map → return.
- Service methods should be ≤20 lines.

Prefer model types (`model/*.types.ts`) for service input. Response DTOs are acceptable as the return contract when the mapper produces them, but the service should not import API DTOs unnecessarily for input.

## Use-case rules

Use cases are exceptional, not default. Create one only when the operation needs multi-step orchestration, multiple entities, a transaction boundary, ordered post-commit events, or cross-service coordination.

- May: call services, own transaction boundaries, coordinate domain policies, coordinate repositories through services/unit-of-work, emit events after commit, return typed results.
- Must not: import controllers, import API DTOs, parse HTTP, contain inline declarations, contain magic values, contain vendor SDKs, hide large algorithms, do persistence details directly when a repo/service should own it, or call services that call use cases (dependency direction is one-way: use cases → services).

## Repository rules

Repositories own persistence only.

- May: query, insert, update, delete, persist, apply safe bounded pagination, apply parameterized filters, map persistence rows only if that is the established repo convention.
- Must not: contain business policies, decide permissions, decide state transitions, emit user-facing errors, import services/use cases/controllers/API DTOs, contain inline declarations, contain unbounded list queries, use unsafe SQL string interpolation, leak ORM/vendor types upward, or duplicate query/pagination algorithms.
- Every list method is paginated with a hard max limit (default cap 100) and returns the total where possible.

## Adapter / library rules

Every external library has one owner.

- May: import vendor SDKs, translate vendor input/output into app-owned types, handle vendor-specific errors, apply timeout/retry/circuit-breaker policy, expose a typed app-owned interface.
- Must not: leak vendor types into business layers, contain business rules, contain controller logic, contain inline declarations, contain raw config reads outside approved config/bootstrap policy, or duplicate shared HTTP/retry/backoff logic.

## Security rules

- No secrets in code, no token leakage, no sensitive data in logs.
- Logger adapter only; never `console.*`.
- Redact PII/secrets in logs (`src/core/logger/logger.constants.ts`).
- No raw stack traces returned to clients; the exception filter returns sanitized `{ messageKey }` bodies.
- Typed `AppError` with `messageKey` (`errors.<feature>.<key>`).
- No direct `process.env` outside `config/`/`bootstrap/`; fail-fast env validation at startup.
- No raw SQL interpolation; parameterized queries only.
- List endpoints bounded by max limit.
- Auth guard on protected routes, permission guard where applicable, ownership/tenant checks for resource access; identity comes from the verified token, never the request body.
- No vendor SDKs outside adapters.
- DTO validation at trust boundaries; no unsafe deserialization; no unbounded payloads.

## Performance rules

- Bounded pagination on every list endpoint.
- No N+1 patterns; batch reads where needed.
- No `await` in loops for independent I/O.
- No inline concurrency inside services; move concurrency orchestration to use cases or helpers.
- Keep transactions small; reads before the transaction, side effects after commit.
- Explicit timeout/retry policy for integrations.
- Avoid repeated mapping/transformation and duplicated derived data.
- No large sync CPU work in the request path unless justified.

## Readability rules

- Small methods, small classes, one responsibility per file.
- Explicit helpers, explicit domain policies, clear use-case flow.
- Named constants, meaningful errors, testable pure functions.
- No deeply nested conditionals, no “smart” one-liners, no unreadable chained logic, no mixed responsibilities, no vague names, no unexplained abstractions.
- Prefer boring, predictable code over cleverness.
- Before writing code, run the IronNest Simple Code Ladder (`rules/20-simple-readable-code.md`, non-negotiable rules 43–46): need it → reuse existing → native/platform → existing adapter/dependency → small helper → direct readable code → new abstraction only when justified.
- Be lazy about code volume, never lazy about reading, validation, security, auth, permissions, ownership checks, tests, docs, observability, or architecture. Canonical detail: `rules/20`–`rules/24`; router: `context/simple-code-map.md`.

## Testing expectations

- Write or adjust tests first for behavior changes.
- Map acceptance criteria and risks to test layers: unit, integration, contract, E2E, regression, migration, rollback, permission, security.
- Keep tests deterministic, isolated, and repeatable.
- Mock at the right boundary (repositories/adapters), not the logic you are trying to prove.
- Coverage is measured on touched modules, not only global averages. Minimum touched-module target: 95% lines/functions/statements, 90% branches (branches are 90 because decorator downlevel emit adds an uncoverable synthetic branch on every `@Injectable`/`@Catch` class line).

## Quality gates

Every change must keep these green:

```bash
npm run lint
npm run typecheck
npm run test
npm run test:coverage
npm run build
npm run format:check
```

Never bypass Husky hooks with `--no-verify`. Fix lint at the root cause; never add `eslint-disable` or `@ts-ignore`.

## What you must never do

- Skip SDLC phases `00` through `13` before implementation.
- Rewrite the architecture or rename folders to “fix” it.
- Add `eslint-disable`, `@ts-ignore`, `!` non-null assertions, or `any` to make a gate pass.
- Leave constants, types, enums, helpers, or DTOs inline in implementation files.
- Import repositories or infrastructure from controllers.
- Import use cases from services.
- Import API DTOs from domain or use-case files.
- Bypass Husky, skip tests, or weaken rules to satisfy existing code.
- Create duplicate helper files for the same concern; search for an existing owner first.
- Turn `src/shared` into a dumping ground.

## How to refactor safely

1. Read the code and tests before changing them.
2. Make the failing thing obvious first: add a failing test or enable the rule that exposes the violation.
3. Change one responsibility at a time: move declarations to their files, extract helpers, split oversized methods, delegate to the domain layer.
4. Preserve public signatures when possible; use facades to avoid consumer churn.
5. Run the full gate set after each step.
6. Update tests and docs in the same commit stream.

## How to add a feature correctly

1. Create `docs/features/<feature-slug>/` and write phases `00` through `13`.
2. Scaffold the module: `api/`, `application/`, `domain/`, `infrastructure/`, `model/`, `lib/`.
3. Define enums in `@shared/enums` or `model/<feature>.enums.ts` (with `*_VALUES`).
4. Define types in `model/<feature>.types.ts`.
5. Define constants in `model/<feature>.constants.ts`.
6. Add DTOs in `api/dto/` with class-validator decorators.
7. Implement the repository (persistence-only, bounded).
8. Implement the domain entity/policy if needed.
9. Implement the service (focused) or use case (multi-entity transaction) as appropriate.
10. Implement the controller (one delegation per method).
11. Wire the module in `<feature>.module.ts` and expose the public surface in `index.ts`.
12. Write tests first, run the gates, update docs.
