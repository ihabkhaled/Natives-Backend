import type { ErrorMessageKey } from '@core/errors/error.types';

// --- Routes & OpenAPI tag ----------------------------------------------------
export const TEAMS_ROUTE = 'teams';
export const TEAMS_API_TAG = 'teams';

// Declared before the `:teamId` routes so `mine` is never matched as a team id.
export const MY_TEAMS_ROUTE = 'mine';
export const TEAM_BY_ID_ROUTE = ':teamId';
export const TEAM_ACTIVATE_ROUTE = ':teamId/activate';
export const TEAM_DEACTIVATE_ROUTE = ':teamId/deactivate';
export const TEAM_ARCHIVE_ROUTE = ':teamId/archive';
export const TEAM_REMOVE_ROUTE = ':teamId/remove';
export const SEASONS_ROUTE = ':teamId/seasons';
// Declared before the parameterised season routes so `current` is never matched
// as a season id.
export const CURRENT_SEASON_ROUTE = ':teamId/seasons/current';
export const SEASON_BY_ID_ROUTE = ':teamId/seasons/:seasonId';
export const SEASON_ACTIVATE_ROUTE = ':teamId/seasons/:seasonId/activate';
export const SEASON_CLOSE_ROUTE = ':teamId/seasons/:seasonId/close';
export const SEASON_ARCHIVE_ROUTE = ':teamId/seasons/:seasonId/archive';
export const VENUES_ROUTE = ':teamId/venues';
export const VENUE_BY_ID_ROUTE = ':teamId/venues/:venueId';
export const CATALOG_ENTRIES_ROUTE = ':teamId/catalog-entries';
export const CATALOG_ENTRY_BY_ID_ROUTE = ':teamId/catalog-entries/:entryId';
export const SETTING_VERSIONS_ROUTE = ':teamId/settings/versions';
export const SETTINGS_SNAPSHOT_ROUTE = ':teamId/settings/snapshot';

// --- Route param names -------------------------------------------------------
export const TEAM_ID_PARAM = 'teamId';
export const SEASON_ID_PARAM = 'seasonId';
export const VENUE_ID_PARAM = 'venueId';
export const CATALOG_ENTRY_ID_PARAM = 'entryId';

// --- Field bounds ------------------------------------------------------------
export const SLUG_MIN_LENGTH = 2;
export const SLUG_MAX_LENGTH = 64;
export const NAME_MIN_LENGTH = 1;
export const NAME_MAX_LENGTH = 120;
export const LOCALE_MAX_LENGTH = 16;
export const TIMEZONE_MAX_LENGTH = 64;
export const COLOR_MAX_LENGTH = 32;
export const MEDIA_KEY_MAX_LENGTH = 256;
export const ADDRESS_MAX_LENGTH = 512;
export const CATALOG_KEY_MIN_LENGTH = 1;
export const CATALOG_KEY_MAX_LENGTH = 64;
export const LABEL_MAX_LENGTH = 120;
export const NOTE_MAX_LENGTH = 512;
export const SORT_ORDER_MIN = 0;
export const SORT_ORDER_MAX = 100000;
export const LATITUDE_MIN = -90;
export const LATITUDE_MAX = 90;
export const LONGITUDE_MIN = -180;
export const LONGITUDE_MAX = 180;

// --- Defaults ----------------------------------------------------------------
export const DEFAULT_LOCALE = 'en';
export const DEFAULT_TIMEZONE = 'Africa/Cairo';
export const DEFAULT_SORT_ORDER = 0;
export const EMPTY_JSON_OBJECT: Readonly<Record<string, unknown>> = {};

// --- Pagination --------------------------------------------------------------
export const LIST_DEFAULT_LIMIT = 20;
export const LIST_MIN_LIMIT = 1;
export const LIST_MAX_LIMIT = 100;
export const LIST_DEFAULT_OFFSET = 0;

// Upper bound on non-archived seasons scanned when checking date overlap. Season
// cardinality per team is inherently small (a handful per year); this keeps the
// overlap scan bounded per the query-bounding rule while staying correct.
export const SEASON_SCAN_LIMIT = 1000;

// --- Slug validation ---------------------------------------------------------
// Lowercase kebab-case: alphanumeric start/end with optional interior hyphens.
// Two flat alternatives keep every quantifier un-nested (ReDoS-safe).
export const SLUG_PATTERN = /^[a-z0-9]$|^[a-z0-9][a-z0-9-]*[a-z0-9]$/u;

// Date-only, ISO `YYYY-MM-DD` (no time component) for season boundaries.
export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;

