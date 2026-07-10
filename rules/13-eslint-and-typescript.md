# 13 — ESLint & TypeScript: The Strictness Catalog

> The complete lint + type gate and how to pass it. This file implements the canon: every rule below maps to a layer rule, an architecture boundary, or a strict compiler flag. When this doc and the config disagree, **the config wins** — then fix this doc.

**Zero-tolerance gate.** `npm run lint` MUST print **0 errors AND 0 warnings**; `npm run typecheck` (`tsc --pretty --noEmit --incremental false`) MUST pass — both before any commit. Husky enforces them (`pre-commit` → `lint-staged` + `typecheck`; `pre-push` → `test:coverage` + `build`). **Never** silence a finding. No `// eslint-disable*`, no `@ts-ignore`. `@ts-expect-error` is allowed only with a ≥5-char justification (`ban-ts-comment: allow-with-description`) recorded in a linked decision file. See [00-non-negotiable-rules.md](./00-non-negotiable-rules.md) rules 1–7.

```bash
npm run lint        # eslint .            → must be 0/0
npm run lint:fix    # eslint . --fix      → autofix mechanical issues (sort/format/unused)
npm run typecheck   # TypeScript 7 tsc    → native type check, project-wide
npm run build       # TypeScript 7 tsc    → emit with tsconfig.build.json
```

## TypeScript 7 side-by-side ownership

- `@typescript/native` aliases `npm:typescript@7.0.2` and supplies the default `tsc` executable. It exclusively owns `npm run typecheck` and `npm run build`.
- The package named `typescript` aliases `npm:@typescript/typescript6@6.0.2`. It exists only for tools that import the compiler API, including Nest CLI, typescript-eslint, SonarJS, and ts-node; it is not the main language compiler and does not represent a downgrade.
- This is Microsoft's official TypeScript 7 side-by-side migration. `@typescript/native-preview` is removed.
- Do not use an `.npmrc` legacy-peer bypass, `--force`, `--legacy-peer-deps`, or hand-edited lockfile dependency/peer metadata. Use vendor-supported compatibility packages and prove the result with a clean install plus lint, typecheck, and build.

Tests run on Vitest — see [11-testing-and-coverage.md](./11-testing-and-coverage.md) and [/context/stack-and-toolchain.md](../context/stack-and-toolchain.md).

---

## The modular config layout

`eslint.config.mjs` composes small, single-purpose flat-config modules from `/eslint`. Each owns one concern so a rule's home is obvious and changes stay surgical.

| Module                    | Owns                                  | Highlights                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `base.config.mjs`         | Core JS correctness + simplicity caps | `no-console`, `no-debugger`, `eqeqeq` (smart), `curly` (all), `no-implicit-coercion`, `object-shorthand`, `prefer-template`, `complexity: 15`, `max-depth: 3`, `no-nested-ternary`, `no-else-return`, `no-param-reassign`, `no-return-assign` (rules/20, 23)                                                                                                    |
| `typescript.config.mjs`   | Type-aware strictness                 | `recommendedTypeChecked` + `strictTypeChecked` + `stylisticTypeChecked` plus explicit overrides (below)                                                                                                                                                                                                                                                         |
| `imports.config.mjs`      | Import hygiene                        | `simple-import-sort` (imports/exports), `import-x/no-cycle`, `import-x/no-duplicates`, `unused-imports/*`                                                                                                                                                                                                                                                       |
| `promise.config.mjs`      | Async safety                          | `always-return`, `catch-or-return`, `no-multiple-resolved`, `no-nesting`, `prefer-await-to-then`                                                                                                                                                                                                                                                                |
| `security.config.mjs`     | Vulnerability patterns                | plugin `recommended` + `detect-object-injection`                                                                                                                                                                                                                                                                                                                |
| `sonar.config.mjs`        | Bug / clean-code                      | `cognitive-complexity: 15`, `no-identical-functions`, `no-duplicated-branches`, `prefer-immediate-return`                                                                                                                                                                                                                                                       |
| `unicorn.config.mjs`      | Modern JS                             | `prefer-node-protocol`, `prefer-array-some`, `prefer-includes`, `no-unnecessary-await` (nested-ternary banning lives in `base.config.mjs` — the core rule — because `eslint-config-prettier` disables the unicorn variant)                                                                                                                                      |
| `regexp.config.mjs`       | Regex safety                          | `no-super-linear-backtracking` (ReDoS), `no-useless-*`, `prefer-d`, `optimal-quantifier-concatenation`                                                                                                                                                                                                                                                          |
| `architecture.config.mjs` | **Layer boundaries**                  | the custom `architecture/*` plugin (incl. `no-inline-layer-declarations`) + `no-restricted-syntax` + per-layer `max-lines-per-function` + `max-classes-per-file: 1` on layer files. `files:` entries MUST be minimatch globs — a regex string there never matches and silently disables the override (guarded by `test/eslint/config-rule-activation.spec.mjs`) |
| `prettier.config.mjs`     | Formatting as lint                    | `prettier/prettier` error + `eslint-config-prettier` to disable conflicting stylistic rules                                                                                                                                                                                                                                                                     |
| `test.config.mjs`         | Test relaxations                      | loosens unsafe-* for mocks; **keeps** `no-explicit-any` / `no-non-null-assertion`; bans `.only`                                                                                                                                                                                                                                                                 |
| `ignores.config.mjs`      | Lint scope                            | ignores `dist/`, `coverage/`, `node_modules/`, `**/*.{js,mjs,cjs}`, root `*.spec.ts`                                                                                                                                                                                                                                                                            |

