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
  `logo_media_key`), `status` (`active|disabled|archived`), `deleted_at` (soft
  removal), actor audit
  (`created_by`/`updated_by`), `created_at`/`updated_at`, optimistic `version`.
- `seasons` — team-scoped; `starts_on`/`ends_on` are **date-only** columns, a
  `CHECK (ends_on >= starts_on)`, `status` (`draft|active|closed|archived`), unique
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

## 5. Permissions — platform scope vs team scope

Reads use `team.read` (broadly granted). Team-scoped writes use
`team.settings.manage` (teams, catalogs, settings), `season.manage` (seasons),
`venue.manage` (venues); settings reads use `team.settings.read`.

Three routes are **platform-scoped** and carry no `:teamId`, so only a _global_
(`team_id IS NULL`) grant can satisfy them — which no team-scoped bundle carries:

| Route                        | Permission        |
| ---------------------------- | ----------------- |
| `POST /teams`                | `team.create`     |
| `GET /teams` (browse all)    | `team.browse.all` |
| `POST /teams/:teamId/remove` | `platform.admin`  |

Only the `SUPER_ADMIN` bundle (and the `admin` account-role baseline) holds them,
so a `TEAM_ADMIN` scoped to one team gets `403 errors.auth.permissionDenied` on
all three. Team administrators find their own teams through `GET /teams/mine`.

## 6. Lifecycle

**Teams** (`domain/team-lifecycle.state-machine.ts`): `active ⇄ disabled`,
`active|disabled → archived`, `archived → active`. Soft removal (`deleted_at`) is
a separate, terminal step permitted **only** from `archived`, so an operating
team can never be removed by one call. Nothing is ever hard-deleted: removed
teams disappear from every read while every historical row stays referentially
valid. An invalid move is `409 errors.teams.teamInvalidTransition`; a stale
`expectedVersion` is `409 errors.teams.versionConflict`.

**Seasons** (`domain/season-lifecycle.state-machine.ts`): `draft → active`,
`active → closed`, `closed → active`, anything → `archived`, `archived → draft`.
At most one season per team may be `active` — enforced by the partial unique
index `ux_seasons_one_active_per_team` and pre-checked so callers get a typed
`409 errors.teams.seasonAlreadyActive` instead of a driver error. That invariant
is what makes `GET /teams/:teamId/seasons/current` deterministic (and
`404 errors.teams.currentSeasonNotFound` when there is none — never a guess),
which the leaderboard's `period=season` depends on.

Every transition is state-machine gated, optimistic-version guarded (when an
`expectedVersion` is supplied) and audited in the same transaction.

## 7. Endpoints

Base `/api/v1/teams` (controllers under `api/`, one delegation per route):

- Teams: `POST /`, `GET /`, `GET /mine`, `GET /:teamId`, `PATCH /:teamId`,
  `POST /:teamId/activate`, `POST /:teamId/deactivate`, `POST /:teamId/archive`,
  `POST /:teamId/remove`, `DELETE /:teamId` (archive alias).
- Seasons: `POST|GET /:teamId/seasons`, `GET /:teamId/seasons/current`,
  `PATCH|DELETE /:teamId/seasons/:seasonId`,
  `POST /:teamId/seasons/:seasonId/{activate,close,archive}`.
- Venues: `POST|GET /:teamId/venues`, `PATCH|DELETE /:teamId/venues/:venueId`.
- Catalogs: `POST|GET /:teamId/catalog-entries` (list filters by `?catalog=`),
  `DELETE /:teamId/catalog-entries/:entryId`.
- Settings: `POST|GET /:teamId/settings/versions` (`?settingKey=`),
  `GET /:teamId/settings/snapshot` (`?asOf=`).

All lists are bounded, paginated (`?limit`/`?offset`), and deterministically ordered.

## 8. Deferred (documented)

- Database-level `EXCLUDE` constraint for season-date overlap (needs `btree_gist`);
  overlap is enforced and tested in the application layer.
- Team/season composite foreign keys into downstream modules that do not yet exist.
- `reference_count` is maintained by future referencing modules; this module reads it to
  block archiving and exposes it on the entry.