// --- Audit event types (append-only security_events) -------------------------
export const TEAM_CREATED_EVENT = 'team.created';
export const TEAM_UPDATED_EVENT = 'team.updated';
export const TEAM_ARCHIVED_EVENT = 'team.archived';
export const TEAM_TRANSITIONED_EVENT = 'team.transitioned';
export const TEAM_REMOVED_EVENT = 'team.removed';
export const SEASON_CREATED_EVENT = 'team.seasonCreated';
export const SEASON_UPDATED_EVENT = 'team.seasonUpdated';
export const SEASON_ARCHIVED_EVENT = 'team.seasonArchived';
export const SEASON_TRANSITIONED_EVENT = 'team.seasonTransitioned';
export const VENUE_CREATED_EVENT = 'team.venueCreated';
export const VENUE_UPDATED_EVENT = 'team.venueUpdated';
export const VENUE_ARCHIVED_EVENT = 'team.venueArchived';
export const CATALOG_ENTRY_CREATED_EVENT = 'team.catalogEntryCreated';
export const CATALOG_ENTRY_ARCHIVED_EVENT = 'team.catalogEntryArchived';
export const SETTING_VERSION_CREATED_EVENT = 'team.settingVersionCreated';

// --- Error messages & keys ---------------------------------------------------
export const TEAM_NOT_FOUND_MESSAGE = 'The team was not found';
export const TEAM_NOT_FOUND_MESSAGE_KEY: ErrorMessageKey =
  'errors.teams.teamNotFound';

export const SEASON_NOT_FOUND_MESSAGE = 'The season was not found';
export const SEASON_NOT_FOUND_MESSAGE_KEY: ErrorMessageKey =
  'errors.teams.seasonNotFound';

export const VENUE_NOT_FOUND_MESSAGE = 'The venue was not found';
export const VENUE_NOT_FOUND_MESSAGE_KEY: ErrorMessageKey =
  'errors.teams.venueNotFound';

export const CATALOG_ENTRY_NOT_FOUND_MESSAGE =
  'The catalog entry was not found';
export const CATALOG_ENTRY_NOT_FOUND_MESSAGE_KEY: ErrorMessageKey =
  'errors.teams.catalogEntryNotFound';

export const SLUG_CONFLICT_MESSAGE =
  'A record with the same identifier already exists in this scope';
export const SLUG_CONFLICT_MESSAGE_KEY: ErrorMessageKey =
  'errors.teams.slugConflict';

export const SEASON_INVALID_RANGE_MESSAGE =
  'The season end date must not be before its start date';
export const SEASON_INVALID_RANGE_MESSAGE_KEY: ErrorMessageKey =
  'errors.teams.seasonInvalidRange';

export const SEASON_OVERLAP_MESSAGE =
  'The season dates overlap an existing season for this team';
export const SEASON_OVERLAP_MESSAGE_KEY: ErrorMessageKey =
  'errors.teams.seasonOverlap';

export const VERSION_CONFLICT_MESSAGE =
  'The record was modified by someone else; reload and retry';
export const VERSION_CONFLICT_MESSAGE_KEY: ErrorMessageKey =
  'errors.teams.versionConflict';

export const CATALOG_ENTRY_IN_USE_MESSAGE =
  'The catalog entry is referenced and cannot be archived';
export const CATALOG_ENTRY_IN_USE_MESSAGE_KEY: ErrorMessageKey =
  'errors.teams.catalogEntryInUse';

export const TEAM_INVALID_TRANSITION_MESSAGE =
  'The team cannot move to that state from its current state';
export const TEAM_INVALID_TRANSITION_MESSAGE_KEY: ErrorMessageKey =
  'errors.teams.teamInvalidTransition';

export const SEASON_INVALID_TRANSITION_MESSAGE =
  'The season cannot move to that state from its current state';
export const SEASON_INVALID_TRANSITION_MESSAGE_KEY: ErrorMessageKey =
  'errors.teams.seasonInvalidTransition';

export const SEASON_ALREADY_ACTIVE_MESSAGE =
  'This team already has an active season; close or archive it first';
export const SEASON_ALREADY_ACTIVE_MESSAGE_KEY: ErrorMessageKey =
  'errors.teams.seasonAlreadyActive';

export const CURRENT_SEASON_NOT_FOUND_MESSAGE =
  'This team has no active season';
export const CURRENT_SEASON_NOT_FOUND_MESSAGE_KEY: ErrorMessageKey =
  'errors.teams.currentSeasonNotFound';

export const SETTING_VERSION_CONFLICT_MESSAGE =
  'A setting version already exists at this effective instant';
export const SETTING_VERSION_CONFLICT_MESSAGE_KEY: ErrorMessageKey =
  'errors.teams.settingVersionConflict';
