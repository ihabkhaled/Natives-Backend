# Teams — teams, seasons, venues, reference catalogs, and versioned settings

Ultimate Natives builds every sports module on a small set of **stable, team-scoped
configuration and reference records**: the team itself, its seasons, its venues, its
configurable reference catalogs (divisions, gender formats, positions, …), and its
**effective-dated versioned settings** (attendance weights, session types, assessment
scales, badge tiers, roster limits, notification rules, report branding). This module
owns those records so downstream modules can reference **stable IDs** and a
**deterministic settings snapshot** rather than hard-coded constants.

Prompt: `103-teams-seasons-venues-configuration-and-reference-catalogs`. Builds on
100 (DB/TypeORM), 101 (identity), and 102 (RBAC + team/season scope).

## 1. Aggregates and tables

Migration `src/database/migrations/1721500000000-teams-schema.ts` (reversible; proven
from-empty in `test/database/teams.integration.spec.ts`):

- `teams` — one primary team now, team scope preserved for future
  mixed/open/women/academy structures. UUID PK, `slug` (unique, lower-cased), name,
  locale, timezone (default `Africa/Cairo`), branding (`primary_color`,
  `logo_media_key`), `status` (`active|archived`), actor audit
  (`created_by`/`updated_by`), `created_at`/`updated_at`, optimistic `version`.
- `seasons` — team-scoped; `starts_on`/`ends_on` are **date-only** columns, a
  `CHECK (ends_on >= starts_on)`, `status` (`draft|active|archived`), unique
  `(team_id, lower(slug))`. Overlap is enforced in the application layer.
- `venues` — team-scoped; optional address and `numeric(9,6)` coordinates
  (**null-not-zero**: an absent coordinate stays null), unique `(team_id, lower(name))`.
- `reference_catalog_entries` — configurable catalogs discriminated by `catalog`
  (`division|gender_format|position`, extend `CatalogName`). Unique
  `(team_id, catalog, key)`, `sort_order`, jsonb `metadata`, a `reference_count`
  guarding deletion-while-in-use, and archive (never delete).
- `team_setting_versions` — append-only, effective-dated settings. Unique
  `(team_id, setting_key, effective_from)`, jsonb `value`. Rows are **immutable**;
  changing a setting means writing a new version at a later `effective_from`.

## 2. Catalog ownership (archive, never delete)

Historical reference values must remain interpretable after config changes, so catalog
entries are **archived, never hard-deleted** (`DELETE` on the API archives). An entry
that is still referenced downstream (`reference_count > 0`) **cannot be archived** —
`ArchiveCatalogEntryUseCase` raises `CatalogEntryInUseError` (409, messageKey
`errors.teams.catalogEntryInUse`). The pure guard is
`domain/catalog-entry.policy.ts#isCatalogEntryReferenced`.

Adding a new catalog: add a member to `CatalogName` (`model/teams.enums.ts`) — entries
themselves are managed at runtime via `POST /teams/:teamId/catalog-entries`.

## 3. Settings versioning and the effective snapshot

Every displayed total in downstream modules is a projection from source records plus a
**named, versioned rule** — never an editable stored total. This module supplies the
versioned rule inputs:

- Write a version with `POST /teams/:teamId/settings/versions` (`settingKey`,
  `effectiveFrom`, `value`, optional `note`). Versions are effective-unique; a second
  version at the same instant for the same key raises `SettingVersionConflictError`.
- Read the **deterministic effective snapshot** with
  `GET /teams/:teamId/settings/snapshot?asOf=<instant>` (defaults to now). The repo
  resolves the single in-effect version per key with one bounded `DISTINCT ON` query
  as-of the instant; `domain/effective-settings.policy.ts#buildSettingsSnapshot`
  assembles one entry per known `SettingKey` in a stable order. A key with no in-effect
  version resolves to a **null** value (null-not-zero: "not configured" is explicit).

Adding a new setting: add a member to `SettingKey` (`model/teams.enums.ts`); it appears
in every snapshot automatically (null until a version is written).

## 4. Concurrency, scope, and audit

- **Optimistic concurrency**: `PATCH` on teams/seasons/venues requires
  `expectedVersion`; the guarded `UPDATE ... WHERE version = $expected` returns no row on
  a stale version → `OptimisticConflictError` (409, `errors.teams.versionConflict`).
- **Team/season scope**: nested routes carry `:teamId`, which the global
  `PermissionsGuard` uses to resolve scoped permissions. A scoped team admin manages only
  their own team; a cross-team request is denied at the guard (403). Defense-in-depth:
  repositories scope every child lookup by `team_id`, so a season/venue/entry belonging
  to another team resolves to **404** (hiding cross-team existence).
- **Season overlap**: `CreateSeasonUseCase`/`UpdateSeasonUseCase` reject a date range
  overlapping any non-archived season (excluding itself on update) →
  `SeasonOverlapError` (409). The pure rule is
  `domain/season-schedule.policy.ts#findOverlappingSeason`.
- **Audit**: every create/update/archive appends an immutable row to the shared
  `security_events` log in the same transaction as the change
  (`infrastructure/team-audit.repository.ts`).

## 5. Permissions

Reads use `team.read` (broadly granted). Writes use `team.settings.manage` (teams,
catalogs, settings), `season.manage` (seasons), `venue.manage` (venues); settings reads
use `team.settings.read`. Creating a team has no prior scope, so only a system admin
(who holds `team.settings.manage` globally via the account-role baseline) passes.

## 6. Endpoints

Base `/api/v1/teams` (controllers under `api/`, one delegation per route):

- Teams: `POST /`, `GET /`, `GET /:teamId`, `PATCH /:teamId`, `DELETE /:teamId`.
- Seasons: `POST|GET /:teamId/seasons`, `PATCH|DELETE /:teamId/seasons/:seasonId`.
- Venues: `POST|GET /:teamId/venues`, `PATCH|DELETE /:teamId/venues/:venueId`.
- Catalogs: `POST|GET /:teamId/catalog-entries` (list filters by `?catalog=`),
  `DELETE /:teamId/catalog-entries/:entryId`.
- Settings: `POST|GET /:teamId/settings/versions` (`?settingKey=`),
  `GET /:teamId/settings/snapshot` (`?asOf=`).

All lists are bounded, paginated (`?limit`/`?offset`), and deterministically ordered.

## 7. Deferred (documented)

- Database-level `EXCLUDE` constraint for season-date overlap (needs `btree_gist`);
  overlap is enforced and tested in the application layer.
- Team/season composite foreign keys into downstream modules that do not yet exist.
- `reference_count` is maintained by future referencing modules; this module reads it to
  block archiving and exposes it on the entry.
