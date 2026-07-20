import type { ErrorMessageKey } from '@core/errors/error.types';

// --- API surface -------------------------------------------------------------

export const ROSTERS_API_TAG = 'rosters';
export const ROSTERS_ROUTE = 'teams/:teamId/rosters';
export const ROSTER_ENTRIES_ROUTE = 'teams/:teamId/rosters/:rosterId/entries';
export const ROSTER_AVAILABILITY_ROUTE =
  'teams/:teamId/rosters/:rosterId/availability';
export const ROSTER_SNAPSHOTS_ROUTE =
  'teams/:teamId/rosters/:rosterId/snapshots';

export const TEAM_ID_PARAM = 'teamId';
export const ROSTER_ID_PARAM = 'rosterId';
export const MEMBERSHIP_ID_PARAM = 'membershipId';

export const MATCH_ROSTER_ROUTE = 'match';
export const ROSTER_ITEM_ROUTE = ':rosterId';
export const ROSTER_TRANSITION_ROUTE = ':rosterId/transition';
export const ROSTER_LOCK_ROUTE = ':rosterId/lock';
export const ROSTER_REVISION_ROUTE = ':rosterId/revision';
export const ROSTER_VALIDATION_ROUTE = ':rosterId/validation';
export const ENTRY_OVERRIDE_ROUTE = 'override';
export const ENTRY_REMOVE_ROUTE = ':membershipId/removal';

// --- Pagination --------------------------------------------------------------

export const LIST_DEFAULT_LIMIT = 20;
export const LIST_MAX_LIMIT = 100;
export const LIST_MIN_LIMIT = 1;
export const LIST_DEFAULT_OFFSET = 0;

/** Entry and snapshot reads are bounded harder than ordinary admin lists. */
export const ENTRY_MAX_LIMIT = 200;
export const ENTRY_DEFAULT_LIMIT = 100;

/** Hard ceiling on a single generate-from-squad or copy-prior expansion. */
export const GENERATE_MAX_ENTRIES = 60;

// --- Field bounds ------------------------------------------------------------

export const NAME_MIN_LENGTH = 2;
export const NAME_MAX_LENGTH = 160;
export const NOTES_MAX_LENGTH = 2000;
export const REASON_MIN_LENGTH = 3;
export const REASON_MAX_LENGTH = 500;
export const OVERRIDE_REASON_MIN_LENGTH = 5;
export const OVERRIDE_REASON_MAX_LENGTH = 500;
export const RECORD_VERSION_MIN = 1;

export const ROSTER_SIZE_MIN = 1;
export const ROSTER_SIZE_MAX = 60;
export const DEFAULT_MIN_SIZE = 7;
export const DEFAULT_MAX_SIZE = 30;
export const JERSEY_NUMBER_MIN = 0;
export const JERSEY_NUMBER_MAX = 999;
export const MIN_WOMEN_MIN = 0;

/** The named, versioned composition rule set. A displayed result cites this. */
export const ROSTER_POLICY_VERSION = 'roster-constraints-v1';

/** The revision a brand-new roster starts at. */
export const FIRST_REVISION = 1;

/** Raw profile gender tokens the bucket rule recognizes (mirrors PlayerGender). */
export const GENDER_TOKEN_MAN = 'man';
export const GENDER_TOKEN_WOMAN = 'woman';
export const GENDER_TOKEN_NONBINARY = 'nonbinary';

// --- Error messages ----------------------------------------------------------

export const ROSTER_NOT_FOUND_MESSAGE = 'The requested roster was not found';
export const ROSTER_NOT_FOUND_MESSAGE_KEY: ErrorMessageKey =
  'errors.rosters.rosterNotFound';
export const ROSTER_SCOPE_NOT_FOUND_MESSAGE =
  'The team, season, competition, fixture, or squad scope was not found';
export const ROSTER_SCOPE_NOT_FOUND_MESSAGE_KEY: ErrorMessageKey =
  'errors.rosters.scopeNotFound';
export const ROSTER_VALIDATION_MESSAGE =
  'The roster request failed a domain validation rule';
export const ROSTER_VALIDATION_MESSAGE_KEY: ErrorMessageKey =
  'errors.rosters.validation';
export const ROSTER_INVALID_TRANSITION_MESSAGE =
  'The roster cannot make this lifecycle transition';
export const ROSTER_INVALID_TRANSITION_MESSAGE_KEY: ErrorMessageKey =
  'errors.rosters.rosterInvalidTransition';
export const ROSTER_VERSION_CONFLICT_MESSAGE =
  'The roster was modified concurrently';
export const ROSTER_VERSION_CONFLICT_MESSAGE_KEY: ErrorMessageKey =
  'errors.rosters.rosterVersionConflict';
export const ROSTER_LOCKED_MESSAGE =
  'The roster is locked and its selection cannot change; create a revision instead';
export const ROSTER_LOCKED_MESSAGE_KEY: ErrorMessageKey =
  'errors.rosters.rosterLocked';
export const ROSTER_CONSTRAINT_MESSAGE =
  'The roster does not satisfy its composition constraints';
export const ROSTER_CONSTRAINT_MESSAGE_KEY: ErrorMessageKey =
  'errors.rosters.rosterConstraint';
export const ROSTER_ENTRY_NOT_FOUND_MESSAGE =
  'The player is not currently on this roster';
export const ROSTER_ENTRY_NOT_FOUND_MESSAGE_KEY: ErrorMessageKey =
  'errors.rosters.entryNotFound';
export const ROSTER_CANDIDATE_NOT_FOUND_MESSAGE =
  'The player is not a member of this team and season';
export const ROSTER_CANDIDATE_NOT_FOUND_MESSAGE_KEY: ErrorMessageKey =
  'errors.rosters.candidateNotFound';
