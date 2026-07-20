import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { AssessmentDashboardRepository } from '../infrastructure/assessment-dashboard.repository';
import { toAssessmentCountSignal } from '../lib/signals.mapper';
import type {
  AssessmentCountSignal,
  AssessmentDashboardSignals,
  AssessmentSignalScope,
} from '../model/signals.types';

/**
 * Public assessments surface for dashboard projections: how many published
 * assessments the viewer has to read, and how many submitted ones the team's
 * coaches still owe a review. Both are bounded aggregates over current
 * revisions. Read-only — never a stored counter.
 */
@Injectable()
export class AssessmentDashboardSignalsService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    private readonly repository: AssessmentDashboardRepository,
  ) {}

  collect(scope: AssessmentSignalScope): Promise<AssessmentDashboardSignals> {
    return this.unitOfWork.runInTransaction(tx => this.read(tx, scope));
  }

  private async read(
    tx: TransactionScope,
    scope: AssessmentSignalScope,
  ): Promise<AssessmentDashboardSignals> {
    const published = await this.readPublished(tx, scope);
    const pending = await this.repository.countAwaitingReview(tx, scope.teamId);
    return {
      publishedForViewer: published,
      awaitingReview: toAssessmentCountSignal(pending),
    };
  }

  private async readPublished(
    tx: TransactionScope,
    scope: AssessmentSignalScope,
  ): Promise<AssessmentCountSignal> {
    if (scope.membershipId === null) {
      return { count: null, asOf: null };
    }
    const rows = await this.repository.countPublishedForMember(
      tx,
      scope.teamId,
      scope.membershipId,
    );
    return toAssessmentCountSignal(rows);
  }
}