> All `typescript.config.mjs` rules are **type-aware** (`parserOptions.project` → `tsconfig.eslint.json`). They need a clean project graph — a tsconfig error can cascade into spurious lint errors, so fix `typecheck` first.

---

## TypeScript-eslint — the explicit overrides

On top of the three `*TypeChecked` presets (`no-unsafe-*`, `no-floating-promises`, `no-misused-promises`, `unbound-method`, `restrict-template-expressions`, …), these are pinned to **error**:

| Rule                                                                                        | What it forces                                                                              |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `no-explicit-any`                                                                           | Never `any` — use `unknown` + narrowing or generics                                         |
| `no-non-null-assertion`                                                                     | No `!` — narrow with `if` / `??` / `?.`                                                     |
| `no-unused-vars`                                                                            | No dead locals/params — prefix `_` to keep intentionally                                    |
| `no-floating-promises`                                                                      | Every promise awaited or explicitly handled                                                 |
| `no-misused-promises`                                                                       | No promise where a sync boolean/callback is expected (`checksVoidReturn.attributes: false`) |
| `consistent-type-imports`                                                                   | `import type { Foo }` (`fixStyle: separate-type-imports`)                                   |
| `consistent-type-definitions`                                                               | `interface` for object shapes, not `type`                                                   |
| `no-import-type-side-effects`                                                               | Type-only imports emit no runtime side effect                                               |
| `no-confusing-void-expression`                                                              | No returning a void expression (arrow shorthand allowed)                                    |
| `no-unnecessary-condition`                                                                  | No always-true/false checks — trust the types                                               |
| `no-unnecessary-type-assertion`                                                             | No redundant `as`                                                                           |
| `no-base-to-string`                                                                         | No `[object Object]` stringification                                                        |
| `no-redundant-type-constituents` / `no-duplicate-enum-values` / `no-empty-object-type`      | Tidy, unambiguous types                                                                     |
| `no-extraneous-class` / `no-useless-constructor` / `no-empty-function` (allow constructors) | No empty class wrappers                                                                     |
| `only-throw-error` / `prefer-promise-reject-errors`                                         | Throw/reject `Error`-like values — pairs with typed `AppError` (rules/18)                   |
| `prefer-nullish-coalescing` / `prefer-optional-chain`                                       | `??` and `?.` over `\|\|` and manual `&&` chains                                            |
| `prefer-readonly`                                                                           | Never-reassigned private fields are `readonly`                                              |
| `require-await`                                                                             | `async` only when `await` is used                                                           |
| `return-await` (`in-try-catch`)                                                             | `return await` inside `try` so errors are caught                                            |
| `restrict-template-expressions`                                                             | Templates allow only `number` + `boolean` (config: `allowBoolean`, `allowNumber`)           |
| `switch-exhaustiveness-check`                                                               | Handle every enum/union case                                                                |

---

## The custom architecture plugin

This is the heart of the workspace — standard rules can't express "one delegation per controller method" or "controllers may not import repositories". Defined in `architecture.config.mjs`, enforced by `eslint-plugin-architecture`. Full layer map: [01-architecture-and-module-boundaries.md](./01-architecture-and-module-boundaries.md).

### `architecture/controller-no-logic`

A controller method must contain **exactly one** `return` statement whose value is a direct delegation (`return this.useCase.execute(dto)`), an identifier, a member access, or a literal — `await` allowed. No branching, no transformation, no orchestration. See [02-controllers-and-http-transport.md](./02-controllers-and-http-transport.md).

