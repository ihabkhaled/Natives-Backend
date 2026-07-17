# 17 — Configuration & Environment

> All configuration is typed, validated at startup, and read through `@nestjs/config` — never `process.env` outside `config/` and `bootstrap/`. The env schema fails fast on anything missing or malformed, secrets come from a secret manager (never the repo, never the logs), and feature flags have owners and a retirement date. This implements rules **27**, **29**, and **40** of [00-non-negotiable-rules.md](./00-non-negotiable-rules.md).

Configuration is an input contract, not a grab bag. A misconfigured process must refuse to boot — loudly — rather than fail later in a request with a confusing error.

---

## The one boundary that matters

`process.env` is raw, untyped, globally mutable, and stringly-typed. It is the I/O edge of configuration and must stay at the edge.

| Layer                                                                                         | May touch `process.env`? | What it does instead                                           |
| --------------------------------------------------------------------------------------------- | ------------------------ | -------------------------------------------------------------- |
| `config/`                                                                                     | **Yes** — the only place | Reads, parses, validates, and exposes typed config namespaces  |
| `bootstrap/`                                                                                  | **Yes** — startup only   | Reads `NODE_ENV`/`PORT` to wire the app before DI is available |
| Controllers, services, use cases, repositories, domain, adapters, guards, pipes, interceptors | **No**                   | Inject the typed config namespace                              |

`architecture/no-restricted-layer-imports` makes this mechanical: any `process.env` access outside `config/` or `bootstrap/` is a lint **error**, and `npm run lint` must be 0 errors / 0 warnings (rule 2).

```ts
// DON'T — raw env read buried in a service: untyped, unvalidated, ESLint error.
@Injectable()
export class InvoiceService {
  private readonly maxRetries = Number(process.env.INVOICE_MAX_RETRIES); // NaN if unset
}

// DO — inject a typed, validated namespace; the value can never be NaN/undefined here.
@Injectable()
export class InvoiceService {
  constructor(
    @Inject(invoiceConfig.KEY)
    private readonly config: ConfigType<typeof invoiceConfig>,
  ) {}
  // this.config.maxRetries is a guaranteed positive integer
}
```

---

## Validate at startup, fail fast (rule 29)

The process must **not** boot with invalid or missing configuration. Validation runs once, before the app listens, and an invalid value throws and exits non-zero — surfaced by the orchestrator's health/crash loop, never swallowed.

`@nestjs/config` runs a `validate` function (or `validationSchema`) over `process.env` at module init. Use the project's primary validator (class-validator + class-transformer per [05-dto-and-validation.md](./05-dto-and-validation.md)); a schema validator is the documented alternative. Either way, validation is **strict**: unknown-but-required keys missing ⇒ fail; malformed values ⇒ fail; type coercion is explicit, not implicit.

```ts
// config/env.validation.ts — the gate every boot passes through.
class EnvironmentVariables {
  @IsEnum(NodeEnv) declare readonly NODE_ENV: NodeEnv; // enum from @shared/enums
  @IsInt()
  @Min(1)
  @Max(65535)
  @Type(() => Number)
  declare readonly PORT: number;
  @IsString()
  @MinLength(JWT_SECRET_MIN_LENGTH)
  declare readonly JWT_SECRET: string;
  @IsEnum(LogLevel) declare readonly LOG_LEVEL: LogLevel;
  @IsBoolean() @Transform(toBool) declare readonly ENABLE_OPENAPI_DOCS: boolean;
}

export function validateEnv(
  raw: Record<string, unknown>,
): EnvironmentVariables {
  const parsed = plainToInstance(EnvironmentVariables, raw, {
    enableImplicitConversion: false,
  });
  const errors = validateSync(parsed, {
    whitelist: true,
    forbidUnknownValues: true,
  });
  if (errors.length > 0) throw new ConfigValidationError(errors); // fail fast, exit non-zero
  return parsed;
}
```

```ts
// app.module.ts
ConfigModule.forRoot({
  isGlobal: true,
  cache: true, // env is read once; no per-request env access
  validate: validateEnv, // ← the hard gate
  load: [appConfig, authConfig, dbConfig, mailerConfig, featureFlagsConfig],
});
```

Validation rules to honor:

- **Required is required.** No silent fallback for a value the app genuinely needs (secrets, DB URL). Defaults are for _operational tuning_ (timeouts, page sizes), not for security or correctness.
- **Coerce explicitly.** Env is always strings; convert to `number`/`boolean`/`enum` in the schema, never with `Number(...)`/`=== 'true'` scattered in business code.
- **Constrain.** `@Min/@Max`, `@MinLength`, `@IsUrl`, `@IsEnum`, allowed-value sets — a port of `0` or a 4-char secret must not boot.
- **No magic literals.** Bounds and minimums (`JWT_SECRET_MIN_LENGTH`, `MAX_PORT`) are named constants per rules 8/13, not inline numbers.
- **Every consumed key is validated.** A namespace may not read an env variable that the startup schema does not type and constrain.
- **Every documented key is consumed.** Remove unused `.env.example` entries, config types, parsers, defaults, and docs as one surface; do not advertise speculative values ([27-no-token-burning-code.md](./27-no-token-burning-code.md)).
- Config namespaces, keys, and policy maps have a dedicated `config/*.constants.ts` / `config/*.types.ts` / validation DTO owner; consumers do not repeat string keys or anonymous maps ([30-declaration-ownership.md](./30-declaration-ownership.md)).

