# Backend Stack — Decision Record

> The locked runtime, build, lint, and test toolchain for a NestJS backend in this workspace. This is a durable convention, not a changelog. It mirrors [/context/stack-and-toolchain.md](../context/stack-and-toolchain.md) and implements the canon in [/context/architecture-map.md](../context/architecture-map.md) and [00-non-negotiable-rules.md](../rules/00-non-negotiable-rules.md).

## Decision

The framework and tooling below are **fixed**: NestJS 11, tsgo for type-checking, ESLint flat config with a custom architecture plugin, Vitest, and Husky gates. The **business stack** — ORM, database, cache, broker, mailer, object storage, APM — is intentionally **unfixed**: a project chooses it and hides it behind an adapter or repository so the rest of the codebase never imports a vendor directly.

The split exists so every project inherits the same correctness machinery while staying free to pick the data and integration tech the domain actually needs.

> **Project records:** name the chosen ORM / database / cache / broker / mailer / storage / APM here, with the version and the adapter or repository that owns each one.

## Runtime & language

| Item                      | Choice                                                    | Rationale                                                                                                                                                    |
| ------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Runtime                   | **Node.js 20+** (`engines.node >= 20`, `npm >= 10`)       | LTS baseline; pin in `engines` so CI and local agree.                                                                                                        |
| Language                  | **TypeScript 6** for editor/types                         | Strongest editor inference; the build/typecheck tool is separate.                                                                                            |
| Type-check / build helper | **tsgo** (`@typescript/native-preview`)                   | Native compiler; fast project-wide `--noEmit`. It type-checks — it does not execute `.ts`.                                                                   |
| Framework                 | **NestJS 11** on **Fastify** (`@nestjs/platform-fastify`) | DI + module boundaries match the layered architecture; Fastify for throughput. `@nestjs/platform-express` stays installed so a project can switch platforms. |

> NestJS is the transport and DI substrate — there is no raw routing, no manual request/response plumbing. HTTP entry is a `@Controller`; cross-cutting concerns are guards, pipes, interceptors, filters, and decorators, never ad-hoc handlers.

> The type tool is **tsgo**, invoked as `tsgo --noEmit`. Do not reference plain `tsc`/`tsc --noEmit` in scripts, docs, or hooks.

## Framework libraries (shipped, locked)

These ride with the framework and are part of the standard surface:

- **@nestjs/common / core** — framework runtime.
- **@nestjs/config** — typed, validated configuration. The only sanctioned config source. See [17-configuration-and-environment.md](../rules/17-configuration-and-environment.md).
- **@nestjs/swagger** — OpenAPI document, generated in `bootstrap/`.
- **@nestjs/throttler** — rate limiting.
- **@nestjs/jwt + @nestjs/passport + passport-jwt** — auth building blocks behind the auth guard. See [07-security-authn-authz.md](../rules/07-security-authn-authz.md).
- **class-validator + class-transformer** — **primary** DTO validation via a global `ValidationPipe` (`whitelist: true`, `transform: true`).
- **reflect-metadata, rxjs, tslib** — framework runtime.

DTO validation default is class-validator; a custom `ZodValidationPipe` is the documented **alternative** when schema-first validation is preferred. See [05-dto-and-validation.md](../rules/05-dto-and-validation.md).

## Business stack (NOT shipped — you choose)

The following are deliberately **not** pinned, because they are domain-driven. Add the one the project needs and wrap it:

| Concern                                                                           | Wrap it behind                                          | Rule                                                                                                                                                     |
| --------------------------------------------------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ORM / DB driver (TypeORM, Prisma, Mongoose, Sequelize — interchangeable examples) | a repository (`infrastructure/<feature>.repository.ts`) | [04-repositories-and-persistence.md](../rules/04-repositories-and-persistence.md)                                                                        |
| Cache / queue / broker client                                                     | an adapter (`adapters/<vendor>.adapter.ts`)             | [12-library-wrapping-and-adapters.md](../rules/12-library-wrapping-and-adapters.md), [19-async-events-and-jobs.md](../rules/19-async-events-and-jobs.md) |
| Email provider / SMS gateway / notifications                                      | an adapter                                              | [12-library-wrapping-and-adapters.md](../rules/12-library-wrapping-and-adapters.md)                                                                      |
| Object storage / payment provider                                                 | an adapter                                              | [12-library-wrapping-and-adapters.md](../rules/12-library-wrapping-and-adapters.md)                                                                      |
| APM / tracing                                                                     | the logger adapter + an APM adapter                     | [14-observability-and-logging.md](../rules/14-observability-and-logging.md)                                                                              |

**Rule of thumb:** if a library can ever be swapped, the swap surface must be a single adapter or repository, not hundreds of direct imports. The ESLint architecture plugin enforces this — vendor libraries (ORMs, HTTP clients, loggers, brokers) may only be imported inside their adapter directory.

> **Project records:** for each concern above, the chosen library + version and the file that owns it. See [library-boundaries.md](./library-boundaries.md) and [database-decisions.md](./database-decisions.md).

## Lint & format toolchain (locked)