```ts
// Don't — logic in the transport layer (architecture/controller-no-logic)
@Post()
async create(@Body() dto: CreateOrderDto): Promise<OrderResponse> {
  if (!dto.items.length) throw new BadRequestException(); // branching
  const order = await this.service.save(dto);            // two statements
  return OrderMapper.toResponse(order);                  // transformation
}

// Do — parse via DTO, one delegation, return it
@Post()
create(@Body() dto: CreateOrderDto): Promise<OrderResponse> {
  return this.createOrder.execute(dto);
}
```

### `architecture/no-restricted-layer-imports`

Enforces one-way dependencies by file suffix and folder, plus vendor-library and `process.env` boundaries. Layers are matched by `*.controller.ts`, `*.service.ts`, `*.repository.ts`, `*.use-case.ts`, and the `/application/`, `/api/dto/`, `/infrastructure/` folders.

| From                                                                    | May NOT import                                                            | Why                                                                    |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Controller                                                              | repository, infrastructure                                                | Controllers stay HTTP-only; depend on use cases/services, DTOs, guards |
| Use case (`/application/`)                                              | controller, API DTO                                                       | Application orchestration is transport-agnostic                        |
| Service                                                                 | controller                                                                | Services are focused capabilities, not callers of transport            |
| Repository                                                              | controller, service, use case, API DTO                                    | Persistence owns data access only                                      |
| API DTO (`/api/dto/`)                                                   | service, repository, infrastructure                                       | DTOs are boundary declarations only                                    |
| **Vendor libs** (`axios`, `winston`/`pino`, ORM clients, brokers/cache) | anywhere outside their adapter                                            | Wrap behind `adapters/*.adapter.ts` or the owning folder (rules/12)    |
| `process.env`                                                           | anywhere outside `config/`, `bootstrap/`, `*.config.ts`, `*.providers.ts` | Typed config only (rules/17)                                           |

```ts
// Don't — controller reaches into persistence (no-restricted-layer-imports)
import { OrderRepository } from '../infrastructure/order.repository';

// Don't — vendor SDK imported in business code
import axios from 'axios'; // only allowed in /http/ or an *.adapter.ts

// Do — depend on the application surface; vendors live behind adapters
import { CreateOrderUseCase } from '../application/create-order.use-case';
import { HttpAdapter } from '@core/http/http.adapter';
```

### `architecture/no-inline-layer-declarations` — no inline or anonymous contracts

In controllers, services, use cases, repositories, adapters, guards, interceptors, pipes, filters, and handlers, module-level `const`, `enum`, `interface`, `type`, helper `function`, and nested anonymous type-literal contracts are banned — move them to the owner in [30-declaration-ownership.md](./30-declaration-ownership.md). The class/function is the layer (the sole module-value exception is `LOG_PREFIX`). `max-classes-per-file: 1` blocks a second helper class.

### `architecture/no-definite-assignment-assertions`

`field!: Type` is an unchecked initialization escape hatch and is rejected in every TypeScript file. Decorated DTO/config fields use `declare readonly`; stateful classes initialize fields in a constructor.

```ts
// Don't — inline declarations inside a service (no-inline-layer-declarations)
@Injectable()
export class OrderService {
  private readonly MAX_ITEMS = 100; // inline const
  async place(input: { id: string }): Promise<void> {
    /* inline type */
  }
}

// Do — declarations live in dedicated modules
import { MAX_ORDER_ITEMS } from '../model/order.constants';
import type { PlaceOrderInput } from '../model/order.types';
```

### `no-restricted-syntax` — no concurrency primitives in services

`Promise.all | allSettled | any | race` are banned inside `*.service.ts`. Concurrent orchestration belongs in a use case or a dedicated `lib/` helper, where transaction boundaries and ordering are explicit. See [03-application-services-and-use-cases.md](./03-application-services-and-use-cases.md).

```ts
// Don't — fan-out hidden inside a service method (no-restricted-syntax)
const [a, b] = await Promise.all([this.repo.findA(id), this.repo.findB(id)]);

// Do — move multi-step orchestration to a use case / helper
```

### `max-lines-per-function` by implementation layer

`*.service.ts` methods cap at **20** logical lines; other implementation-layer methods cap at **40** (`skipBlankLines`, `skipComments`). Overflow routes to the concern's real `lib/`/`domain/`/persistence/adapter owner or the matching split skill—never truncation or a cosmetic file split.

