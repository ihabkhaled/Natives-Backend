import type { ErrorMessageKey } from '@core/errors/error.types';

// --- API surface -------------------------------------------------------------

export const SQUADS_API_TAG = 'squads';
export const SQUADS_ROUTE = 'teams/:teamId/squads';
export const SQUAD_SELECTIONS_ROUTE =
  'teams/:teamId/squads/:squadId/selections';
export const SQUAD_AVAILABILITY_ROUTE =
  'teams/:teamId/squads/:squadId/availability';

export const TEAM_ID_PARAM = 'teamId';
export const SQUAD_ID_PARAM = 'squadId';
export const MEMBERSHIP_ID_PARAM = 'membershipId';

export const SQUAD_ITEM_ROUTE = ':squadId';
export const SQUAD_TRANSITION_ROUTE = ':squadId/transition';
export const SQUAD_ELIGIBILITY_ROUTE = ':squadId/eligibility';
export const SELECTION_OVERRIDE_ROUTE = 'override';
export const SELECTION_REMOVE_ROUTE = ':membershipId/removal';

// --- Pagination --------------------------------------------------------------

export const LIST_DEFAULT_LIMIT = 20;
export const LIST_MAX_LIMIT = 100;
export const LIST_MIN_LIMIT = 1;
export const LIST_DEFAULT_OFFSET = 0;

/** The candidate eligibility pool is bounded harder than ordinary lists. */
export const ELIGIBILITY_MAX_LIMIT = 200;
export const ELIGIBILITY_DEFAULT_LIMIT = 100;

// --- Field bounds ------------------------------------------------------------

export const NAME_MIN_LENGTH = 2;
export const NAME_MAX_LENGTH = 160;
export const NOTES_MAX_LENGTH = 2000;
export const REASON_MIN_LENGTH = 3;
export const REASON_MAX_LENGTH = 500;
export const OVERRIDE_REASON_MIN_LENGTH = 5;
export const OVERRIDE_REASON_MAX_LENGTH = 500;
export const RECORD_VERSION_MIN = 1;

/** Attendance threshold is a percentage; the legacy 70% is a CANDIDATE default. */
export const ATTENDANCE_THRESHOLD_MIN = 0;
export const ATTENDANCE_THRESHOLD_MAX = 100;
export const DEFAULT_ATTENDANCE_THRESHOLD_PCT = 70;

/** The named, versioned eligibility rule set. A displayed signal cites this. */
export const ELIGIBILITY_POLICY_VERSION = 'eligibility-signals-v1';

/** Percentage scale used when a ratio is expressed 0..100. */
export const PERCENT_SCALE = 100;

/** Raw profile gender tokens the ratio policy buckets (mirrors PlayerGender). */
export const GENDER_TOKEN_MAN = 'man';
export const GENDER_TOKEN_WOMAN = 'woman';
export const GENDER_TOKEN_NONBINARY = 'nonbinary';

// --- Sentinels ---------------------------------------------------------------

/** Sentinel used to fold a nullable competition_id into a unique squad name key. */
export const NO_COMPETITION_SENTINEL = '00000000-0000-0000-0000-000000000000';

// --- Error messages ----------------------------------------------------------

export const SQUAD_NOT_FOUND_MESSAGE = 'The requested squad was not found';
export const SQUAD_NOT_FOUND_MESSAGE_KEY: ErrorMessageKey =
  'errors.squads.squadNotFound';
export const SQUAD_SCOPE_NOT_FOUND_MESSAGE =
  'The team, season, or competition scope was not found';
export const SQUAD_SCOPE_NOT_FOUND_MESSAGE_KEY: ErrorMessageKey =
  'errors.squads.scopeNotFound';
export const SQUAD_VALIDATION_MESSAGE =
  'The squad request failed a domain validation rule';
export const SQUAD_VALIDATION_MESSAGE_KEY: ErrorMessageKey =
  'errors.squads.validation';
export const SQUAD_INVALID_TRANSITION_MESSAGE =
  'The squad cannot make this lifecycle transition';
export const SQUAD_INVALID_TRANSITION_MESSAGE_KEY: ErrorMessageKey =
  'errors.squads.squadInvalidTransition';
export const SQUAD_VERSION_CONFLICT_MESSAGE =
  'The squad was modified concurrently';
export const SQUAD_VERSION_CONFLICT_MESSAGE_KEY: ErrorMessageKey =
  'errors.squads.squadVersionConflict';
export const SQUAD_LOCKED_MESSAGE =
  'The squad is locked and its selection cannot change';
export const SQUAD_LOCKED_MESSAGE_KEY: ErrorMessageKey =
  'errors.squads.squadLocked';
export const ELIGIBILITY_OVERRIDE_REQUIRED_MESSAGE =
  'An eligibility signal flags this player; selecting requires an explicit override with a reason';
export const ELIGIBILITY_OVERRIDE_REQUIRED_MESSAGE_KEY: ErrorMessageKey =
  'errors.squads.eligibilityOverrideRequired';
