import type { AuditInput } from '@modules/platform';
import { AuditOutcome } from '@modules/platform';

import {
  ANALYTICS_REBUILT_ACTION,
  CALCULATION_VERSION,
  PROJECTION_RESOURCE_TYPE,
} from '../model/analytics.constants';
import type {
  AnalyticsDimension,
  AnalyticsPeriodType,
} from '../model/analytics.enums';
import { AnalyticsSubjectType } from '../model/analytics.enums';
import type {
  AnalyticsScope,
  ProjectionUpsert,
  RebuildReport,
} from '../model/analytics.types';
import { directionOf, unitOf } from './analytics.helpers';

/**
 * Build a player projection. The unit and direction come from the dimension
 * metadata, and the value is passed through unchanged — a null value stays null,
 * so a projected "not evaluated" is never coerced to zero on the way to storage.
 */
export function buildPlayerProjection(
  id: string,
  scope: AnalyticsScope,
  subjectId: string,
  dimension: AnalyticsDimension,
  periodType: AnalyticsPeriodType,
  periodKey: string,
  value: number | null,
  sampleSize: number,
  coverage: Readonly<Record<string, number>>,
  now: Date,
): ProjectionUpsert {
  return {
    id,
    teamId: scope.teamId,
    seasonId: scope.seasonId,
    subjectType: AnalyticsSubjectType.Player,
    subjectId,
    dimension,
    periodType,
    periodKey,
    value,
    sampleSize,
    unit: unitOf(dimension),
    direction: directionOf(dimension),
    calculationVersion: CALCULATION_VERSION,
    sourceCoverage: coverage,
    now,
  };
}

export function buildTeamProjection(
  id: string,
  scope: AnalyticsScope,
  dimension: AnalyticsDimension,
  periodType: AnalyticsPeriodType,
  periodKey: string,
  value: number | null,
  sampleSize: number,
  coverage: Readonly<Record<string, number>>,
  now: Date,
): ProjectionUpsert {
  return {
    id,
    teamId: scope.teamId,
    seasonId: scope.seasonId,
    subjectType: AnalyticsSubjectType.Team,
    subjectId: null,
    dimension,
    periodType,
    periodKey,
    value,
    sampleSize,
    unit: unitOf(dimension),
    direction: directionOf(dimension),
    calculationVersion: CALCULATION_VERSION,
    sourceCoverage: coverage,
    now,
  };
}

export function buildRebuildAudit(
  actorUserId: string,
  scope: AnalyticsScope,
  report: RebuildReport,
): AuditInput {
  return {
    actorUserId,
    action: ANALYTICS_REBUILT_ACTION,
    resourceType: PROJECTION_RESOURCE_TYPE,
    resourceId: null,
    teamId: scope.teamId,
    seasonId: scope.seasonId,
    correlationId: null,
    outcome: AuditOutcome.Success,
    diff: {
      periodType: report.periodType,
      calculationVersion: report.calculationVersion,
      subjectsProjected: report.subjectsProjected,
      projectionsWritten: report.projectionsWritten,
    },
  };
}
