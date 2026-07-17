# Backend Stack — Decision Record

> The locked runtime, build, lint, and test toolchain for a NestJS backend in this workspace. This is a durable convention, not a changelog. It mirrors [/context/stack-and-toolchain.md](../context/stack-and-toolchain.md) and implements the canon in [/context/architecture-map.md](../context/architecture-map.md) and [00-non-negotiable-rules.md](../rules/00-non-negotiable-rules.md).

## Decision

The framework and tooling below are **fixed**: NestJS 11, the TypeScript 7 native CLI for typecheck/build, the TypeScript 6 compatibility API for tool consumers, ESLint flat config with a custom architecture plugin, Vitest, and Husky gates. The **business stack** — ORM, database, cache, broker, mailer, object storage, APM — is intentionally **unfixed**: a project chooses it and hides it behind an adapter or repository so the rest of the codebase never imports a vendor directly.

The split exists so every project inherits the same correctness machinery while staying free to pick the data and integration tech the domain actually needs.

> **Project records:** name the chosen ORM / database / cache / broker / mailer / storage / APM here, with the version and the adapter or repository that owns each one.

## Runtime & language

| Item                   | Choice                                                     | Rationale                                                                                                                                                    |
| ---------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Runtime                | **Node.js 24.18.0 LTS** (`>=24.18.0 <25`, `npm >=11.16.0`) | Exact LTS baseline; pin runtime and package manager so CI and local agree.                                                                                   |
| Language and CLI       | **TypeScript 7.0.2** via `@typescript/native`              | `@typescript/native` aliases `npm:typescript@7.0.2` and supplies the default `tsc` executable for typecheck and build.                                       |
| Tool compatibility API | **TypeScript 6** via the package named `typescript`        | `npm:@typescript/typescript6@6.0.2` exists solely for Nest CLI, typescript-eslint, SonarJS, ts-node, and other compiler-API consumers.                       |
| Framework              | **NestJS 11** on **Fastify** (`@nestjs/platform-fastify`)  | DI + module boundaries match the layered architecture; Fastify for throughput. `@nestjs/platform-express` stays installed so a project can switch platforms. |

> NestJS is the transport and DI substrate — there is no raw routing, no manual request/response plumbing. HTTP entry is a `@Controller`; cross-cutting concerns are guards, pipes, interceptors, filters, and decorators, never ad-hoc handlers.

> This is Microsoft's official TypeScript 7 side-by-side migration, not a downgrade. Typecheck and build use the TypeScript 7 `tsc`; only tools importing `typescript` receive the TypeScript 6 compatibility API. `@typescript/native-preview` is removed.

## Framework libraries (shipped, locked)

These ride with the framework and are part of the standard surface:

- **@nestjs/common / core** — framework runtime.
- **@nestjs/config** — typed, validated configuration. The only sanctioned config source. See [17-configuration-and-environment.md](../rules/17-configuration-and-environment.md).
- **@nestjs/swagger** — OpenAPI document, generated in `bootstrap/`.
- **@nestjs/throttler** — rate limiting.
- **@nestjs/jwt + bcrypt** — isolated behind the auth token/password ports and adapters. No Passport dependency is installed. See [07-security-authn-authz.md](../rules/07-security-authn-authz.md).
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

- **Vitest 4** ([vitest.config.mts](../vitest.config.mts)) — the runner. Coverage uses the configured **V8 provider** (`@vitest/coverage-v8`). Never write Jest / ts-jest.
- **@nestjs/testing + supertest** — module-level unit tests and HTTP integration/e2e tests.
- **Coverage floor:** 95% statements/functions/lines; 90% measured branches for decorator artifacts; every real touched branch covered. Tests are written or adjusted **first**. See [11-testing-and-coverage.md](../rules/11-testing-and-coverage.md), [/testing/coverage-policy.md](../testing/coverage-policy.md), and [testing-strategy.md](./testing-strategy.md).

## Commit & git-hook toolchain (locked)

- **Husky 9** ([.husky/](../.husky)):
  - **pre-commit** → `lint-staged` (eslint --fix on staged) + `typecheck` (project-wide TypeScript 7 `tsc --noEmit`, not scoped to staged files).
  - **commit-msg** → `commitlint` (Conventional Commits).
  - **pre-push** → `test:coverage` + `build`.
- **lint-staged** — lint+fix only staged files, then re-stage.
- Never bypass hooks with `--no-verify` without a recorded, approved emergency exception (see [/claude.md](../claude.md)). A bypass must record why, who approved, what was skipped, and when it will be restored.

## npm scripts (the canonical entrypoints)

| Script                    | Command                                     | Purpose                       |
| ------------------------- | ------------------------------------------- | ----------------------------- |
| `start:dev`               | `nest start --watch`                        | Dev server with reload        |
| `build`                   | `tsc -p tsconfig.build.json`                | TypeScript 7 build to `dist/` |
| `start:prod`              | `node dist/src/main`                        | Run the compiled build        |
| `typecheck`               | `tsc --pretty --noEmit --incremental false` | TypeScript 7 type check       |
| `lint` / `lint:fix`       | `eslint` / `eslint --fix`                   | Lint (0 errors / 0 warnings)  |
| `format` / `format:check` | `prettier --write .` / `--check .`          | Format / verify               |
| `test` / `test:watch`     | `vitest run` / `vitest`                     | Tests                         |
| `test:coverage`           | `vitest run --coverage`                     | Tests + coverage gate         |

CI and local hooks invoke **these same scripts** — no divergent shadow set of steps.

## Quality gates (all green before "done")

```bash
npm run lint            # 0 errors AND 0 warnings
npm run typecheck       # tsc --noEmit, TypeScript 7, project-wide
npm run test            # vitest
npm run test:coverage   # 95% statements/functions/lines; 90% measured branches; real changed branches covered
npm run build           # tsc -p tsconfig.build.json, TypeScript 7
```

A green build is **not** proof of correctness — walk [15-review-checklist.md](../rules/15-review-checklist.md) and prove behavior with tests.

## TypeScript strictness (highlights from [tsconfig.json](../tsconfig.json))

`strict` plus every additional safety flag: `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noImplicitReturns`, `noPropertyAccessFromIndexSignature`, `noUnusedLocals`, `noUnusedParameters`, `useUnknownInCatchVariables`, `noFallthroughCasesInSwitch`, `allowUnreachableCode: false`, `isolatedModules`, plus `emitDecoratorMetadata` + `experimentalDecorators` for NestJS DI. These flags are why "no `any`", "no `!`", and "handle every nullable" are mechanically true here. `tsconfig.build.json` extends it for `dist/` output and excludes tests.

## What an agent must do with this record

- **Do** read the project specifics (the "Project records" lines) before touching data or integration code — they name the ORM, DB, and adapters in play.
- **Do** add any new external library behind an adapter or repository, then update [library-boundaries.md](./library-boundaries.md).
- **Do** prefer latest stable compatible packages and official migration/compatibility paths; prove clean install, lint, typecheck, and build after dependency changes.
- **Don't** introduce a second test runner or default validator, use an `.npmrc` legacy-peer bypass, pass `--force`/`--legacy-peer-deps`, or hand-edit lockfile dependency/peer metadata.
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
