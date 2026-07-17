# IronNest — Strict NestJS Backend Operating System

> Iron discipline for NestJS backends — clean architecture enforced by custom ESLint rules, strict TypeScript, SDLC governance, an AI-agent knowledge base (rules · skills · memory · context), and a runnable Fastify + Pino reference app.

This repository is two complementary operating systems in one:

1. **An enterprise SDLC governance brain** ([`claude.md`](./claude.md)) — the stack-agnostic policy that forces every request through a complete, documented lifecycle (intake → analysis → architecture → tests → implementation → QA → security → release → hypercare → retrospective) with hard, non-skippable gates.
2. **A concrete NestJS engineering operating system** — everything the best NestJS teams need to start a backend _from scratch_ without re-deriving any of it: strict TypeScript, a custom architecture-enforcing ESLint setup, layered architecture, rules, skills, agents, memory, context, and testing standards.

The governance brain tells you **which phases and gates** a change must pass. The engineering OS tells you **exactly how the code must be written** so it is clean, layered, type-safe, secure, observable, testable, and free of spaghetti — no inline consts/enums/types/interfaces, thin controllers, orchestrating services, persistence-only repositories, and external libraries wrapped behind adapters.

Everything here is **100% broad and abstract for any NestJS backend** — modular monolith or microservice, any ORM, any database, any domain.

---

## What you get

### Engineering operating system (the "how")

| Layer         | Path                                    | What it is                                                                                                                                                                                                                                                                                                        |
| ------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Rules**     | [`/rules`](./rules/README.md)           | 31 numbered engineering rules (`00`–`30`), starting with the [non-negotiables](./rules/00-non-negotiable-rules.md) and including the [Simple Readable Code Operating System](./rules/20-simple-readable-code.md), refactor discipline, agent readiness, and declaration ownership                                 |
| **Skills**    | [`/skills`](./skills/README.md)         | Step-by-step task playbooks (create a module/controller/service/repository, add a guard, write tests, review, migrate, simplify…)                                                                                                                                                                                 |
| **Context**   | [`/context`](./context/README.md)       | Architecture/toolchain/task maps, [canonical code patterns](./context/reference-patterns.md), the [simplicity router](./context/simple-code-map.md), [refactor navigation](./context/refactor-navigation.md), and [declaration ownership](./context/declaration-ownership-map.md)                                 |
| **Memory**    | [`/memory`](./memory/README.md)         | Durable, abstract decisions & the [learned-pitfalls log](./memory/known-pitfalls.md)                                                                                                                                                                                                                              |
| **Agents**    | [`/agents`](./agents/README.md)         | Specialist review roles (architect, security, performance, tests, database, reliability, release gatekeeper…)                                                                                                                                                                                                     |
| **Testing**   | [`/testing`](./testing/README.md)       | Engineering testing standards (strategy, unit/integration/e2e, coverage, fixtures, gates)                                                                                                                                                                                                                         |
| **ESLint**    | [`/eslint`](./eslint)                   | Modular flat configs + a **custom architecture plugin** that mechanically enforces the layering                                                                                                                                                                                                                   |
| **Knowledge** | [`/tools/knowledge`](./tools/knowledge) | A dependency-free generator that compiles the corpus into committed [`.ai/`](./.ai) manifests + a `≤1500`-token `BOOTSTRAP.md`, plus a deterministic `npm run knowledge:context -- --task="…"` resolver that ranks the exact rules/skills/source for a task. Kept fresh by `npm run knowledge:check` (a CI gate). |

### Tooling kit (drop-in configs, exact pins)

Root-level, ready to copy into any NestJS project: [`package.json`](./package.json), [`.nvmrc`](./.nvmrc), [`tsconfig.json`](./tsconfig.json) / [`tsconfig.eslint.json`](./tsconfig.eslint.json) / [`tsconfig.build.json`](./tsconfig.build.json), [`eslint.config.mjs`](./eslint.config.mjs), [`.prettierrc`](./.prettierrc), [`.lintstagedrc.cjs`](./.lintstagedrc.cjs), [`commitlint.config.cjs`](./commitlint.config.cjs), [`vitest.config.mts`](./vitest.config.mts), [`nest-cli.json`](./nest-cli.json), [`.husky/`](./.husky) (pre-commit, commit-msg, pre-push), [`.github/`](./.github) (seven clean-environment gates + Dependabot), [`.env.example`](./.env.example), and [`.editorconfig`](./.editorconfig).

### Runtime and TypeScript ownership

- Node.js **24.18.0 LTS** and npm **>=11.16.0**.
- `@typescript/native` (`npm:typescript@7.0.2`) supplies the default `tsc` used by `npm run typecheck` and `npm run build`.
- The package named `typescript` (`npm:@typescript/typescript6@6.0.2`) supplies only the compatibility compiler API required by Nest CLI, typescript-eslint, SonarJS, ts-node, and similar tools.

