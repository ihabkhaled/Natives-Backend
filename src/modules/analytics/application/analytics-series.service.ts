import {
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import {
  latestComputedAt,
  summarizeSeries,
  toSeriesPoints,
} from '../domain/analytics-series.policy';
import { ProjectionRepository } from '../infrastructure/projection.repository';
import { directionOf, unitOf } from '../lib/analytics.helpers';
import { CALCULATION_VERSION } from '../model/analytics.constants';
import { AnalyticsSubjectType } from '../model/analytics.enums';
import type {
  AnalyticsProjection,
  AnalyticsSeries,
  PageRequest,
  SeriesQuery,
} from '../model/analytics.types';
import { AnalyticsScopeService } from './analytics-scope.service';

/**
 * Builds chart-ready time series for a player or the team. Every series carries
 * a stable id, its unit and direction, null-gap points, a benchmark label, the
 * calculation version, and an accessible textual summary — never a bare array of
 * numbers a client has to guess the meaning of.
 */
@Injectable()
export class AnalyticsSeriesService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    private readonly repository: ProjectionRepository,
    private readonly scopes: AnalyticsScopeService,
  ) {}

  playerSeries(
    teamId: string,
    membershipId: string,
    query: SeriesQuery,
    page: PageRequest,
  ): Promise<AnalyticsSeries> {
    return this.unitOfWork.runInTransaction(async tx => {
      await this.scopes.requireMember(tx, teamId, membershipId);
      const projections = await this.repository.listSeries(
        tx,
        teamId,
        AnalyticsSubjectType.Player,
        membershipId,
        query.dimension,
        query.periodType,
        page,
      );
      return this.toSeries(membershipId, query, projections);
    });
  }

  teamSeries(
    teamId: string,
    query: SeriesQuery,
    page: PageRequest,
  ): Promise<AnalyticsSeries> {
    return this.unitOfWork.runInTransaction(async tx => {
      await this.scopes.requireTeam(tx, teamId);
      const projections = await this.repository.listSeries(
        tx,
        teamId,
        AnalyticsSubjectType.Team,
        null,
        query.dimension,
        query.periodType,
        page,
      );
      return this.toSeries('team', query, projections);
    });
  }

  private toSeries(
    subjectRef: string,
    query: SeriesQuery,
    projections: readonly AnalyticsProjection[],
  ): AnalyticsSeries {
    const points = toSeriesPoints(projections);
    return {
      seriesId: `${subjectRef}:${query.dimension}:${query.periodType}`,
      dimension: query.dimension,
      unit: unitOf(query.dimension),
      direction: directionOf(query.dimension),
      periodType: query.periodType,
      calculationVersion: CALCULATION_VERSION,
      benchmarkLabel: `${query.dimension} (${CALCULATION_VERSION})`,
      summary: summarizeSeries(points),
      points,
      computedAt: latestComputedAt(projections),
    };
  }
}
