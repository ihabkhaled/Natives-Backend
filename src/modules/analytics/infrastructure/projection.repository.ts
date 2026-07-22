import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { toProjection } from '../lib/analytics.mapper';
import {
  LIST_MAX_LIMIT,
  PROJECTION_COLUMNS,
  PROJECTION_UPSERT_SQL,
} from '../model/analytics.constants';
import type { AnalyticsCountRow, ProjectionRow } from '../model/analytics.rows';
import type {
  AnalyticsProjection,
  PageRequest,
  ProjectionUpsert,
} from '../model/analytics.types';

/**
 * Persistence for analytics projections. Data access only: parameterized SQL,
 * static column lists, bounded reads. The write is an idempotent upsert keyed by
 * (team, season, subject, dimension, period), so a full rebuild converges on the
 * same read model instead of accumulating duplicates.
 */
@Injectable()
export class ProjectionRepository {
  async upsert(
    scope: TransactionScope,
    projection: ProjectionUpsert,
  ): Promise<AnalyticsProjection> {
    const rows = await scope.run<ProjectionRow>(PROJECTION_UPSERT_SQL, [
      projection.id,
      projection.teamId,
      projection.seasonId,
      projection.subjectType,
      projection.subjectId,
      projection.dimension,
      projection.periodType,
      projection.periodKey,
      projection.value,
      projection.sampleSize,
      projection.unit,
      projection.direction,
      projection.calculationVersion,
      JSON.stringify(projection.sourceCoverage),
      projection.now.toISOString(),
    ]);
    const row = rows[0];
    if (row === undefined) {
      throw new Error('Expected a returned row from the projection write');
    }
    return toProjection(row);
  }

  /** A subject's series across periods for one dimension. */
  async listSeries(
    scope: TransactionScope,
    teamId: string,
    subjectType: string,
    subjectId: string | null,
    dimension: string,
    periodType: string,
    page: PageRequest,
  ): Promise<readonly AnalyticsProjection[]> {
    const rows = await scope.run<ProjectionRow>(
      `SELECT ${PROJECTION_COLUMNS} FROM "analytics_projections"
        WHERE "team_id" = $1 AND "subject_type" = $2
          AND "subject_id" IS NOT DISTINCT FROM $3
          AND "dimension" = $4 AND "period_type" = $5
        ORDER BY "period_key" ASC
        LIMIT $6 OFFSET $7`,
      [
        teamId,
        subjectType,
        subjectId,
        dimension,
        periodType,
        Math.min(page.limit, LIST_MAX_LIMIT),
        page.offset,
      ],
    );
    return rows.map(row => toProjection(row));
  }

  /** Every player's value for one dimension in one period, for a cohort. */
  async listCohort(
    scope: TransactionScope,
    teamId: string,
    dimension: string,
    periodType: string,
    periodKey: string,
  ): Promise<readonly AnalyticsProjection[]> {
    const rows = await scope.run<ProjectionRow>(
      `SELECT ${PROJECTION_COLUMNS} FROM "analytics_projections"
        WHERE "team_id" = $1 AND "subject_type" = 'player'
          AND "dimension" = $2 AND "period_type" = $3 AND "period_key" = $4
        ORDER BY "subject_id" ASC
        LIMIT $5`,
      [teamId, dimension, periodType, periodKey, LIST_MAX_LIMIT],
    );
    return rows.map(row => toProjection(row));
  }

  async countForTeam(scope: TransactionScope, teamId: string): Promise<number> {
    const rows = await scope.run<AnalyticsCountRow>(
      `SELECT COUNT(*)::int AS "count" FROM "analytics_projections"
        WHERE "team_id" = $1`,
      [teamId],
    );
    return Number(rows[0]?.count ?? 0);
  }
}