This is Microsoft's official TypeScript 7 side-by-side migration, not a downgrade. `@typescript/native-preview` is removed; no `.npmrc` legacy-peer bypass, `--force`, `--legacy-peer-deps`, or hand-edited lockfile metadata is used.

### SDLC governance (the "what / when / gates")

- [`claude.md`](./claude.md) — the permanent operating brain (canonical).
- [`docs/sdlc/`](./docs/sdlc) — permanent baseline policy (engineering, QA, security, release, risk, docs).
- [`docs/features/_template/`](./docs/features/_template) — the per-request artifact set (phases `00`–`27`).
- [`test-cases/`](./test-cases), [`runbooks/`](./runbooks), [`architecture/adrs/`](./architecture/adrs), [`release-notes/`](./release-notes), [`support/`](./support).

---

## The canonical architecture (in one breath)

```
Controller (api/*.controller.ts, thin, one delegation/method)
  → Application (application/*.use-case.ts for orchestration+transactions; *.service.ts focused, ≤20 lines/method)
    → Domain (domain/ policies, entities, state machines — pure)
      → Persistence (infrastructure/*.repository.ts — parameterized, bounded)
        → Integration (adapters/*.adapter.ts — every external library wrapped)
Cross-cutting: src/core (logger, errors+filter, guards, interceptors, pipes, events) · src/config · src/shared
```

Dependencies point one way only, and the boundaries are **enforced by ESLint**, not by hope. Full detail: [`/context/architecture-map.md`](./context/architecture-map.md).

## Quick start

**Run the reference app**

The repo ships a real, runnable NestJS application under [`src/`](./src) that already wires the strict setup end to end.

```bash
nvm use             # use the Node LTS patch pinned in .nvmrc
npm ci              # reproduce the lockfile exactly
npm run prepare     # install the Husky hooks
cp .env.example .env # development only; replace JWT_SECRET for real environments
npm run lint:fix    # normalize imports/formatting once after install
npm run start:dev   # boots on http://localhost:3000
```

Then hit it:

- `GET /api/v1/health` → liveness JSON
- `GET /docs` → Swagger UI
- `POST /api/v1/articles` with `{ "title": "Hello world", "body": "..." }` → 201 (try an invalid body to see the logged 400)

Keep every gate green: `npm run validate && npm run security:audit && npm run security:scan`.

### GitHub merge gates

Pull requests and pushes to `main` run seven independent checks: `lint`, `typecheck`, `test:unit`, `test:e2e`, `test:coverage`, `build`, and `security:scan`. The E2E gate uses Nest/Fastify/Supertest; this backend has no Playwright dependency. Workflow ownership and required-check setup are documented in [`.github/README.md`](./.github/README.md) and [`runbooks/github-required-checks.md`](./runbooks/github-required-checks.md).

**Build your own feature**

Read [`/context/architecture-map.md`](./context/architecture-map.md) and [`/rules/00-non-negotiable-rules.md`](./rules/00-non-negotiable-rules.md), then mirror the `articles` reference module: scaffold with [`create-module`](./skills/create-module.md) and build endpoints with [`create-controller`](./skills/create-controller.md) → [`create-service`](./skills/create-service.md) / [`create-use-case`](./skills/create-use-case.md) → [`create-repository`](./skills/create-repository.md).

**Add the strict kit to an existing NestJS project**

Copy the root configs + [`/eslint`](./eslint) into your repo, merge the `package.json` dependencies, run `npm install`, then drive `npm run lint` to zero by fixing root causes (never disabling rules).

## What the reference app already does

