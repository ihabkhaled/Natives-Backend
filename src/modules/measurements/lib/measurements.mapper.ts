import {
  MEASUREMENT_DIRECTION_VALUES,
  MEASUREMENT_DISCIPLINE_VALUES,
  MEASUREMENT_UNIT_VALUES,
  PROTOCOL_STATUS_VALUES,
  RESULT_POLICY_VALUES,
  SESSION_STATUS_VALUES,
} from '../model/measurements.enums';
import type {
  MeasurementAttemptRow,
  MeasurementProtocolRow,
  MeasurementSessionRow,
} from '../model/measurements.rows';
import type {
  MeasurementAttempt,
  MeasurementProtocol,
  MeasurementSession,
} from '../model/measurements.types';
import {
  parseEnumValue,
  toDate,
  toNullableDate,
  toNullableNumber,
} from './measurements.helpers';

export function toMeasurementProtocol(
  row: MeasurementProtocolRow,
): MeasurementProtocol {
  return {
    id: row.id,
    teamId: row.team_id,
    seasonId: row.season_id,
    protocolKey: row.protocol_key,
    name: row.name,
    description: row.description,
    discipline: parseEnumValue(
      MEASUREMENT_DISCIPLINE_VALUES,
      row.discipline,
      'measurement discipline',
    ),
    unit: parseEnumValue(MEASUREMENT_UNIT_VALUES, row.unit, 'measurement unit'),
    direction: parseEnumValue(
      MEASUREMENT_DIRECTION_VALUES,
      row.direction,
      'measurement direction',
    ),
    resultPolicy: parseEnumValue(
      RESULT_POLICY_VALUES,
      row.result_policy,
      'result policy',
    ),
    instructions: row.instructions,
    safetyNotes: row.safety_notes,
    minValue: toNullableNumber(row.min_value),
    maxValue: toNullableNumber(row.max_value),
    status: parseEnumValue(
      PROTOCOL_STATUS_VALUES,
      row.status,
      'protocol status',
    ),
    recordVersion: row.record_version,
    createdBy: row.created_by,
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  };
}

export function toMeasurementSession(
  row: MeasurementSessionRow,
): MeasurementSession {
  return {
    id: row.id,
    teamId: row.team_id,
    seasonId: row.season_id,
    title: row.title,
    status: parseEnumValue(SESSION_STATUS_VALUES, row.status, 'session status'),
    scheduledAt: toDate(row.scheduled_at),
    conductedAt: toNullableDate(row.conducted_at),
    location: row.location,
    conditions: row.conditions,
    notes: row.notes,
    recordVersion: row.record_version,
    createdBy: row.created_by,
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  };
}

export function toMeasurementAttempt(
  row: MeasurementAttemptRow,
): MeasurementAttempt {
  return {
    id: row.id,
    sessionId: row.session_id,
    teamId: row.team_id,
    membershipId: row.membership_id,
    protocolId: row.protocol_id,
    attemptNumber: row.attempt_number,
    rawValue: toNullableNumber(row.raw_value),
    unit: parseEnumValue(MEASUREMENT_UNIT_VALUES, row.unit, 'measurement unit'),
    canonicalValue: toNullableNumber(row.canonical_value),
    valid: row.valid,
    disqualified: row.disqualified,
    dqReason: row.dq_reason,
    evaluatorUserId: row.evaluator_user_id,
    notes: row.notes,
    recordedAt: toDate(row.recorded_at),
    createdAt: toDate(row.created_at),
  };
}
