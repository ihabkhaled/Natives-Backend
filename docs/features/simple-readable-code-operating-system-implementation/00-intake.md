# 00 — Intake: Simple Readable Code Operating System Implementation

## Request metadata

- Request ID: `GOV-2026-07-10-SRCOS-IMPLEMENTATION`
- Title: Implement and apply the Simple Readable Code Operating System across IronNest
- Source: repository owner
- Delivery track: standard
- Severity: high maintainability and governance impact; medium runtime risk
- Urgency: high
- Owners: repository architect (technical), AI-assisted delivery agent (implementation/docs), automated gates plus independent review (quality/security)

## Classification

- governance implementation
- engineering operating-system enhancement
- AI-agent behavior enhancement
- coding-style rule implementation
- maintainability refactor
- developer-experience improvement
- docs, skills, memory, context, and agent-mirror update
- ESLint/static-enforcement investigation
- backend code cleanup
- zero-inline-declaration cleanup
- readability hardening

## Affected domains

`rules/`, `skills/`, `docs/`, `memory/`, `context/`, agent entrypoints, ESLint architecture enforcement, authentication/authorization, articles ownership scoping, config validation, bootstrap wiring, shared contracts, tests, and the runnable NestJS reference app.

## Critical-risk flags

- Authentication and token verification are refactored behind app-owned adapter ports.
- Authorization is upgraded from raw role checks to a central permission catalog.
- Resource ownership and list scoping are changed to prevent cross-owner existence/count leakage.
- Startup configuration validation is expanded.
- No money flow, schema, migration, queue, external network integration, or production deployment is in scope.

## Initial scope

Extend the existing rules 20–24 simplicity baseline without duplicating it; add the missing declaration/refactor/agent-readiness rules and playbooks; align practical documentation, memory, context, and agent entrypoints; add safe tested static enforcement; then refactor the actual reference backend and tests so the written policy is demonstrated by the code.

## Non-goals

- No new product feature.
- No architecture replacement.
- No dependency upgrade or ORM/database introduction.
- No speculative framework, generic CRUD layer, cache, queue, or event system.
- No weakening of TypeScript, ESLint, security, validation, auth, ownership, tests, docs, observability, or SDLC gates.
- No separate GPT Sol mirror: `codex.md` already fulfills the requested full GPT-family mirror and remains subordinate to `claude.md`.

## Repository and files inspected before implementation

- Root policy/entrypoints: `README.md`, `claude.md`, `AGENTS.md`, `codex.md`, `cursor.md`, five family entrypoints, `.cursorrules`, `.cursor/rules/*.mdc`.
- Engineering OS: all numbered `rules/*.md`, all `skills/*.md`, `context/*.md`, `memory/*.md`, `testing/*.md`, and `agents/*.md`.
- SDLC: `docs/**`, feature templates, the prior `simple-readable-code-operating-system` request, ADR/runbook/release/support/test-case indexes.
- Tooling: `package.json`, `eslint.config.mjs`, `eslint/**`, ESLint rule tests, `tsconfig*.json`, `vitest.config.mts`, Husky/lint-staged configuration, `.env.example`.
- Runtime: all `src/**/*.ts`, colocated specs, and `test/app.e2e-spec.ts`.

## Initial findings

- Rules 20–24 and ten simplicity skills already exist; the requested implementation/declaration/agent-readiness extensions do not.
- The current lint/type/test baseline is green, but static enforcement misses inline type literals and DTO definite-assignment assertions.
- Auth services/guards directly depend on JWT and bcrypt vendors and throw framework exceptions rather than typed `AppError`s.
- Auth layer files contain inline request/result shapes; role strings and role checks lack a central permission catalog.
- Article list ownership filtering happens after pagination and total calculation.
- Environment validation covers only a subset of consumed variables; `.env.example` advertises unused keys.
- DTOs use `!` definite-assignment assertions despite the no-assertion policy.
- Several reference snippets document patterns the live strict rules reject.

## Acceptance target

Junior-readable, senior-trustworthy, behaviorally tested code with canonical declaration owners, adapter-contained vendors, permission and ownership checks intact or stronger, complete config validation, aligned agent guidance, and every available repository gate green.