| Concern                         | Where                                                                                  | Notes                                                                                              |
| ------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| **Fastify (latest)** platform   | [`src/bootstrap/fastify-adapter.ts`](./src/bootstrap/fastify-adapter.ts)               | bounded body size, forwarded IP trust off until explicitly allowlisted, per-request correlation id |
| **Helmet + CORS + cookies**     | [`src/bootstrap/configure-security.ts`](./src/bootstrap/configure-security.ts)         | `@fastify/helmet`, CORS from typed config, `@fastify/cookie`                                       |
| **Pino logs for every request** | [`src/core/logger/`](./src/core/logger)                                                | `nestjs-pino`, redaction, 4xx→`warn` / 5xx→`error`, pretty in dev only                             |
| **Error logging (400→500)**     | [`src/core/errors/app-exception.filter.ts`](./src/core/errors/app-exception.filter.ts) | global filter logs & sanitizes every `AppError`/exception                                          |
| **DTO validation logging**      | [`src/core/validation/`](./src/core/validation)                                        | ValidationPipe factory logs each rejected field/constraint                                         |
| **Split bootstrap**             | [`src/bootstrap/`](./src/bootstrap)                                                    | one file per concern; orchestrated by `bootstrap.ts`                                               |
| **Typed, validated config**     | [`src/config/`](./src/config)                                                          | `@nestjs/config` namespaces + fail-fast env validation, consumed via `AppConfigService`            |
| **Rate limiting**               | [`src/core/rate-limit/`](./src/core/rate-limit)                                        | global `@nestjs/throttler` guard from config                                                       |
| **Auth + permissions**          | [`src/core/auth/`](./src/core/auth), [`src/modules/auth/`](./src/modules/auth)         | runtime-validated JWT identity, central role→permission catalog, JWT/bcrypt behind adapters        |
| **Clean example feature**       | [`src/modules/articles/`](./src/modules/articles)                                      | controller → service → domain → repository → dto → model → lib                                     |
| **Vulnerability scanning**      | `npm run security:scan`                                                                | [Trivy](https://trivy.dev) over the lockfile + secrets + misconfig (HIGH/CRITICAL fail the gate)   |

## Every library has ONE owning module (swap surfaces)

Every third-party package is importable **only inside the module that owns it** — enforced by [`eslint/package-boundaries.config.mjs`](./eslint/package-boundaries.config.mjs). Want to replace pino, class-validator, the rate limiter, or even the HTTP platform? You touch exactly one folder:

| Vendor                                               | Owning module                                               | The rest of the app uses                                     |
| ---------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------ |
| `nestjs-pino` / `pino` / `pino-http` / `pino-pretty` | [`src/core/logger/`](./src/core/logger)                     | `AppLogger` (implements the app-owned `AppLoggerPort`)       |
| `class-validator` / `class-transformer`              | [`src/core/validation/`](./src/core/validation)             | the `@core/validation` re-exports in DTOs                    |
| `@nestjs/swagger` decorators                         | [`src/core/openapi/`](./src/core/openapi)                   | the `@core/openapi` re-exports (`ApiProperty`, `ApiTags`, …) |
| `@nestjs/throttler`                                  | [`src/core/rate-limit/`](./src/core/rate-limit)             | imports `RateLimitModule`                                    |
| `@nestjs/config`                                     | [`src/config/`](./src/config)                               | injects the typed `AppConfigService`                         |
| `fastify` + `@fastify/*` + `@nestjs/platform-*`      | [`src/bootstrap/`](./src/bootstrap)                         | the structural types in [`@core/http`](./src/core/http)      |
| `@nestjs/jwt`                                        | [`src/modules/auth/`](./src/modules/auth)                   | `AuthTokenPort` through the JWT token adapter                |
| `bcrypt`                                             | [`src/modules/auth/adapters/`](./src/modules/auth/adapters) | `PasswordHashPort` through the password adapter              |

Dependencies track the **latest stable compatible** releases (`npm run deps:check` / `deps:upgrade`), using official migration or compatibility paths when required. Exact compatibility aliases are documented rather than hidden as downgrades. `npm run security:scan` (Trivy) gates HIGH/CRITICAL vulnerabilities, secrets, and misconfigurations.

## How the two systems fit together

- For **process** ("am I allowed to ship, and what artifacts are required?") → follow [`claude.md`](./claude.md) and the [`docs/`](./docs) templates.
- For **code** ("how do I write this NestJS change correctly?") → follow [`/rules`](./rules/README.md), the matching [`/skill`](./skills/README.md), and the [`/context`](./context/README.md) patterns, verified by [`/agents`](./agents/README.md).
- When they overlap, the **stricter** guidance wins; if anything contradicts [`claude.md`](./claude.md), `claude.md` wins.

## Tool compatibility

The same standards are exposed to every AI coding tool — kept in sync:

- [`claude.md`](./claude.md) — canonical source of truth.
- [`AGENTS.md`](./AGENTS.md) — Codex bootstrap (reads `claude.md` + the engineering OS).
- [`KIMI.md`](./KIMI.md), [`GEMINI.md`](./GEMINI.md), [`GLM.md`](./GLM.md), [`QWEN.md`](./QWEN.md), [`DEEPSEEK.md`](./DEEPSEEK.md), [`MISTRAL.md`](./MISTRAL.md) — compact family routers. `codex.md` already fulfills the full GPT/Codex/Sol mirror role.
- [`.cursor/rules/*.mdc`](./.cursor/rules) — active Cursor rules.
- [`.cursorrules`](./.cursorrules) — legacy Cursor shim.
- [`codex.md`](./codex.md) / [`cursor.md`](./cursor.md) — mirror/reference copies.

If any compatibility file ever differs from `claude.md`, `claude.md` wins.

Practical cleanup guides: [`docs/simple-readable-code.md`](./docs/simple-readable-code.md), [`docs/codebase-cleanup-playbook.md`](./docs/codebase-cleanup-playbook.md), [`docs/declaration-ownership.md`](./docs/declaration-ownership.md), [`docs/security-safe-refactoring.md`](./docs/security-safe-refactoring.md), and [`docs/agent-readiness.md`](./docs/agent-readiness.md).
