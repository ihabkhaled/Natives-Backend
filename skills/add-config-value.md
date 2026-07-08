# Skill — Add a Config Value

> Declare one new configuration value end-to-end: `.env.example` -> validated env schema -> typed `registerAs` namespace -> injected `ConfigType` at the call site -> docs. Implements [/rules/17-configuration-and-environment.md](../rules/17-configuration-and-environment.md) and rules 27 / 29 / 40 / 42 of [/rules/00-non-negotiable-rules.md](../rules/00-non-negotiable-rules.md).

A config value is an **input contract**. It must be declared once, validated at startup, typed, injected — and never read as raw `process.env` outside `config/` or `bootstrap/`. A misconfigured process refuses to boot loudly rather than failing mid-request.

## Rules this skill enforces

- **No raw `process.env`** outside `config/` and `bootstrap/` — ESLint `architecture/no-restricted-layer-imports` (rule 27).
- **Validate at startup, fail fast** — invalid/missing values throw and exit non-zero (rule 29).
- **Typed namespaces** via `registerAs` + injected `ConfigType`; no stringly-typed `.get('KEY')` in business code (rule 40).
- **No inline declarations** — types, enums, constants (defaults, bounds) live in dedicated files (rules 10–16).
- **Sync in one change** — schema, namespace, `.env.example`, and docs move together (rule 42).
- **Secrets** are sourced from a secret manager, never committed, never logged, minimum-strength enforced ([/rules/07-security-authn-authz.md](../rules/07-security-authn-authz.md)).

## Before you start — decide three things

| Decision                  | Options                                                                                                              |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Concern / namespace**   | Reuse an existing namespace (`app`, `auth`, `database`, `cache`, `mailer`, `featureFlags`, …) or create a new one.   |
| **Required vs defaulted** | Required for secrets/correctness (no fallback). Defaulted only for operational tuning (timeouts, page sizes, flags). |
| **Type & constraints**    | `string` / `number` / `boolean` / `enum` / URL, plus bounds (`@Min/@Max`, `@MinLength`, allowed set).                |

> **Tests FIRST.** Before touching config, add/adjust tests that assert the behavior: the schema **rejects** a missing/malformed value (boot fails), **accepts** a valid one, the namespace exposes the coerced type, and any consumer branches correctly on it. Run them red, then make them green. See [/skills/write-unit-tests.md](./write-unit-tests.md).

---

## Steps

### 1. Name constants & enums first (no magic literals)

Defaults, bounds, and any allowed-value set are named constants/enums in dedicated files — never inline in `*.config.ts` or the schema (rules 8/13).

```ts
// shared/constants/config.constants.ts
export const DEFAULT_REQUEST_TIMEOUT_MS = 30_000 as const;
export const MIN_REQUEST_TIMEOUT_MS = 1_000 as const;
export const MAX_REQUEST_TIMEOUT_MS = 120_000 as const;

// shared/enums/upload-strategy.enum.ts  (only if the value is an enum)
export enum UploadStrategy {
  Memory = 'memory',
  Disk = 'disk',
}
```

### 2. Declare it in `.env.example` (the documented contract)

Add the variable under its concern group, with a one-line comment and required/optional + allowed values. Placeholder only — never a real credential.

```bash
# --- Integration / object storage --------------------------------------------
STORAGE_REQUEST_TIMEOUT_MS=30000        # optional, default 30000 (1000–120000)
STORAGE_UPLOAD_STRATEGY=disk            # optional: memory | disk
# A secret would look like:
# STORAGE_SIGNING_KEY=change-me-min-32-characters-long-secret   # required, ≥32 chars
```

### 3. Add it to the validated env schema (fail-fast gate)

Extend the class every boot passes through. Coerce explicitly with `@Type`; constrain with decorators. Missing/malformed ⇒ the process must not boot.

```ts
// config/env.validation.ts
class EnvironmentVariables {
  // …existing keys…

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(MIN_REQUEST_TIMEOUT_MS)
  @Max(MAX_REQUEST_TIMEOUT_MS)
  readonly STORAGE_REQUEST_TIMEOUT_MS?: number;

  @IsOptional()
  @IsEnum(UploadStrategy)
  readonly STORAGE_UPLOAD_STRATEGY?: UploadStrategy;
}
```

> Required + secret instead? Drop `@IsOptional`, add `@IsString() @MinLength(SIGNING_KEY_MIN_LENGTH)` — a weak or absent secret then fails the boot.

### 4. Expose it through a typed `registerAs` namespace

Coerce/default inside the namespace factory using the shared parse helpers in `config/` — the only code converting env strings. The factory is the **one** place these helpers run.

```ts
// config/storage.config.ts
export const storageConfig = registerAs('storage', () => ({
  requestTimeoutMs: parseIntEnv(
    'STORAGE_REQUEST_TIMEOUT_MS',
    DEFAULT_REQUEST_TIMEOUT_MS,
  ),
  uploadStrategy: parseEnumEnv(
    'STORAGE_UPLOAD_STRATEGY',
    UploadStrategy,
    UploadStrategy.Disk,
  ),
}));

export type StorageConfig = ConfigType<typeof storageConfig>;
```

### 5. Register the namespace (skip if reusing one)

A new namespace is loaded once in the root config. Existing namespaces need no change here.

```ts
// app.module.ts
ConfigModule.forRoot({
  isGlobal: true,
  cache: true,
  validate: validateEnv,
  load: [appConfig, authConfig, databaseConfig, storageConfig], // ← added
});
```

