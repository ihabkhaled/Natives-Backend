import type { ErrorMessageKey } from '@core/errors/error.types';

import { MeasurementDimension, MeasurementUnit } from './measurements.enums';
import type { UnitMetadata } from './measurements.types';

// --- API surface -------------------------------------------------------------

export const MEASUREMENTS_API_TAG = 'measurements';
export const MEASUREMENT_PROTOCOLS_ROUTE =
  'teams/:teamId/measurement-protocols';
export const MEASUREMENT_SESSIONS_ROUTE = 'teams/:teamId/measurement-sessions';
export const MEASUREMENT_HISTORY_ROUTE = 'teams/:teamId/measurement-history';
export const MY_MEASUREMENTS_ROUTE = 'teams/:teamId/my-measurements';

export const TEAM_ID_PARAM = 'teamId';
export const PROTOCOL_ID_PARAM = 'protocolId';
export const SESSION_ID_PARAM = 'sessionId';
export const MEMBERSHIP_ID_PARAM = 'membershipId';

export const PROTOCOL_DETAIL_ROUTE = ':protocolId';
export const SESSION_DETAIL_ROUTE = ':sessionId';
export const SESSION_TRANSITION_ROUTE = ':sessionId/transition';
export const SESSION_ATTEMPTS_ROUTE = ':sessionId/attempts';
export const HISTORY_MEMBER_ROUTE = ':membershipId';

// --- Pagination --------------------------------------------------------------

export const LIST_DEFAULT_LIMIT = 20;
export const LIST_MAX_LIMIT = 100;
export const LIST_MIN_LIMIT = 1;
export const LIST_DEFAULT_OFFSET = 0;
export const HISTORY_SCAN_MAX = 500;

// --- Protocol bounds ---------------------------------------------------------

export const PROTOCOL_KEY_MIN_LENGTH = 2;
export const PROTOCOL_KEY_MAX_LENGTH = 100;
export const PROTOCOL_NAME_MIN_LENGTH = 2;
export const PROTOCOL_NAME_MAX_LENGTH = 200;
export const PROTOCOL_TEXT_MAX_LENGTH = 4000;
export const PROTOCOL_VALUE_MIN = -1_000_000;
export const PROTOCOL_VALUE_MAX = 1_000_000;

// --- Session bounds ----------------------------------------------------------

export const SESSION_TITLE_MIN_LENGTH = 2;
export const SESSION_TITLE_MAX_LENGTH = 200;
export const SESSION_TEXT_MAX_LENGTH = 2000;

// --- Attempt bounds ----------------------------------------------------------

export const ATTEMPTS_MIN_ITEMS = 1;
export const ATTEMPTS_MAX_ITEMS = 20;
export const ATTEMPT_VALUE_MIN = -1_000_000;
export const ATTEMPT_VALUE_MAX = 1_000_000;
export const ATTEMPT_NOTE_MAX_LENGTH = 1000;
export const DQ_REASON_MAX_LENGTH = 500;
export const FIRST_ATTEMPT_NUMBER = 1;
export const RECORD_VERSION_MIN = 1;

/** Display precision — rounding happens only at the presentation boundary. */
export const RESULT_DISPLAY_DECIMALS = 4;

// --- Units: dimension + canonical conversion factors -------------------------

/**
 * Per-unit metadata: the physical dimension the unit belongs to and the
 * multiplier that converts it into its dimension's canonical unit (seconds,
 * metres, kilograms, m/s, count, level, ratio). Only units of the same dimension
 * are convertible; to convert between two units of a dimension the policy applies
 * value × factor(from) ÷ factor(to). Exact powers of ten keep the common
 * time/distance conversions lossless. A Map (not a plain object) is used so
 * lookups go through `.get()` and never a computed member access.
 */
export const UNIT_METADATA: ReadonlyMap<MeasurementUnit, UnitMetadata> =
  new Map([
    [
      MeasurementUnit.Seconds,
      { dimension: MeasurementDimension.Time, factor: 1 },
    ],
    [
      MeasurementUnit.Milliseconds,
      { dimension: MeasurementDimension.Time, factor: 0.001 },
    ],
    [
      MeasurementUnit.Meters,
      { dimension: MeasurementDimension.Distance, factor: 1 },
    ],
    [
      MeasurementUnit.Centimeters,
      { dimension: MeasurementDimension.Distance, factor: 0.01 },
    ],
    [
      MeasurementUnit.Kilograms,
      { dimension: MeasurementDimension.Mass, factor: 1 },
    ],
    [
      MeasurementUnit.MetersPerSecond,
      { dimension: MeasurementDimension.Speed, factor: 1 },
    ],
    [
      MeasurementUnit.Count,
      { dimension: MeasurementDimension.Count, factor: 1 },
    ],
    [
      MeasurementUnit.Level,
      { dimension: MeasurementDimension.Level, factor: 1 },
    ],
    [
      MeasurementUnit.Percent,
      { dimension: MeasurementDimension.Ratio, factor: 1 },
    ],
  ]);