---

## Namespaces & injection

Group related settings into `registerAs` **namespaces**, one per concern. Inject the namespace's typed `ConfigType`; never inject the global `ConfigService` into business code and call `.get('SOME_KEY')` with a string.

```ts
// config/auth.config.ts
export const authConfig = registerAs('auth', () => ({
  jwtSecret: requireString('JWT_SECRET'),
  accessTtlSeconds: parseIntEnv(
    'JWT_ACCESS_TTL_SECONDS',
    DEFAULT_ACCESS_TTL_SECONDS,
  ),
  refreshTtlSeconds: parseIntEnv(
    'JWT_REFRESH_TTL_SECONDS',
    DEFAULT_REFRESH_TTL_SECONDS,
  ),
}));
export type AuthConfig = ConfigType<typeof authConfig>;
```

```ts
// DON'T — stringly-typed lookup; typo-prone, untyped return, no autocomplete.
this.configService.get<string>('JWT_SECRET');

// DO — namespaced, fully typed, autocomplete + compile-time safety.
constructor(@Inject(authConfig.KEY) private readonly auth: ConfigType<typeof authConfig>) {}
this.auth.jwtSecret;
```

Rules:

- One namespace per concern (`app`, `auth`, `database`, `mailer`, `cache`, `featureFlags`, …). Adapters take their settings from a namespace (see [12-library-wrapping-and-adapters.md](./12-library-wrapping-and-adapters.md)); they never read env.
- The parse/coerce helpers (`requireString`, `parseIntEnv`, `toBool`) live in `config/` and are the _only_ code converting env strings.
- Config value **types and constants** (TTL defaults, min lengths, enums like `NodeEnv`/`LogLevel`) live in dedicated files per [06-types-enums-constants.md](./06-types-enums-constants.md) — no inline declarations in `*.config.ts` beyond the `registerAs` factory.

---

## Secrets — managed, never committed, never logged

| Rule                                                                                                                                                          | Why                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| **Never commit secrets.** `.env` is git-ignored; only `.env.example` (placeholders) is tracked.                                                               | A leaked repo must not leak credentials.                             |
| **Source secrets from a secret manager** in non-local environments (a cloud secret store, a vault, or orchestrator-injected secrets).                         | Rotation, audit, and least-privilege live there, not in a text file. |
| **Inject at runtime**, into the process environment or a mounted file the config layer reads — the app code is identical to env-based config.                 | Same typed-config code path; the _source_ changes per environment.   |
| **Never log a secret.** The logger adapter redacts secret/token/password/key fields ([14-observability-and-logging.md](./14-observability-and-logging.md)).   | Logs, traces, and error bodies are low-trust sinks.                  |
| **Never echo a secret in an error** the client can see. The exception filter returns sanitized bodies (rule 36).                                              | Stack/SQL/secret leakage is a security incident.                     |
| **Enforce minimum strength** in the env schema (e.g. signing secret ≥ a named min length).                                                                    | A weak secret that boots is a vulnerability.                         |
| **Plan rotation.** Document how each secret is generated, rotated, and what invalidates on change (e.g. rotating the signing secret invalidates live tokens). | Rotation without a runbook causes outages.                           |

```ts
// DON'T — secret in a log line or in a client-visible error message.
this.logger.info('connecting', { databaseUrl: this.db.url }); // URL embeds the password
throw new BadRequestException(`bad token ${this.auth.jwtSecret}`); // leaks the secret

// DO — log non-secret context only; throw a typed AppError with a messageKey.
this.logger.info('db.connecting', { host: this.db.host }); // no credentials
throw new UnauthorizedError('errors.auth.invalid_token'); // sanitized by the filter
```

Record the secret inventory, generation commands, and rotation procedure in [/memory/security-decisions.md](../memory/security-decisions.md) and the relevant runbook — not in this file and not in code comments.

---

## Feature flags & operational toggles

A flag is config with a lifecycle. Every flag has an **owner**, a **default state**, **rollout criteria**, **rollback criteria**, and a **retirement date**. A flag with no removal plan is permanent complexity.

```ts
// config/feature-flags.config.ts — typed, defaulted-off, named keys (no magic strings).
export const featureFlagsConfig = registerAs('featureFlags', () => ({
  enableNewInvoiceFlow: toBool(
    process.env.FF_NEW_INVOICE_FLOW,
    DEFAULT_FLAG_OFF,
  ),
  enableBetaSearch: toBool(process.env.FF_BETA_SEARCH, DEFAULT_FLAG_OFF),
}));
```

```ts
// DO — branch on the typed flag in the application layer; keep controllers thin.
if (this.flags.enableNewInvoiceFlow) {
  return this.newInvoiceUseCase.execute(input);
}
return this.legacyInvoiceUseCase.execute(input);
```

