import {
  ANALYTICS_DIMENSION_VALUES,
  ANALYTICS_DIRECTION_VALUES,
  ANALYTICS_PERIOD_TYPE_VALUES,
  ANALYTICS_SUBJECT_TYPE_VALUES,
  ANALYTICS_UNIT_VALUES,
} from '../model/analytics.enums';
import type {
  AttendanceFactRow,
  PointsFactRow,
  ProjectionRow,
} from '../model/analytics.rows';
import type {
  AnalyticsProjection,
  AttendanceFact,
  PointsFact,
} from '../model/analytics.types';
import {
  parseEnumValue,
  toCoverage,
  toDate,
  toNullableNumber,
  toNumber,
} from './analytics.helpers';

export function toProjection(row: ProjectionRow): AnalyticsProjection {
  return {
    projectionId: row.id,
    teamId: row.team_id,
    seasonId: row.season_id,
    subjectType: parseEnumValue(
      ANALYTICS_SUBJECT_TYPE_VALUES,
      row.subject_type,
      'subject type',
    ),
    subjectId: row.subject_id,
    dimension: parseEnumValue(
      ANALYTICS_DIMENSION_VALUES,
      row.dimension,
      'dimension',
    ),
    periodType: parseEnumValue(
      ANALYTICS_PERIOD_TYPE_VALUES,
      row.period_type,
      'period type',
    ),
    periodKey: row.period_key,
    value: toNullableNumber(row.value),
    sampleSize: toNumber(row.sample_size),
    unit: parseEnumValue(ANALYTICS_UNIT_VALUES, row.unit, 'unit'),
    direction: parseEnumValue(
      ANALYTICS_DIRECTION_VALUES,
      row.direction,
      'direction',
    ),
    calculationVersion: row.calculation_version,
    sourceCoverage: toCoverage(row.source_coverage),
    computedAt: toDate(row.computed_at),
  };
}

export function toAttendanceFact(row: AttendanceFactRow): AttendanceFact {
  return {
    membershipId: row.membership_id,
    periodKey: row.period_key,
    attended: toNumber(row.attended),
    total: toNumber(row.total),
  };
}

export function toPointsFact(row: PointsFactRow): PointsFact {
  return {
    membershipId: row.membership_id,
    periodKey: row.period_key,
    total: toNumber(row.total),
  };
}
