# Skill: Create a Feature Module

> Scaffold a new `src/modules/<feature>/` from empty folders to a wired, public-surfaced module — applying the canonical layered architecture so it reads like it always belonged. Implements [/context/architecture-map.md](../context/architecture-map.md) §3 and [00-non-negotiable-rules.md](../rules/00-non-negotiable-rules.md).

## When to use

A genuinely new bounded capability that does not fit any existing module. If it is a sub-feature of an existing module, add files there instead — do not over-fragment. Pick a **kebab-case** module name (`account`, `invoice`, `order`) and a route prefix (e.g. `/v1/<feature>`). `<feature>` and names like `Account` / `Invoice` / `Order` below are **illustrative placeholders** — substitute your real domain.

## Rules this skill enforces

| #   | Rule                                                                                   | Source                                                                                        |
| --- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 1   | One module = the layers mirrored; deps point inward/downward only                      | [01-architecture-and-module-boundaries.md](../rules/01-architecture-and-module-boundaries.md) |
| 2   | No cross-module internal imports — consume another module via its `index.ts` or events | [00-non-negotiable-rules.md](../rules/00-non-negotiable-rules.md) #24                         |
| 3   | Zero inline types/enums/consts/DTOs/maps in layer files → `model/`                     | [06-types-enums-constants.md](../rules/06-types-enums-constants.md)                           |
| 4   | Default to a Service; escalate to a Use case only for multi-entity/transactional work  | [03-application-services-and-use-cases.md](../rules/03-application-services-and-use-cases.md) |
| 5   | Tests first; touched-module coverage floor 95%                                         | [11-testing-and-coverage.md](../rules/11-testing-and-coverage.md)                             |

---

## Step 0 — Tests FIRST

Before scaffolding, stub the test files alongside the layers you will build (`*.service.spec.ts`, `*.controller.spec.ts` or an e2e `*.e2e-spec.ts`). Write the failing expectations for the first capability, then make them pass layer by layer. No behavior ships without tests in the same change. Use [write-unit-tests.md](./write-unit-tests.md) and [write-integration-tests.md](./write-integration-tests.md).

## Step 1 — Create the directory skeleton

Create only the folders you need now; do not scaffold empty dirs. The full shape (add `application/use-case`, `domain/`, `lib/` as orchestration and rules grow):

```
src/modules/<feature>/
├── <feature>.module.ts            # wiring + public surface
├── index.ts                       # public API barrel (what other modules may import)
├── api/
│   ├── <feature>.controller.ts    # thin transport: one delegation per method
│   └── dto/                       # create / update / response DTOs
├── application/
│   └── <feature>.service.ts       # focused capability (escalate to *.use-case.ts when needed)
├── domain/                        # policies, entities, state machines (pure)
├── infrastructure/
│   └── <feature>.repository.ts    # persistence only, parameterized + bounded
├── model/
│   ├── <feature>.types.ts
│   ├── <feature>.enums.ts
│   └── <feature>.constants.ts
└── lib/                           # mappers / formatters / helpers
```

> Never put a type, enum, constant, or helper inside `*.controller.ts` / `*.service.ts` / `*.repository.ts` / `*.use-case.ts` — they live in `model/` or `lib/`. ESLint `no-restricted-syntax` will fail the inline declaration.

## Step 2 — Define the model first (enums, constants, types, message keys)

Declare the shape before the logic. Enums get a sibling `*_VALUES` tuple for validation reuse.

```ts
// model/<feature>.enums.ts
export enum AccountStatus {
  Active = 'active',
  Suspended = 'suspended',
}
export const ACCOUNT_STATUS_VALUES = Object.values(AccountStatus);
```

```ts
// model/<feature>.constants.ts — limits, message keys, no magic literals in logic
export const ACCOUNT_LIST_MAX = 100; // hard cap, never unbounded (rules/09)
export const ACCOUNT_ERROR_KEYS = {
  notFound: 'errors.account.not_found',
  forbidden: 'errors.account.forbidden',
} as const;
```

Register each `messageKey` for every supported locale via [add-i18n-message-key.md](./add-i18n-message-key.md). Build the rest with the layer skills: [create-repository.md](./create-repository.md) → [create-service.md](./create-service.md) (or [create-use-case.md](./create-use-case.md)) → [create-dto-validation.md](./create-dto-validation.md) → [create-controller.md](./create-controller.md). Typed errors via [create-error.md](./create-error.md).

## Step 3 — Wire the module (`<feature>.module.ts`)

Provide the providers, register the controller, and **export only** what other modules legitimately consume. Import `@core`/`@shared`/`@config` and your own internals — never another module's internals.

