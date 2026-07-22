import {
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { buildCohortComparison } from '../domain/analytics-privacy.policy';
import { ProjectionRepository } from '../infrastructure/projection.repository';
import type {
  CohortComparison,
  CohortComparisonQuery,
} from '../model/analytics.types';
import { AnalyticsScopeService } from './analytics-scope.service';

/**
 * Compares a cohort's projected values for a dimension in one period. The
 * comparison is exposed ONLY when the cohort meets the privacy threshold —
 * otherwise the statistics are suppressed to null and only the sample size is
 * returned, so a small group can never enable a sensitive inference about an
 * individual. Descriptive statistics only; correlation is never framed as cause.
 */
@Injectable()
export class CohortComparisonService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    private readonly repository: ProjectionRepository,
    private readonly scopes: AnalyticsScopeService,
  ) {}

  compare(
    teamId: string,
    query: CohortComparisonQuery,
  ): Promise<CohortComparison> {
    return this.unitOfWork.runInTransaction(async tx => {
      await this.scopes.requireTeam(tx, teamId);
      const projections = await this.repository.listCohort(
        tx,
        teamId,
        query.dimension,
        query.periodType,
        query.periodKey,
      );
      return buildCohortComparison(
        query.dimension,
        query.periodKey,
        projections.map(projection => projection.value),
      );
    });
  }
}