// --- Error messages ----------------------------------------------------------

export const MEASUREMENT_SCOPE_NOT_FOUND_MESSAGE =
  'The team, season, or membership scope was not found';
export const MEASUREMENT_SCOPE_NOT_FOUND_MESSAGE_KEY: ErrorMessageKey =
  'errors.measurements.scopeNotFound';
export const PROTOCOL_NOT_FOUND_MESSAGE =
  'The requested measurement protocol was not found';
export const PROTOCOL_NOT_FOUND_MESSAGE_KEY: ErrorMessageKey =
  'errors.measurements.protocolNotFound';
export const SESSION_NOT_FOUND_MESSAGE =
  'The requested measurement session was not found';
export const SESSION_NOT_FOUND_MESSAGE_KEY: ErrorMessageKey =
  'errors.measurements.sessionNotFound';
export const PROTOCOL_DUPLICATE_MESSAGE =
  'A measurement protocol with this key already exists for the scope';
export const PROTOCOL_DUPLICATE_MESSAGE_KEY: ErrorMessageKey =
  'errors.measurements.protocolDuplicate';
export const MEASUREMENT_VALIDATION_MESSAGE =
  'The measurement request failed a domain validation rule';
export const MEASUREMENT_VALIDATION_MESSAGE_KEY: ErrorMessageKey =
  'errors.measurements.validation';
export const UNIT_INCOMPATIBLE_MESSAGE =
  'The attempt unit is not compatible with the protocol unit';
export const UNIT_INCOMPATIBLE_MESSAGE_KEY: ErrorMessageKey =
  'errors.measurements.unitIncompatible';
export const INVALID_TRANSITION_MESSAGE =
  'The measurement session cannot make this lifecycle transition';
export const INVALID_TRANSITION_MESSAGE_KEY: ErrorMessageKey =
  'errors.measurements.invalidTransition';
export const VERSION_CONFLICT_MESSAGE =
  'The measurement session was modified concurrently';
export const VERSION_CONFLICT_MESSAGE_KEY: ErrorMessageKey =
  'errors.measurements.versionConflict';

// --- Audit actions / resources -----------------------------------------------

export const PROTOCOL_RESOURCE_TYPE = 'measurement_protocol';
export const SESSION_RESOURCE_TYPE = 'measurement_session';
export const MEASUREMENT_AGGREGATE = 'measurement_session';
export const PROTOCOL_CREATED_ACTION = 'measurement.protocol.created';
export const SESSION_CREATED_ACTION = 'measurement.session.created';
export const SESSION_TRANSITIONED_ACTION = 'measurement.session.transitioned';
export const MEASUREMENT_RECORDED_ACTION = 'measurement.recorded';

// --- Domain events (past-tense, versioned, privacy-safe payloads) ------------

export const MEASUREMENT_EVENT_VERSION = 1;
export const MEASUREMENT_RECORDED_EVENT = 'measurement.recorded.v1';

// --- Seeded global protocol catalog ------------------------------------------

/** Deterministic id prefix for the seeded global protocol catalog. */
export const SEEDED_PROTOCOL_ID_PREFIX = '30400000-0000-4000-9000-0000000000';

// --- Static column lists (never SELECT *) ------------------------------------

export const MEASUREMENT_PROTOCOL_COLUMNS = `"id", "team_id", "season_id",
  "protocol_key", "name", "description", "discipline", "unit", "direction",
  "result_policy", "instructions", "safety_notes", "min_value", "max_value",
  "status", "record_version", "created_by", "created_at", "updated_at"`;

export const MEASUREMENT_SESSION_COLUMNS = `"id", "team_id", "season_id",
  "title", "status", "scheduled_at", "conducted_at", "location", "conditions",
  "notes", "record_version", "created_by", "created_at", "updated_at"`;

export const MEASUREMENT_ATTEMPT_COLUMNS = `"id", "session_id", "team_id",
  "membership_id", "protocol_id", "attempt_number", "raw_value", "unit",
  "canonical_value", "valid", "disqualified", "dq_reason", "evaluator_user_id",
  "notes", "recorded_at", "created_at"`;