export const CANDIDATE_NOT_FOUND_MESSAGE =
  'The player is not a member of this team and season';
export const CANDIDATE_NOT_FOUND_MESSAGE_KEY: ErrorMessageKey =
  'errors.squads.candidateNotFound';
export const SELECTION_NOT_FOUND_MESSAGE =
  'The player is not currently selected in this squad';
export const SELECTION_NOT_FOUND_MESSAGE_KEY: ErrorMessageKey =
  'errors.squads.selectionNotFound';
export const AVAILABILITY_MEMBERSHIP_NOT_FOUND_MESSAGE =
  'You have no active membership in this team and season to declare availability';
export const AVAILABILITY_MEMBERSHIP_NOT_FOUND_MESSAGE_KEY: ErrorMessageKey =
  'errors.squads.availabilityMembershipNotFound';

// --- Audit actions / resources ----------------------------------------------

export const SQUAD_RESOURCE_TYPE = 'squad';
export const SQUAD_AGGREGATE = 'squad';
export const SELECTION_RESOURCE_TYPE = 'squad_selection';
export const AVAILABILITY_RESOURCE_TYPE = 'squad_availability';

export const SQUAD_CREATED_ACTION = 'squad.created';
export const SQUAD_TRANSITIONED_ACTION = 'squad.transitioned';
export const SELECTION_RECORDED_ACTION = 'squad.selection.recorded';
export const SELECTION_OVERRIDDEN_ACTION = 'squad.selection.overridden';
export const SELECTION_REMOVED_ACTION = 'squad.selection.removed';
export const AVAILABILITY_DECLARED_ACTION = 'squad.availability.declared';

// --- Domain events (past-tense, versioned, privacy-safe payloads) ------------

export const SQUADS_EVENT_VERSION = 1;
export const SQUAD_CREATED_EVENT = 'squad.created.v1';
export const SQUAD_PUBLISHED_EVENT = 'squad.published.v1';
export const SQUAD_LOCKED_EVENT = 'squad.locked.v1';

// --- Static column lists (never SELECT *) ------------------------------------

export const SQUAD_COLUMNS = `"id", "team_id", "season_id", "competition_id",
  "name", "status", "attendance_threshold_pct", "policy_version",
  "selection_deadline", "notes", "revision", "record_version", "created_by",
  "published_by", "published_at", "locked_at", "archived_at", "created_at",
  "updated_at"`;

export const SELECTION_COLUMNS = `"id", "squad_id", "team_id", "membership_id",
  "selection_role", "status", "reason", "eligibility_overridden",
  "override_reason", "overridden_by", "eligibility_snapshot", "selected_by",
  "removed_by", "removed_at", "record_version", "created_at", "updated_at"`;

export const AVAILABILITY_COLUMNS = `"id", "squad_id", "team_id",
  "membership_id", "availability", "reason", "source", "declared_by",
  "record_version", "created_at", "updated_at"`;

/**
 * The candidate-pool projection: a membership joined to its profile, its season
 * attendance aggregates (numerator/denominator/injured, never a pre-averaged
 * percentage), its availability for the squad, and its current selection state.
 * Bound as: $1 team id, $2 season id, $3 squad id. Callers append the WHERE tail.
 */
export const CANDIDATE_SELECT = `
  SELECT
    m."id" AS "membership_id",
    p."full_name" AS "full_name",
    m."status" AS "status",
    COALESCE(m."season_id" = $2, false) AS "registered_in_season",
    p."gender" AS "gender",
    p."jersey_number" AS "jersey_number",
    COALESCE(att."attended", 0) AS "attended_sessions",
    COALESCE(att."eligible", 0) AS "eligible_sessions",
    COALESCE(att."injured", 0) AS "injured_sessions",
    av."availability" AS "availability",
    (sel."id" IS NOT NULL) AS "selected",
    COALESCE(sel."eligibility_overridden", false) AS "selection_overridden"
  FROM "memberships" m
  LEFT JOIN "member_profiles" p ON p."membership_id" = m."id"
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*) FILTER (WHERE ar."status" IN
        ('present_on_time', 'present_late', 'remote_approved',
         'other_approved'))::int AS "attended",
      COUNT(*) FILTER (WHERE ar."status" NOT IN ('excused', 'injured'))::int
        AS "eligible",
      COUNT(*) FILTER (WHERE ar."status" = 'injured')::int AS "injured"
    FROM "attendance_records" ar
    WHERE ar."membership_id" = m."id" AND ar."season_id" = $2
  ) att ON true
  LEFT JOIN "squad_availability" av
    ON av."squad_id" = $3 AND av."membership_id" = m."id"
  LEFT JOIN "squad_selections" sel
    ON sel."squad_id" = $3 AND sel."membership_id" = m."id"
       AND sel."status" = 'selected'`;

/** Terminal membership states excluded from the candidate pool listing. */
export const EXCLUDED_CANDIDATE_STATES = `('archived', 'anonymized')`;