- **Default safe (off).** New behavior ships disabled and is enabled deliberately.
- **No flag checks in controllers.** Branch in a service/use case; the transport layer stays a single delegation ([02-controllers-and-http-transport.md](./02-controllers-and-http-transport.md)).
- **Test both states.** A flagged path needs coverage on and off ([11-testing-and-coverage.md](./11-testing-and-coverage.md)); dead branches behind a long-lived flag are a smell.
- **Retire on schedule.** When a flag is fully rolled out, delete the flag, the config key, the `.env.example` line, and the dead branch in the same change.

Track flags (owner, default, retirement) in [/memory/event-notification-decisions.md](../memory/event-notification-decisions.md) or a dedicated flags register; reference the request ID that introduced each one.

---

## `.env.example` discipline

`.env.example` is the documented contract of every variable the app reads. It is tracked; the real `.env` is not.

- **Every** variable validated in `config/` appears in `.env.example` — same name, grouped by concern, with a one-line comment and allowed values.
- **Placeholders only.** Use safe non-secret defaults or `change-me-…` markers; never a real credential.
- **Keep it in sync.** Adding/removing/renaming a config value updates the env schema, the namespace, `.env.example`, and the docs in the **same change** (rule 42). A drifted example is a setup trap.
- **Mark required vs optional and defaulted** so a new engineer can boot in one pass.

```bash
# --- Security / Auth ---------------------------------------------------------
JWT_SECRET=change-me-min-32-characters-long-secret   # required, ≥32 chars
JWT_ACCESS_TTL_SECONDS=900                            # optional, default 900
# --- Feature flags -----------------------------------------------------------
FF_NEW_INVOICE_FLOW=false                             # owner: payments; retire: <date>
```

See the repo root [`.env.example`](../.env.example) for the live template.

---

## Per-environment differences, made explicit

Environments differ intentionally — never by accident. The **code path is identical** across environments; only values (and the secret _source_) change.

| Concern                | Local           | Test / CI         | Staging        | Production     |
| ---------------------- | --------------- | ----------------- | -------------- | -------------- |
| Secret source          | `.env` file     | injected fixtures | secret manager | secret manager |
| OpenAPI docs flag      | on              | off               | on (gated)     | off / gated    |
| Log level              | `debug`         | `warn`            | `info`         | `info`         |
| External adapters      | sandbox / fakes | mocks             | sandbox        | live           |
| List limits / timeouts | relaxed         | minimal           | prod-like      | prod-tuned     |

- **No environment-conditional business logic.** Behavior must not silently change because `NODE_ENV === 'production'`; gate behavior through explicit, named flags/config, not ambient environment checks.
- **One schema, all environments.** The same `validateEnv` runs everywhere; missing prod secrets must fail the prod boot, not be defaulted to a dev value.
- **Document drift.** Any intentional cross-environment difference is recorded in [/memory/project-architecture.md](../memory/project-architecture.md) (or the deployment runbook) with its rationale — hidden drift is a release risk.
- **New runtime dependency ⇒ new config wiring** everywhere it runs, in the same change (rule 41): schema, namespace, `.env.example`, and per-environment values.

---

## Checklist

- [ ] No `process.env` outside `config/` / `bootstrap/` — ESLint green (rules 2, 27).
- [ ] Every variable is declared in the env schema, typed, constrained, and **validated at startup** (rule 29).
- [ ] Required values fail fast; defaults exist only for operational tuning, never secrets/correctness.
- [ ] Settings exposed as `registerAs` namespaces and injected as typed `ConfigType` — no stringly-typed `.get('KEY')` in business code.
- [ ] Config types/constants/enums live in dedicated files — no inline declarations in `*.config.ts` (rules 10–16).
- [ ] Secrets sourced from a secret manager outside local; never committed, never logged, never in client-facing errors (rules 36, 28).
- [ ] Secret minimum-strength enforced in the schema; rotation procedure documented in memory/runbooks.
- [ ] Feature flags default off, have owner + rollout/rollback criteria + retirement date, are tested in both states, and are branched in the application layer.
- [ ] `.env.example` lists every variable with placeholder + comment + required/optional, in sync with the schema (rule 42).
- [ ] Per-environment differences are value/source-only and documented; no environment-conditional business logic.
- [ ] Adapters take config via injected namespaces, not env (rules/12).
- [ ] Gates green: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run test:coverage`, `npm run build`.

**Related:** [00-non-negotiable-rules.md](./00-non-negotiable-rules.md) · [07-security-authn-authz.md](./07-security-authn-authz.md) · [12-library-wrapping-and-adapters.md](./12-library-wrapping-and-adapters.md) · [14-observability-and-logging.md](./14-observability-and-logging.md) · [18-error-handling-and-exceptions.md](./18-error-handling-and-exceptions.md) · [19-async-events-and-jobs.md](./19-async-events-and-jobs.md) · [/skills/add-config-value.md](../skills/add-config-value.md) · [/context/stack-and-toolchain.md](../context/stack-and-toolchain.md) · [/memory/security-decisions.md](../memory/security-decisions.md)
