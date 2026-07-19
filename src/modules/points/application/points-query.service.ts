import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { PointsLedgerRepository } from '../infrastructure/points-ledger.repository';
import type {
  LeaderboardPage,
  PageRequest,
  PointsSummaryView,
} from '../model/points.types';
import { PointsScopeService } from './points-scope.service';
import { PointsSummaryService } from './points-summary.service';

/**
 * Read side of the points ledger. The member self read resolves its membership
 * from the authenticated identity (never a path/body param); the team leaderboard
 * and member reads are permissioned separately. Every list is bounded and
 * deterministically ordered in one transaction; totals are projections.
 */
@Injectable()
export class PointsQueryService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    private readonly scope: PointsScopeService,
    private readonly ledger: PointsLedgerRepository,
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

  teamLeaderboard(teamId: string, page: PageRequest): Promise<LeaderboardPage> {
    return this.unitOfWork.runInTransaction(tx =>
      this.leaderboard(tx, teamId, page),
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

  private async leaderboard(
    tx: TransactionScope,
    teamId: string,
    page: PageRequest,
  ): Promise<LeaderboardPage> {
    const items = await this.ledger.leaderboard(tx, teamId, page);
    const total = await this.ledger.countActiveMemberships(tx, teamId);
    return { items, total, limit: page.limit, offset: page.offset };
  }
}
