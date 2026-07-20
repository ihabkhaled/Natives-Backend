import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import type { PointsSummaryView } from '../model/points.types';
import { PointsScopeService } from './points-scope.service';
import { PointsSummaryService } from './points-summary.service';

/**
 * Read side of a member's points summary. The self read resolves its membership
 * from the authenticated identity (never a path/body param); the member read is
 * permissioned separately. Both run in one transaction; totals are projections.
 * The ranked team leaderboard is served by LeaderboardQueryService.
 */
@Injectable()
export class PointsQueryService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    private readonly scope: PointsScopeService,
    private readonly summary: PointsSummaryService,
  ) {}

  myPoints(teamId: string, userId: string): Promise<PointsSummaryView> {
    return this.unitOfWork.runInTransaction(tx => this.own(tx, teamId, userId));
  }

  memberPoints(
    teamId: string,
    membershipId: string,
  ): Promise<PointsSummaryView> {
    return this.unitOfWork.runInTransaction(tx =>
      this.member(tx, teamId, membershipId),
    );
  }

  private async own(
    tx: TransactionScope,
    teamId: string,
    userId: string,
  ): Promise<PointsSummaryView> {
    const membershipId = await this.scope.requireOwnMembership(
      tx,
      teamId,
      userId,
    );
    return this.summary.assemble(tx, teamId, membershipId);
  }

  private async member(
    tx: TransactionScope,
    teamId: string,
    membershipId: string,
  ): Promise<PointsSummaryView> {
    await this.scope.requireMembership(tx, teamId, membershipId);
    return this.summary.assemble(tx, teamId, membershipId);
  }
}
