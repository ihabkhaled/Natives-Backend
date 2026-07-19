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

| Env var                      | Default            | Notes                                             |
| ---------------------------- | ------------------ | ------------------------------------------------- |
| `DATABASE_URL`               | _(unset)_          | Preferred. Overrides the discrete fields below.   |
| `DB_HOST`                    | `localhost`        | Discrete connection host.                         |
| `DB_PORT`                    | `5432`             | 1–65535.                                          |
| `DB_USERNAME`                | `postgres`         | Discrete connection user.                         |
| `DB_PASSWORD`                | _(unset)_          | Never logged.                                     |
| `DB_NAME`                    | `ultimate_natives` | Discrete database name.                           |
| `DB_POOL_MIN`                | `2`                | 0–100. Must be `<= DB_POOL_MAX`.                  |
| `DB_POOL_MAX`                | `10`               | 0–100.                                            |
| `DB_CONNECT_TIMEOUT_MS`      | `10000`            | 1–120000.                                         |
| `DB_STATEMENT_TIMEOUT_MS`    | `15000`            | 1–120000. Bounds every statement.                 |
| `DB_SSL`                     | `false`            | Boolean flag. **Must be `true` in production.**   |
| `DB_LOGGING`                 | `false`            | Boolean flag. Verbose SQL — local debugging only. |
| `DB_MIGRATIONS_RUN_ON_START` | `true`             | Apply pending migrations on boot (see lifecycle). |
| `DB_SEED_ON_START`           | `true`             | Run the once-only seed framework on boot.         |

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
- Normal app startup never checks for or creates the configured database. The
  runtime role therefore needs privileges only inside the application database,
  not PostgreSQL `CREATEDB`.
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
- `1722200000000-practice-reminders-calendar-schema.ts` adds digest-only,
  revocable calendar credentials and self-owned notification quiet hours.
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

## Boot lifecycle (migrations + once-only seeding)

`DatabaseLifecycleService` (in `src/database`) runs once at startup — after config
is validated and the `DataSource` is built, but **before the server binds a
port** — wired from `src/bootstrap/bootstrap.ts`. It never runs during the
DB-less boot smoke test or the DB-gated e2e suites (those assemble the app
directly); the lifecycle is invoked only by the real long-running entrypoint.

1. **Advisory lock.** The whole lifecycle runs while holding a fixed Postgres
   session advisory lock (`pg_advisory_lock`). Concurrent instances and
   serverless cold starts **block** on the same key instead of racing, so a
   pending migration or first-run seed can never double-run. The lock is always
   released and its connection returned, even on failure.
2. **Migrations on start** (`DB_MIGRATIONS_RUN_ON_START`, default `true`). Every
   pending migration is applied in order, one at a time, logging each migration's
   name and duration (never credentials). **A migration failure aborts the
   boot** (the process exits) — traffic is never served on a wrong schema. When
   the flag is off, that is logged and the schema is expected to be applied by an
   external step.
3. **Once-only seeding** (`DB_SEED_ON_START`, default `true`). The seed framework
   applies only the seeders whose key is absent from the `seed_history` table,
   inserting the history row **in the same transaction** as the seeder. A
   first-time fresh database therefore seeds exactly once; every later boot finds
   the row and **skips** — nothing is ever re-seeded. If a seeder's
   content-derived `checksum` differs from the recorded one, the framework logs
   an auditable warning and does **not** re-run it (no hidden mutation). The
   runtime admin credential (`SEED_ADMIN_PASSWORD`) is read lazily, only when a
   seeder actually runs — i.e. only on a fresh database.

`seed_history` columns: `id` (uuid), `seed_key` (unique), `checksum`,
`applied_at` (timestamptz UTC), `applied_by` (`boot` or `cli`). The framework is
exercised end-to-end (empty boot applies all migrations + seeds; a second run
applies nothing; two concurrent instances → exactly one migrates) in
`test/database/lifecycle.integration.spec.ts`.

The existing admin seed is folded into this framework: `npm run seed:admin` runs
through the same once-only registry, so re-running it after the first application
is a clean no-op.

## Local vs test safety

- **Local dev:** `docker compose up -d` (`docker-compose.yml`) — Postgres 16,
  healthcheck, non-production credentials, bound to `127.0.0.1:5432`.
- **Explicit first-time setup:** set a runtime-only `SEED_ADMIN_PASSWORD`, then
  run `npm run db:setup`. This executes `db:ensure` (maintenance connection and
  database creation if missing), migrations, then the idempotent admin seed.
  `db:ensure` fails non-zero if the maintenance role cannot create the missing
  database; it is never invoked by `start`, `start:dev`, or `start:prod`.
- **Existing database:** use `npm run migration:run` and `npm run seed:admin`
  separately when creation is managed by infrastructure and the app/operator
  role intentionally lacks `CREATEDB`.
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
- Provision the database through approved infrastructure or an explicit
  privileged deployment step. Do not grant the normal application role
  `CREATEDB`, and do not run the local admin seed implicitly at application boot.
- Size `DB_POOL_MAX` to the database's connection budget; keep
  `DB_STATEMENT_TIMEOUT_MS` tight to protect against runaway queries.
- Run migrations as a deploy step (`npm run migration:run`); the app never
  auto-synchronizes.
- **Serverless (e.g. Vercel).** Boot-time migrations are safe there (the advisory
  lock serializes cold starts), but you may prefer to apply the schema out of
  band: set `DB_MIGRATIONS_RUN_ON_START=false` (and, if desired,
  `DB_SEED_ON_START=false`) and run `npm run db:setup` (`db:ensure` +
  `migration:run` + `seed:admin`) — or the build-time bootstrap — as an explicit
  deploy step instead. The seed framework stays once-only regardless of which
  path applies it.

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