> **Tests are exempt** (`test.config.mjs` turns this off) — fixtures and arrange-blocks are legitimately longer.

---

## Strict TypeScript flags (from `tsconfig.json`)

`strict: true` plus every additional safety flag. These make "no `any`", "no `!`", and "handle every nullable" mechanically true.

| Flag                                                                                                                                  | Effect                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `strict` (+ `noImplicitAny`/`This`, `strictNullChecks`, `strictFunctionTypes`, `strictBindCallApply`, `strictPropertyInitialization`) | All baseline strict guarantees                                                 |
| `noUncheckedIndexedAccess`                                                                                                            | `arr[i]` / `obj[key]` is `T \| undefined` — always narrow                      |
| `exactOptionalPropertyTypes`                                                                                                          | `foo?: string` does **not** accept explicit `undefined` — conditionally spread |
| `noPropertyAccessFromIndexSignature`                                                                                                  | Index-signature members use `obj['key']`, declared members use `obj.key`       |
| `useUnknownInCatchVariables`                                                                                                          | `catch (e)` ⇒ `e: unknown` — narrow with `instanceof Error`                    |
| `noImplicitOverride`                                                                                                                  | Subclass overrides need the `override` keyword                                 |
| `noImplicitReturns`                                                                                                                   | Every code path returns                                                        |
| `noFallthroughCasesInSwitch`                                                                                                          | No implicit switch fallthrough                                                 |
| `noUnusedLocals` / `noUnusedParameters`                                                                                               | Dead locals/params are compile errors (`_`-prefix to keep)                     |
| `allowUnreachableCode: false` / `allowUnusedLabels: false`                                                                            | Dead code is a compile error                                                   |
| `isolatedModules` / `moduleDetection: force`                                                                                          | Each file transpiles independently — drives `consistent-type-imports`          |
| `noUncheckedSideEffectImports`                                                                                                        | Side-effect imports must resolve                                               |
| `experimentalDecorators` + `emitDecoratorMetadata`                                                                                    | NestJS DI / decorators                                                         |

