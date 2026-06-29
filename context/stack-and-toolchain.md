# Stack & Toolchain

> The exact runtime, build, lint, and test toolchain this workspace ships. The configuration files referenced here are real and live at the repo root — drop them into a NestJS project (or start from this repo) and you inherit the whole strict setup. The business stack (ORM, DB, cache, broker) is intentionally left to the project; everything else is opinionated and locked.

## Runtime & language

- **Node.js 20+** (`engines.node >= 20`, `npm >= 10`).
- **TypeScript 6** (`typescript 6.0.3`) for editor/types, type-checked & built with the toolchain below.
- **tsgo** — `@typescript/native-preview`, the native TypeScript compiler used for fast type-checking (`npm run typecheck` → `tsgo --noEmit`). It type-checks; it does not run `.ts`.
- **NestJS 11** on the **Fastify** platform (`@nestjs/platform-fastify`); `@nestjs/platform-express` is also installed so a project can switch platforms.

## Framework & libraries (shipped)

- **@nestjs/common / core** 11.1.x — framework.
- **@nestjs/config** — typed, validated configuration.
- **@nestjs/swagger** — OpenAPI.
- **@nestjs/throttler** — rate limiting.
- **@nestjs/jwt + @nestjs/passport + passport-jwt** — auth building blocks.
- **class-validator + class-transformer** — DTO validation (primary). Zod is supported via a custom pipe (see [`/rules/05-dto-and-validation.md`](../rules/05-dto-and-validation.md)).
- **reflect-metadata, rxjs, tslib** — framework runtime.

> **Not shipped on purpose (you choose):** ORM/database driver, cache/queue client, mailer, object storage, APM. Add them behind an **adapter** (rules/12) so the rest of the codebase never imports the vendor directly.

## Lint & format toolchain

- **ESLint 10 flat config** ([`eslint.config.mjs`](../eslint.config.mjs)) composed from modular files under [`/eslint`](../eslint), including a **custom architecture plugin** that enforces the layered architecture. Target: **0 errors AND 0 warnings**.
  - typescript-eslint `recommendedTypeChecked` + `strictTypeChecked` + `stylisticTypeChecked`
  - plugins: import-x, simple-import-sort, unused-imports, promise, regexp, security, sonarjs, unicorn, prettier
  - custom: `architecture/controller-no-logic`, `architecture/no-restricted-layer-imports`
- **Prettier 3** ([`.prettierrc`](../.prettierrc)) — single quotes, trailing commas, `printWidth: 80`, `arrowParens: avoid`. Run through ESLint (`prettier/prettier`) so formatting is a lint error.

## Test toolchain

- **Vitest 4** ([`vitest.config.mts`](../vitest.config.mts)) — runner. Coverage via **@vitest/coverage-istanbul**.
- **@nestjs/testing + supertest** — module-level unit tests and HTTP integration/e2e tests.
- **Coverage gate:** statements / branches / functions / lines at the workspace floor (95%). Touched modules should aim higher (critical paths near 100%). See [`/testing/coverage-policy.md`](../testing/coverage-policy.md).

## Commit & git-hook toolchain

- **Husky 9** ([`.husky/`](../.husky)) git hooks:
  - **pre-commit** → `lint-staged` (eslint --fix on staged) + `typecheck` (project-wide).
  - **commit-msg** → `commitlint` (Conventional Commits, [`commitlint.config.cjs`](../commitlint.config.cjs)).
  - **pre-push** → `test:coverage` + `build`.
- **lint-staged** ([`.lintstagedrc.cjs`](../.lintstagedrc.cjs)) — lint+fix only staged files, then re-stage.
- Never bypass hooks (`--no-verify`) without a recorded, approved emergency exception (see the SDLC policy in [`/claude.md`](../claude.md)).

## npm scripts

| Script | Command | Purpose |
| --- | --- | --- |
| `start:dev` | `nest start --watch` | Dev server with reload |
| `build` | `nest build -p tsconfig.build.json` | Production build to `dist/` |
| `start:prod` | `node dist/src/main` | Run the compiled build |
| `typecheck` | `tsgo --pretty --noEmit --incremental false` | Project-wide type check |
| `lint` / `lint:fix` | `eslint` / `eslint --fix` | Lint (0 errors/0 warnings) |
| `format` / `format:check` | `prettier --write .` / `--check .` | Format / verify |
| `test` / `test:watch` | `vitest run` / `vitest` | Tests |
| `test:coverage` | `vitest run --coverage` | Tests + coverage gate |

## Quality gates (all green before "done")

```bash
npm run lint            # 0 errors AND 0 warnings
npm run typecheck       # tsgo --noEmit, project-wide
npm run test            # vitest
npm run test:coverage   # coverage thresholds met
npm run build           # compiles clean
```

A green build is **not** proof of correctness — walk the [review checklist](../rules/15-review-checklist.md) and prove behavior with tests.

## TypeScript strictness (highlights from [`tsconfig.json`](../tsconfig.json))

`strict` + every additional safety flag: `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noImplicitReturns`, `noPropertyAccessFromIndexSignature`, `noUnusedLocals`, `noUnusedParameters`, `useUnknownInCatchVariables`, `noFallthroughCasesInSwitch`, `allowUnreachableCode: false`, `isolatedModules`, plus `emitDecoratorMetadata` + `experimentalDecorators` for NestJS DI. These flags are why "no `any`", "no `!`", and "handle every nullable" are mechanically true here.