```ts
// src/modules/<feature>/<feature>.module.ts
import { Module } from '@nestjs/common';
import { AccountController } from './api/account.controller';
import { AccountService } from './application/account.service';
import { AccountRepository } from './infrastructure/account.repository';

@Module({
  controllers: [AccountController],
  providers: [AccountService, AccountRepository],
  exports: [AccountService], // public surface only
})
export class AccountModule {}
```

Do:

```ts
@Module({ providers: [AccountService, AccountRepository], exports: [AccountService] })
```

Don't:

```ts
// ❌ exporting the repository leaks persistence across module boundaries
@Module({ providers: [AccountRepository], exports: [AccountRepository] })
```

## Step 4 — Public surface (`index.ts`)

The barrel is the **only** import target other modules may use. Export the module, the service contract, and shared types — never repositories, DTOs, or internal helpers.

```ts
// src/modules/<feature>/index.ts
export { AccountModule } from './account.module';
export { AccountService } from './application/account.service';
export type { AccountSummary } from './model/account.types';
```

> Guard against circular re-exports: a `*.types.ts` must not re-export from a file that imports it. Keep `model/` dependency-light.

## Step 5 — Register in `app.module.ts`

Import the feature module into the root module's `imports` array. No route table to edit — NestJS routing comes from the controller's `@Controller('<prefix>')` decorator.

```ts
// src/app.module.ts
import { Module } from '@nestjs/common';
import { AccountModule } from '@modules/account';

@Module({
  imports: [
    // config, core, ...existing feature modules
    AccountModule,
  ],
})
export class AppModule {}
```

Import via the `@modules/*` alias and the module's `index.ts` — never a deep relative path into another module's folder.

## Step 6 — Secure every protected route

Each protected controller method chains an auth guard + a permissions (RBAC) guard + an ownership/tenant check; identity comes from the verified token via `@CurrentUser()`, never the client body. Add new permissions to the central catalog before wiring. See [add-guard-and-permission.md](./add-guard-and-permission.md) and [07-security-authn-authz.md](../rules/07-security-authn-authz.md).

## Step 7 — Adapters for anything external

If the module talks to an email provider, object storage, an SMS gateway, a payment provider, or a cache, wrap the vendor behind an `adapters/<vendor>.adapter.ts` and depend on your interface — never the SDK. See [add-library-adapter.md](./add-library-adapter.md) and [12-library-wrapping-and-adapters.md](../rules/12-library-wrapping-and-adapters.md).

## Step 8 — Docs

Add OpenAPI decorators on controller methods, and create the feature folder under [/docs/features/](../docs/features/README.md) from [the template](../docs/features/_template) recording scope, decisions, and risks.

---

## Quality gates

```bash
npm run lint           # 0 errors AND 0 warnings (architecture plugin included)
npm run typecheck      # tsc --noEmit (TypeScript 7), project-wide
npm run test           # vitest
npm run test:coverage  # touched-module floor 95%, critical paths near 100%
npm run build          # compiles clean
```

Never bypass Husky with `--no-verify`. A green build is not proof of correctness — walk [15-review-checklist.md](../rules/15-review-checklist.md).

## Pitfalls

- **Empty folders.** Scaffold a directory only when you add a real file to it — no placeholder dirs.
- **Catch-all filenames.** No `utils.ts` / `helpers.ts` / `types.ts` at module root; use descriptive names in `lib/` and `model/`.
- **Leaky barrel.** Re-exporting repositories or DTOs from `index.ts` invites cross-module deep coupling. Export the service contract and types only.
- **Reaching into another module.** Import another feature only through its `index.ts` or communicate via events — not a deep relative path.
- **Premature use case.** Start with a Service; escalate to a Use case only for multi-entity transactional work with ordered post-commit events. Use cases call services; services never call use cases.
- **Inline declarations.** Types/enums/consts in a layer file fail ESLint — put them in `model/`.
- **Unbounded lists.** Every list method paginates with the hard max limit; identity is read from the token, never the body.
- **Missing `_VALUES` tuple.** New enums need the values array so DTO/validation can reuse them.

## Related

[create-controller.md](./create-controller.md) · [create-service.md](./create-service.md) · [create-use-case.md](./create-use-case.md) · [create-repository.md](./create-repository.md) · [create-dto-validation.md](./create-dto-validation.md) · [create-error.md](./create-error.md) · [add-guard-and-permission.md](./add-guard-and-permission.md) · [add-library-adapter.md](./add-library-adapter.md) · [/context/architecture-map.md](../context/architecture-map.md) · [README.md](./README.md)