`skipLibCheck: true` (don't type-check `node_modules`). Path aliases `@/* @app/* @config/* @core/* @modules/* @shared/*` are declared here — never deep relative climbs (`../../../core/...`).

```ts
// noUncheckedIndexedAccess — index access is possibly-undefined
const first = items[0]; // Item | undefined
if (first === undefined) return;

// useUnknownInCatchVariables — narrow before use
try {
  await this.adapter.send(payload);
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  this.logger.error('send failed', { message });
}

// exactOptionalPropertyTypes — never assign explicit undefined to an optional
const meta: { actorId?: string } = {
  ...(actorId === undefined ? {} : { actorId }), // spread, don't pass undefined
};
```

---

## Prettier (enforced as a lint error)

`prettier/prettier` runs as an ESLint **error**; `eslint-config-prettier` disables conflicting stylistic rules. Settings: `singleQuote: true`, `trailingComma: 'all'`, `printWidth: 80`, `arrowParens: 'avoid'`. Run `npm run lint:fix` to autofix. Keep `.prettierrc` and `prettier.config.mjs` in sync.

---

## Test-file relaxations

Services cap at 20 lines per method. Use cases, repositories, adapters, guards, pipes, interceptors, filters, and handlers cap at 40. Tests are exempt from method/file declaration caps but keep the no-definite-assignment rule.

For `*.spec.ts` and `test/**/*.ts` (`test.config.mjs`): `no-unsafe-*`, `unbound-method`, `consistent-type-imports`, `no-extraneous-class`, `prefer-nullish-coalescing`, `only-throw-error`, layer declaration/class/method caps, and `architecture/no-restricted-layer-imports` are **off** so tests can assemble fixtures and mock freely. Still enforced: **`no-explicit-any`, `no-non-null-assertion`, `no-unnecessary-type-assertion`, `no-definite-assignment-assertions`**, and a **ban on `.only`**.

---

## Common violations → root-cause fix

Fix the cause, never the symptom. Disabling a rule is a non-negotiable violation (rule 4).

| Finding                                             | Root-cause fix                                                                                               |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `no-explicit-any`                                   | Type it: `unknown` + narrowing, a real interface, or a generic                                               |
| `no-non-null-assertion` (`x!`)                      | Guard (`if (x === undefined) …`), default (`x ?? fallback`), or `x?.member`                                  |
| `no-floating-promises`                              | `await` it, `return` it, or `void` it with a comment for true fire-and-forget (rules/19)                     |
| `no-misused-promises`                               | Don't pass an `async` fn where a sync return is expected; wrap or restructure                                |
| `no-unnecessary-condition`                          | The value can't be nullish per its type — remove the check or fix the type                                   |
| `prefer-nullish-coalescing`                         | Replace `\|\|` with `??` when guarding null/undefined (keeps `0`/`''` valid)                                 |
| `restrict-template-expressions`                     | `String(x)` or narrow before interpolating non-primitives                                                    |
| `switch-exhaustiveness-check`                       | Add the missing case, or a `default` with a `never` assertion                                                |
| `consistent-type-imports`                           | `import type { Foo }` for type-only imports (autofix)                                                        |
| `no-console`                                        | Use the logger adapter from `@core/logger` (rules/14)                                                        |
| `architecture/controller-no-logic`                  | Move branching/transformation into a use case/service; leave one delegation                                  |
| `architecture/no-restricted-layer-imports`          | Depend through the correct layer / module `index.ts`; wrap vendor in an adapter                              |
| `architecture/no-inline-layer-declarations`         | Extract to `model/*.types.ts` / `*.enums.ts` / `*.constants.ts` / `lib/*.helpers.ts`                         |
| `architecture/no-definite-assignment-assertions`    | DTO: `declare readonly`; stateful class: initialize in the constructor                                       |
| `no-restricted-syntax` (`Promise.all` in service)   | Move concurrency to a use case or `lib/` helper                                                              |
| `max-lines-per-function` (service > 20)             | Extract helpers to `lib/`, or escalate to a use case                                                         |
| `complexity` / `sonarjs/cognitive-complexity` (>15) | Extract named guards/policies/mappers per the routing in [23](./23-function-service-file-size-discipline.md) |
| `max-depth` (> 3)                                   | Guard clauses and early returns instead of nesting (rules/20)                                                |
| `no-nested-ternary` / `no-else-return`              | Simple branches or a named helper; return early                                                              |
| `max-classes-per-file` (layer file)                 | Move the second class to its own owner file                                                                  |
| `import-x/no-cycle`                                 | Break the cycle via an interface, a shared type module, or events                                            |
| `simple-import-sort/imports`                        | `npm run lint:fix`                                                                                           |
| `regexp/no-super-linear-backtracking`               | Rewrite to remove nested quantifiers; validate via a DTO instead                                             |
| `noUncheckedIndexedAccess` (`T \| undefined`)       | Narrow after index/array access before use                                                                   |
| `exactOptionalPropertyTypes`                        | Conditionally spread; never assign explicit `undefined` to an optional                                       |

---

## Checklist

- [ ] `npm run lint` is **0 errors AND 0 warnings**; `npm run typecheck` passes
- [ ] No `eslint-disable`, `@ts-ignore`; `@ts-expect-error` only with a linked, justified reason
- [ ] No `any`, no `!`, `===`/`!==` only, every nullable narrowed
- [ ] No inline `const`/`enum`/`interface`/`type`/helper `function` in layer files (controllers/services/use-cases/repositories/adapters/guards/interceptors/pipes)
- [ ] No `Promise.all|allSettled|any|race` inside a service; service methods ≤ 20 lines
- [ ] Within the simplicity caps: complexity ≤ 15, depth ≤ 3, no nested ternaries — and no clever TypeScript ([20 §4](./20-simple-readable-code.md))
- [ ] Layer imports respected; vendor libs only inside adapters; `process.env` only in config/bootstrap
- [ ] Controllers are one direct delegation per method
- [ ] Imports sorted, de-duplicated, cycle-free; type imports are type-only
- [ ] No `.only` in committed tests; `console.*` replaced by the logger adapter
- [ ] `npm run test` / `test:coverage` / `build` green

**Related:** [00-non-negotiable-rules.md](./00-non-negotiable-rules.md) · [01-architecture-and-module-boundaries.md](./01-architecture-and-module-boundaries.md) · [02-controllers-and-http-transport.md](./02-controllers-and-http-transport.md) · [06-types-enums-constants.md](./06-types-enums-constants.md) · [12-library-wrapping-and-adapters.md](./12-library-wrapping-and-adapters.md) · [15-review-checklist.md](./15-review-checklist.md) · [/skills/fix-eslint-typecheck.md](../skills/fix-eslint-typecheck.md) · [/context/stack-and-toolchain.md](../context/stack-and-toolchain.md) · [/memory/known-pitfalls.md](../memory/known-pitfalls.md)
