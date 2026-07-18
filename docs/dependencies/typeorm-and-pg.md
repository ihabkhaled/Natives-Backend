# Dependency Justification — `typeorm` + `pg`

Prompt 100 (PostgreSQL + TypeORM infrastructure) requires production-grade
PostgreSQL persistence. Two runtime dependencies were added, pinned to exact
versions.

| Package   | Version  | Type    | Why                                                                |
| --------- | -------- | ------- | ------------------------------------------------------------------ |
| `typeorm` | `1.1.0`  | runtime | The ORM/data-mapper: DataSource, migrations, query runner, naming. |
| `pg`      | `8.22.0` | runtime | node-postgres driver TypeORM uses to talk to PostgreSQL.           |

## Compatibility

- `typeorm@1.1.0` engines: `node ^20.19.0 || ^22.13.0 || >=24.11.0` — satisfied
  by the repo's Node 24 requirement.
- `typeorm` declares `pg` as a peer (`^8.5.1`); `pg@8.22.0` satisfies it.
- `ts-node@^10.9.2` and `tsconfig-paths@^4.2.0` (already dev dependencies) power
  the migration CLI scripts; no new dev dependencies were required.
- `npm install` reported **0 vulnerabilities**; `security:audit` and
  `security:scan` remain green.

## Exact pinning

Both are pinned to exact versions (no `^`) so the schema/driver behavior is
reproducible across environments and CI. Upgrades are deliberate, reviewed
changes.

## Install scripts

Neither `typeorm` nor `pg` requires a post-install build script, so
`package.json` `allowScripts` is unchanged (kept minimal). `pg` is pure
JavaScript; `pg-native` is **not** installed.

## Boundary

TypeORM/pg are confined to `src/database/**` by the package-boundary ESLint rule
and an architecture test. Application/domain/use-case/service code depends only
on the vendor-free `UnitOfWorkPort` and `DatabaseReadinessPort`, so the ORM can
be swapped by touching one folder.