### 6. Consume it via injection — never `process.env`

Inject the namespace's typed `ConfigType`. The value is guaranteed present and correctly typed; no coercion, no `.get('KEY')` strings. Adapters take config the same way and never read env ([/rules/12-library-wrapping-and-adapters.md](../rules/12-library-wrapping-and-adapters.md)).

```ts
// DON'T — raw, untyped, ESLint error, NaN if unset.
const timeout = Number(process.env.STORAGE_REQUEST_TIMEOUT_MS);

// DO — typed namespace injection in the application / adapter layer.
@Injectable()
export class StorageAdapter {
  public constructor(
    @Inject(storageConfig.KEY)
    private readonly config: ConfigType<typeof storageConfig>,
  ) {}

  public async upload(input: UploadInput): Promise<UploadResult> {
    return this.client.put(input, { timeoutMs: this.config.requestTimeoutMs });
  }
}
```

> Service methods stay ≤20 lines and controllers stay a single delegation — config branching lives in a service/use case, never in transport ([/rules/02-controllers-and-http-transport.md](../rules/02-controllers-and-http-transport.md), [/rules/03-application-services-and-use-cases.md](../rules/03-application-services-and-use-cases.md)).

### 7. Wire per-environment values & secret source

The **code path is identical** across environments; only the value and (for secrets) the source change. Set the value wherever the app runs — local `.env`, CI fixtures, staging/prod secret manager — in the same change (rule 41).

| Concern          | Local              | CI / Test        | Staging / Prod      |
| ---------------- | ------------------ | ---------------- | ------------------- |
| Non-secret value | `.env`             | fixture          | deploy config       |
| Secret value     | `.env` placeholder | injected fixture | secret manager only |

Record the secret inventory, generation command, and rotation note in [/memory/security-decisions.md](../memory/security-decisions.md); record any intentional cross-environment drift in [/memory/project-architecture.md](../memory/project-architecture.md).

### 8. Document the change

Update the variable reference (env-vars table / module docs) and note required vs optional, default, and constraints. If the value introduces or alters behavior, update the relevant feature folder and release notes ([/docs/features/_template/](../docs/features/_template/)). Feature flags additionally need owner, default, rollout/rollback criteria, and a retirement date.

---

## Tests FIRST — what to cover

- **Schema rejects** a missing required value and a malformed value (e.g. out-of-range int, unknown enum) — boot throws.
- **Schema accepts** a valid value and a value relying on the default.
- **Namespace** returns the coerced type (number not string, enum not raw string) and applies the default when unset.
- **Consumer** uses the injected value and branches correctly (test both flag states for flags).
- **Secrets** never appear in logs or error bodies — assert redaction ([/rules/14-observability-and-logging.md](../rules/14-observability-and-logging.md)).

```ts
it('fails to boot when a required timeout is out of range', () => {
  expect(() =>
    validateEnv({ ...validEnv, STORAGE_REQUEST_TIMEOUT_MS: '50' }),
  ).toThrow(ConfigValidationError);
});

it('coerces the env string to a number with the default applied', () => {
  const cfg = storageConfig();
  expect(cfg.requestTimeoutMs).toBe(DEFAULT_REQUEST_TIMEOUT_MS);
});
```

## Quality gates (all green before "done")

```bash
npm run lint            # 0 errors AND 0 warnings (no stray process.env)
npm run typecheck       # tsgo --noEmit, project-wide
npm run test            # vitest
npm run test:coverage   # touched modules ≥ 95%
npm run build           # compiles clean
```

Never bypass hooks with `--no-verify`. A green build is not proof of correctness — boot the app once and confirm it fails on a bad value and starts on a good one.

## Pitfalls

- **Raw `process.env` in a service/adapter/controller** — lint error and untyped (`NaN`/`undefined` at runtime). Inject the namespace instead.
- **Reading via `configService.get('KEY')` strings** — typo-prone, untyped, no autocomplete. Use `@Inject(xConfig.KEY)`.
- **Defaulting a required secret or correctness value** — defaults are for operational tuning only; required must fail fast.
- **Inline coercion** (`Number(...)`, `=== 'true'`) scattered in business code — coerce once in the namespace factory.
- **Inline defaults/bounds/enums** in `*.config.ts` or the schema — extract to constants/enums files.
- **Drift** — adding the schema entry but forgetting `.env.example`, the namespace, the docs, or the per-environment value. They move together.
- **Committing or logging a secret** — `.env` stays git-ignored; the logger redacts secret-shaped fields; the exception filter sanitizes bodies.
- **Forgetting one runtime** — a new variable must be wired everywhere the app runs (local, CI, every deployed environment).
- **Long-lived feature flag** with no owner or retirement date — that is permanent complexity; default off, test both states, schedule removal.

## Related

[/rules/17-configuration-and-environment.md](../rules/17-configuration-and-environment.md) · [/rules/06-types-enums-constants.md](../rules/06-types-enums-constants.md) · [/rules/12-library-wrapping-and-adapters.md](../rules/12-library-wrapping-and-adapters.md) · [/rules/07-security-authn-authz.md](../rules/07-security-authn-authz.md) · [/rules/14-observability-and-logging.md](../rules/14-observability-and-logging.md) · [/skills/add-library-adapter.md](./add-library-adapter.md) · [/skills/write-unit-tests.md](./write-unit-tests.md) · [/skills/final-validation.md](./final-validation.md) · [/memory/security-decisions.md](../memory/security-decisions.md) · [/context/stack-and-toolchain.md](../context/stack-and-toolchain.md)
