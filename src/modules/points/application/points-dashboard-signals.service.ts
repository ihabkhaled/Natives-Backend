import {
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { PointsDashboardRepository } from '../infrastructure/points-dashboard.repository';
import { EMPTY_POINTS_STANDING, toPointsStanding } from '../lib/signals.mapper';
import type {
  PointsSignalScope,
  PointsStandingSignal,
} from '../model/signals.types';

/**
 * Public points surface for dashboard projections: one member's net ledger total
 * and their rank inside the requested team/season scope. Always recomputed from
 * the append-only ledger, never read from a stored counter, and null throughout
 * when the member has no entries yet.
 */
@Injectable()
export class PointsDashboardSignalsService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    private readonly repository: PointsDashboardRepository,
  ) {}

  async standing(scope: PointsSignalScope): Promise<PointsStandingSignal> {
    const membershipId = scope.membershipId;
    if (membershipId === null) {
      return EMPTY_POINTS_STANDING;
    }
    const rows = await this.unitOfWork.runInTransaction(tx =>
      this.repository.standingFor(
        tx,
        scope.teamId,
        scope.seasonId,
        membershipId,
      ),
    );
    return toPointsStanding(rows);
  }
}