export const ROSTER_OVERRIDE_REQUIRED_MESSAGE =
  'A roster rule flags this player; adding them requires an explicit override with a reason';
export const ROSTER_OVERRIDE_REQUIRED_MESSAGE_KEY: ErrorMessageKey =
  'errors.rosters.overrideRequired';
export const ROSTER_JERSEY_CONFLICT_MESSAGE =
  'Another selected player on this roster already wears that jersey number';
export const ROSTER_JERSEY_CONFLICT_MESSAGE_KEY: ErrorMessageKey =
  'errors.rosters.jerseyConflict';
export const ROSTER_AVAILABILITY_MEMBERSHIP_NOT_FOUND_MESSAGE =
  'You have no active membership in this team and season to declare availability';
export const ROSTER_AVAILABILITY_MEMBERSHIP_NOT_FOUND_MESSAGE_KEY: ErrorMessageKey =
  'errors.rosters.availabilityMembershipNotFound';
export const ROSTER_SNAPSHOT_IMMUTABLE_MESSAGE =
  'A roster snapshot is an immutable historical record and cannot be rewritten';
export const ROSTER_SNAPSHOT_IMMUTABLE_MESSAGE_KEY: ErrorMessageKey =
  'errors.rosters.snapshotImmutable';

// --- Audit actions / resources ----------------------------------------------

export const ROSTER_RESOURCE_TYPE = 'roster';
export const ROSTER_AGGREGATE = 'roster';
export const ROSTER_ENTRY_RESOURCE_TYPE = 'roster_entry';
export const ROSTER_AVAILABILITY_RESOURCE_TYPE = 'roster_availability';
export const ROSTER_SNAPSHOT_RESOURCE_TYPE = 'roster_snapshot';

export const ROSTER_CREATED_ACTION = 'roster.created';
export const ROSTER_TRANSITIONED_ACTION = 'roster.transitioned';
export const ROSTER_LOCKED_ACTION = 'roster.locked';
export const ROSTER_REVISED_ACTION = 'roster.revised';
export const ROSTER_ENTRY_ADDED_ACTION = 'roster.entry.added';
export const ROSTER_ENTRY_OVERRIDDEN_ACTION = 'roster.entry.overridden';
export const ROSTER_ENTRY_REMOVED_ACTION = 'roster.entry.removed';
export const ROSTER_AVAILABILITY_DECLARED_ACTION =
  'roster.availability.declared';
export const ROSTER_SNAPSHOT_TAKEN_ACTION = 'roster.snapshot.taken';

// --- Domain events (past-tense, versioned, privacy-safe payloads) ------------

export const ROSTERS_EVENT_VERSION = 1;
export const ROSTER_CREATED_EVENT = 'roster.created.v1';
export const ROSTER_PUBLISHED_EVENT = 'roster.published.v1';
export const ROSTER_LOCKED_EVENT = 'roster.locked.v1';
export const ROSTER_REVISED_EVENT = 'roster.revised.v1';

// --- Static column lists (never SELECT *) ------------------------------------

export const ROSTER_COLUMNS = `"id", "team_id", "season_id", "competition_id",
  "fixture_id", "squad_id", "source_roster_id", "supersedes_roster_id",
  "current_snapshot_id", "roster_kind", "name", "status", "division",
  "min_size", "max_size", "min_women", "require_captain", "policy_version",
  "selection_deadline", "notes", "revision", "record_version", "created_by",
  "published_by", "published_at", "locked_by", "locked_at", "revised_by",
  "revised_at", "revision_reason", "archived_at", "created_at", "updated_at"`;

export const ENTRY_COLUMNS = `"id", "roster_id", "team_id", "membership_id",
  "jersey_number", "entry_role", "line_assignment", "field_position",
  "gender_bucket", "status", "availability", "selection_reason",
  "constraint_overridden", "override_reason", "overridden_by", "selected_by",
  "removed_by", "removed_at", "removal_reason", "record_version", "created_at",
  "updated_at"`;

export const AVAILABILITY_COLUMNS = `"id", "roster_id", "team_id",
  "membership_id", "availability", "reason", "source", "declared_by",
  "record_version", "created_at", "updated_at"`;

export const SNAPSHOT_COLUMNS = `"id", "roster_id", "team_id", "season_id",
  "competition_id", "fixture_id", "roster_kind", "revision", "reason",
  "roster_status", "entry_count", "checksum", "entries", "taken_by", "taken_at"`;

/**
 * The roster-candidate projection: a membership joined to its profile, its
 * declaration for the roster, and whether the season squad selected it. Bound as:
 * $1 team id, $2 season id, $3 roster id, $4 squad id (may be null). Callers
 * append the WHERE tail.
 */
export const CANDIDATE_SELECT = `
  SELECT
    m."id" AS "membership_id",
    m."status" AS "member_status",
    p."gender" AS "gender",
    p."jersey_number" AS "jersey_number",
    av."availability" AS "availability",
    (sel."id" IS NOT NULL) AS "selected_in_squad"
  FROM "memberships" m
  LEFT JOIN "member_profiles" p ON p."membership_id" = m."id"
  LEFT JOIN "roster_availability" av
    ON av."roster_id" = $3 AND av."membership_id" = m."id"
  LEFT JOIN "squad_selections" sel
    ON sel."squad_id" = $4 AND sel."membership_id" = m."id"
       AND sel."status" = 'selected'`;

/** Terminal membership states excluded from the roster candidate pool. */
export const EXCLUDED_CANDIDATE_STATES = `('archived', 'anonymized')`;

/** Live roster states — the ones a competition/fixture may hold only one of. */
export const LIVE_ROSTER_STATES = `('draft', 'published', 'locked')`;
