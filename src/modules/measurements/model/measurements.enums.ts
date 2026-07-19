/**
 * Enumerations for physical & skill measurement (UN-304). Every enum ships a
 * `*_VALUES` tuple so mappers can validate a raw database string against the
 * closed set without a hand-maintained second list, and DTOs can enumerate it.
 */

/**
 * The kind of objective test a protocol measures. Covers the required families —
 * speed, agility, endurance, strength/power, reaction, throwing accuracy and
 * distance, catching, jumping — plus a `custom` escape hatch so a team can define
 * its own objective test without forcing a 0–5 subjective scale.
 */
export enum MeasurementDiscipline {
  Speed = 'speed',
  Agility = 'agility',
  Endurance = 'endurance',
  StrengthPower = 'strength_power',
  Reaction = 'reaction',
  ThrowingAccuracy = 'throwing_accuracy',
  ThrowingDistance = 'throwing_distance',
  Catching = 'catching',
  Jumping = 'jumping',
  Custom = 'custom',
}

export const MEASUREMENT_DISCIPLINE_VALUES: readonly MeasurementDiscipline[] =
  Object.values(MeasurementDiscipline);

/**
 * A physical unit an attempt value can be recorded in. Attempts may be captured
 * in any unit of the protocol's dimension (e.g. a jump in metres or centimetres)
 * and are converted to the protocol's canonical unit by the pure conversion
 * policy — never inferred or truncated.
 */
export enum MeasurementUnit {
  Seconds = 'seconds',
  Milliseconds = 'milliseconds',
  Meters = 'meters',
  Centimeters = 'centimeters',
  Kilograms = 'kilograms',
  MetersPerSecond = 'meters_per_second',
  Count = 'count',
  Level = 'level',
  Percent = 'percent',
}

export const MEASUREMENT_UNIT_VALUES: readonly MeasurementUnit[] =
  Object.values(MeasurementUnit);

/**
 * The physical dimension a unit belongs to. Only units sharing a dimension are
 * convertible; a cross-dimension conversion (e.g. seconds → metres) is a domain
 * error, never a silent coercion.
 */
export enum MeasurementDimension {
  Time = 'time',
  Distance = 'distance',
  Mass = 'mass',
  Speed = 'speed',
  Count = 'count',
  Level = 'level',
  Ratio = 'ratio',
}

/**
 * Whether a higher or a lower value is the better performance. A sprint time is
 * `better_lower`; a jump distance is `better_higher`. Best-attempt selection reads
 * this so it never assumes bigger-is-better.
 */
export enum MeasurementDirection {
  BetterHigher = 'better_higher',
  BetterLower = 'better_lower',
}

export const MEASUREMENT_DIRECTION_VALUES: readonly MeasurementDirection[] =
  Object.values(MeasurementDirection);

/**
 * How a protocol's single reported result is derived from its raw attempts:
 * the `best` (per direction), the `average` of valid attempts, or the `latest`
 * attempt. Raw attempts stay immutable — the result is always a derivation.
 */
export enum ResultPolicy {
  Best = 'best',
  Average = 'average',
  Latest = 'latest',
}

export const RESULT_POLICY_VALUES: readonly ResultPolicy[] =
  Object.values(ResultPolicy);

/**
 * Lifecycle of a protocol definition. `active` protocols can be scheduled and
 * recorded against; `archived` protocols are retired from selection but stay
 * referentially valid for historical attempts.
 */
export enum ProtocolStatus {
  Active = 'active',
  Archived = 'archived',
}

export const PROTOCOL_STATUS_VALUES: readonly ProtocolStatus[] =
  Object.values(ProtocolStatus);

/**
 * Lifecycle of a measurement session (mirrors the session state machine): a
 * `scheduled` session is planned, `conducted` once its attempts are being taken,
 * and `cancelled` if it never runs. A cancelled session accepts no attempts.
 */
export enum SessionStatus {
  Scheduled = 'scheduled',
  Conducted = 'conducted',
  Cancelled = 'cancelled',
}

export const SESSION_STATUS_VALUES: readonly SessionStatus[] =
  Object.values(SessionStatus);

/** A requested lifecycle transition verb for a measurement session. */
export enum SessionTransition {
  Conduct = 'conduct',
  Cancel = 'cancel',
}

export const SESSION_TRANSITION_VALUES: readonly SessionTransition[] =
  Object.values(SessionTransition);
