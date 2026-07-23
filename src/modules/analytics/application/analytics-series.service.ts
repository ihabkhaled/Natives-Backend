import type { AuthUserIdentity } from '@core/auth';
import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import {
  latestComputedAt,
  summarizeSeries,
  toSeriesPoints,
} from '../domain/analytics-series.policy';
import { AnalyticsForbiddenError } from '../errors/analytics-forbidden.error';
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
import { AnalyticsAuthorityService } from './analytics-authority.service';
import { AnalyticsScopeService } from './analytics-scope.service';

/**
 * Builds chart-ready time series for a player or the team. Every series carries
 * a stable id, its unit and direction, null-gap points, a benchmark label, the
 * calculation version, and an accessible textual summary — never a bare array of
 * numbers a client has to guess the meaning of.
 *
 * The player series is dual-gated in the application layer (B3):
 * `analytics.read.team` reads any player; `analytics.read.self` reads exactly
 * the caller's own membership. Anything else is a typed 403
 * (errors.analytics.forbidden), decided before any scope probe so a
 * self-tier caller can never enumerate foreign membership ids.
 */
@Injectable()
export class AnalyticsSeriesService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    private readonly repository: ProjectionRepository,
    private readonly scopes: AnalyticsScopeService,
    private readonly authority: AnalyticsAuthorityService,
  ) {}

  playerSeries(
    actor: AuthUserIdentity,
    teamId: string,
    membershipId: string,
    query: SeriesQuery,
    page: PageRequest,
  ): Promise<AnalyticsSeries> {
    return this.unitOfWork.runInTransaction(async tx => {
      await this.requirePlayerRead(tx, actor, teamId, membershipId);
      await this.scopes.requireMember(tx, teamId, membershipId);
      return this.readPlayerSeries(tx, teamId, membershipId, query, page);
    });
  }

  private async readPlayerSeries(
    tx: TransactionScope,
    teamId: string,
    membershipId: string,
    query: SeriesQuery,
    page: PageRequest,
  ): Promise<AnalyticsSeries> {
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
  }

  /** Team tier reads any subject; self tier reads only the own membership. */
  private async requirePlayerRead(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    membershipId: string,
  ): Promise<void> {
    const tiers = await this.authority.readTiersFor(actor, teamId);
    if (tiers.canReadTeam) {
      return;
    }
    if (!tiers.canReadSelf) {
      throw new AnalyticsForbiddenError();
    }
    const { userId } = actor;
    if (
      !(await this.scopes.isOwnMembership(tx, teamId, membershipId, userId))
    ) {
      throw new AnalyticsForbiddenError();
    }
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
