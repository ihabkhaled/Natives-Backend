# Database Architecture (PostgreSQL + TypeORM)

Ultimate Natives persists to **PostgreSQL** through **TypeORM**, added on top of
the strict IronNest template **without weakening any boundary**. This document
is the reference for connection/pool/timeout/SSL configuration, migrations,
local vs test safety, production connection guidance, and the data conventions
every entity must follow.

## Ownership & boundaries

- **TypeORM is imported only inside `src/database/**`** (and, per the package
  boundary, `infrastructure`/`repositories`/adapter folders when entities land).
  Application, domain, service, and use-case code contain **zero** TypeORM types.
  This is enforced by `eslint/package-boundaries.config.mjs` and by
  `test/architecture/typeorm-boundary.spec.ts`.
- Application code depends on **app-owned, vendor-free ports**:
  - `@core/persistence/unit-of-work.port.ts` — `UnitOfWorkPort` +
    `TransactionScope`. Use cases call `runInTransaction(...)`; they never touch
    a `DataSource` or `EntityManager`.
  - `@core/persistence/database-readiness.port.ts` — `DatabaseReadinessPort`,
    used by `core/health` so readiness works without importing TypeORM.
- `src/database/` owns the implementations: the `DataSource` provider, the
  TypeORM unit-of-work adapter, the readiness adapter, the naming strategy, the
  migration CLI DataSource, and the test-database helpers.

## Configuration (typed, fail-fast)

All database env vars are read **only** in `src/config/database.config.ts`
(`registerAs('database')`) and exposed as `DatabaseConfig` via
`AppConfigService.database`. Nothing else reads `process.env` for the database.

| Env var                   | Default            | Notes                                             |
| ------------------------- | ------------------ | ------------------------------------------------- |
| `DATABASE_URL`            | _(unset)_          | Preferred. Overrides the discrete fields below.   |
| `DB_HOST`                 | `localhost`        | Discrete connection host.                         |
| `DB_PORT`                 | `5432`             | 1–65535.                                          |
| `DB_USERNAME`             | `postgres`         | Discrete connection user.                         |
| `DB_PASSWORD`             | _(unset)_          | Never logged.                                     |
| `DB_NAME`                 | `ultimate_natives` | Discrete database name.                           |
| `DB_POOL_MIN`             | `2`                | 0–100. Must be `<= DB_POOL_MAX`.                  |
| `DB_POOL_MAX`             | `10`               | 0–100.                                            |
| `DB_CONNECT_TIMEOUT_MS`   | `10000`            | 1–120000.                                         |
| `DB_STATEMENT_TIMEOUT_MS` | `15000`            | 1–120000. Bounds every statement.                 |
| `DB_SSL`                  | `false`            | Boolean flag. **Must be `true` in production.**   |
| `DB_LOGGING`              | `false`            | Boolean flag. Verbose SQL — local debugging only. |

**Fail-fast cross-field validation** (in `env.validation.ts`, throws at startup):

- `DB_POOL_MIN <= DB_POOL_MAX`.
- In `production`, `DB_SSL` must be `true` (an unencrypted production database
  connection is refused).

## Connection lifecycle

- The `DATA_SOURCE` provider builds options from `DatabaseConfig` and calls
  `initialize()`. **Startup is resilient**: if the database is unreachable the
  failure is logged (host + database name only — never credentials) and the
  process still boots, so **liveness** stays up while **readiness** reports
  not-ready. `synchronize` is hard-coded `false` — always.
- `DatabaseModule` (global) closes the connection on `onApplicationShutdown`.
- Pool bounds, connect timeout, and `statement_timeout` are passed through to
  node-postgres so queries stay bounded.

## Liveness vs readiness

- **Liveness** — `GET /api/v1/health` (unchanged): the process is up.
- **Readiness** — `GET /api/v1/health/ready`: pings the database through
  `DatabaseReadinessPort`. Returns `{ status: "ready", database: "up" }` when
  reachable; otherwise raises a **safe 503** (`errors.health.databaseUnavailable`)
  with no driver internals.

## Migrations

- **`synchronize: false` always** (outside disposable tests). Schema changes ship
  as migrations in `src/database/migrations/` with deterministic, timestamped
  filenames (`<timestamp>-<name>.ts`, class `Name<timestamp>`).
- The baseline migration (`1721200000000-baseline-schema.ts`) enables `pgcrypto`
  (for `gen_random_uuid()`), is fully reversible, and adds no tables (no entities
  yet). Feature migrations build on top of it.
- CLI (uses the same typed config via `src/database/cli-data-source.ts`):

  ```bash
  npm run migration:generate   # generate from entity diffs into src/database/migrations
  npm run migration:run        # apply pending migrations
  npm run migration:revert     # revert the last migration
  npm run migration:show       # list applied/pending
  ```

  Set `DATABASE_URL` (or the `DB_*` vars) in your shell first; the CLI targets
  exactly what the runtime would.

- Rules: prove **migrate-from-empty**; expand/contract; never a destructive down
  that discards production data; record checksums; forward-fix in production.
  The migrate-from-empty and reversible-rollback behavior is proven in
  `test/database/database.integration.spec.ts`.

## Local vs test safety

- **Local dev:** `docker compose up -d` (`docker-compose.yml`) — Postgres 16,
  healthcheck, non-production credentials, bound to `127.0.0.1:5432`.
- **Integration tests:** `docker compose -f docker-compose.test.yml up -d` —
  Postgres 16 on `127.0.0.1:55432`, database `natives_test`, tmpfs-backed and
  disposable.
- **Hard safeguard:** `assertTestDatabase()` / `createTestDataSource()` refuse to
  run unless `NODE_ENV=test` **and** the target database name ends with `_test`,
  so destructive test helpers can never touch a dev/prod database.
- The integration suite **skips with a clear message** when Postgres is
  unreachable and runs automatically when it is up.

## Production connection guidance

- Supply `DATABASE_URL` (or `DB_*`) and secrets from a secret manager — never
  from committed files. `DB_SSL=true` is mandatory in production.
- Size `DB_POOL_MAX` to the database's connection budget; keep
  `DB_STATEMENT_TIMEOUT_MS` tight to protect against runaway queries.
- Run migrations as a deploy step (`npm run migration:run`); the app never
  auto-synchronizes.

## Data conventions (for every future entity)

- **UUID primary keys** (`gen_random_uuid()` via `pgcrypto`).
- **`timestamptz`, UTC everywhere.** Store instants in UTC; present in
  Africa/Cairo at the edge. Date-only values use `date` (`YYYY-MM-DD`).
- **Naming:** snake_case tables/columns via `SnakeCaseNamingStrategy`.
- **Audit columns:** `created_at`, `updated_at`, optional `deleted_at`, plus
  actor/source columns on mutated aggregates.
- **Soft delete** (`deleted_at`) for privileged records; soft-deleted rows stay
  referentially valid. Use partial unique indexes where soft-delete interacts
  with natural-key uniqueness.
- **Optimistic version** columns on high-conflict aggregates.
- **Null-not-zero:** `NULL` means "not assessed/measured" — never coerced to 0.
- **Bounded queries only:** every list is paginated, deterministically ordered,
  and indexed; ledgers are append-only (reversals are new rows); published/
  finalized records are immutable without an explicit revision.

## Dependency justification

See `docs/dependencies/typeorm-and-pg.md`.