- **ESLint flat config** ([eslint.config.mjs](../eslint.config.mjs)) composed from modular files under `/eslint`, including the **custom architecture plugin**. Target: **0 errors AND 0 warnings**.
  - typescript-eslint `recommendedTypeChecked` + `strictTypeChecked` + `stylisticTypeChecked`.
  - plugins: import-x, simple-import-sort, unused-imports, promise, regexp, security, sonarjs, unicorn, prettier.
  - custom: `architecture/controller-no-logic`, `architecture/no-restricted-layer-imports`, plus `no-restricted-syntax` (no inline `const`/`enum`/`interface`/`type` in controllers/services/repositories; no `Promise.all|allSettled|any|race` inside services) and `max-lines-per-function: 20` on `*.service.ts`.
- **Prettier 3** — single quotes, trailing commas, `arrowParens: avoid`. Run through ESLint (`prettier/prettier`) so formatting failures are lint errors.

The architecture rules are what make "controllers stay thin", "services stay short", and "no vendor leakage" mechanical instead of aspirational. See [13-eslint-and-typescript.md](../rules/13-eslint-and-typescript.md).

## Test toolchain (locked)

- **Vitest 4** ([vitest.config.mts](../vitest.config.mts)) — the runner. Coverage via **@vitest/coverage-istanbul**. Never write Jest / ts-jest.
- **@nestjs/testing + supertest** — module-level unit tests and HTTP integration/e2e tests.
- **Coverage floor: 95%** (statements / branches / functions / lines); touched modules aim higher, critical paths near 100%. Tests are written or adjusted **first**. See [11-testing-and-coverage.md](../rules/11-testing-and-coverage.md), [/testing/coverage-policy.md](../testing/coverage-policy.md), and [testing-strategy.md](./testing-strategy.md).

## Commit & git-hook toolchain (locked)

- **Husky 9** ([.husky/](../.husky)):
  - **pre-commit** → `lint-staged` (eslint --fix on staged) + `typecheck` (project-wide `tsgo --noEmit`, not scoped to staged files).
  - **commit-msg** → `commitlint` (Conventional Commits).
  - **pre-push** → `test:coverage` + `build`.
- **lint-staged** — lint+fix only staged files, then re-stage.
- Never bypass hooks with `--no-verify` without a recorded, approved emergency exception (see [/claude.md](../claude.md)). A bypass must record why, who approved, what was skipped, and when it will be restored.

## npm scripts (the canonical entrypoints)

| Script                    | Command                                      | Purpose                      |
| ------------------------- | -------------------------------------------- | ---------------------------- |
| `start:dev`               | `nest start --watch`                         | Dev server with reload       |
| `build`                   | `nest build -p tsconfig.build.json`          | Production build to `dist/`  |
| `start:prod`              | `node dist/src/main`                         | Run the compiled build       |
| `typecheck`               | `tsgo --pretty --noEmit --incremental false` | Project-wide type check      |
| `lint` / `lint:fix`       | `eslint` / `eslint --fix`                    | Lint (0 errors / 0 warnings) |
| `format` / `format:check` | `prettier --write .` / `--check .`           | Format / verify              |
| `test` / `test:watch`     | `vitest run` / `vitest`                      | Tests                        |
| `test:coverage`           | `vitest run --coverage`                      | Tests + coverage gate        |

CI and local hooks invoke **these same scripts** — no divergent shadow set of steps.

## Quality gates (all green before "done")

```bash
npm run lint            # 0 errors AND 0 warnings
npm run typecheck       # tsgo --noEmit, project-wide
npm run test            # vitest
npm run test:coverage   # coverage thresholds met (95% floor)
npm run build           # compiles clean
```

A green build is **not** proof of correctness — walk [15-review-checklist.md](../rules/15-review-checklist.md) and prove behavior with tests.

## TypeScript strictness (highlights from [tsconfig.json](../tsconfig.json))

`strict` plus every additional safety flag: `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noImplicitReturns`, `noPropertyAccessFromIndexSignature`, `noUnusedLocals`, `noUnusedParameters`, `useUnknownInCatchVariables`, `noFallthroughCasesInSwitch`, `allowUnreachableCode: false`, `isolatedModules`, plus `emitDecoratorMetadata` + `experimentalDecorators` for NestJS DI. These flags are why "no `any`", "no `!`", and "handle every nullable" are mechanically true here. `tsconfig.build.json` extends it for `dist/` output and excludes tests.

## What an agent must do with this record

- **Do** read the project specifics (the "Project records" lines) before touching data or integration code — they name the ORM, DB, and adapters in play.
- **Do** add any new external library behind an adapter or repository, then update [library-boundaries.md](./library-boundaries.md).
- **Don't** introduce a second test runner, a second validator as the default, or `tsc`/Jest references.
- **Don't** read `process.env` outside `config/` or `bootstrap/`, or `console.*` instead of the logger adapter.

```ts
// Don't — vendor imported directly in business code, env read in a service
import { S3Client } from 'some-object-storage-sdk';
const bucket = process.env.BUCKET; // ✗ blocked by architecture/no-restricted-layer-imports

// Do — depend on an app-owned interface; config comes from typed config
@Injectable()
export class AvatarService {
  constructor(
    private readonly storage: ObjectStorageAdapter, // wraps the SDK (adapters/)
    private readonly config: StorageConfig, // typed @nestjs/config
  ) {}
}
```

Related: [/context/stack-and-toolchain.md](../context/stack-and-toolchain.md), [project-architecture.md](./project-architecture.md), [library-boundaries.md](./library-boundaries.md), [database-decisions.md](./database-decisions.md), [testing-strategy.md](./testing-strategy.md), [release-checklist.md](./release-checklist.md), [known-pitfalls.md](./known-pitfalls.md).
