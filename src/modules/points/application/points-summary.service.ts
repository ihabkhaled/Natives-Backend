import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { BadgeRepository } from '../infrastructure/badge.repository';
import { PointsLedgerRepository } from '../infrastructure/points-ledger.repository';
import { toLedgerEntryView, toPlayerBadgeView } from '../lib/points.mapper';
import type { PointsSummaryView } from '../model/points.types';

/**
 * Assembles a member's points summary within the caller's transaction: the
 * projected total (sum of ledger entries, never a stored counter), the bounded
 * ledger history, and the badges earned. Reused by the read queries and the
 * adjustment use-case so both return the same freshly-projected view.
 */
@Injectable()
export class PointsSummaryService {
  constructor(
    private readonly ledger: PointsLedgerRepository,
    private readonly badges: BadgeRepository,
  ) {}

  async assemble(
    scope: TransactionScope,
    teamId: string,
    membershipId: string,
  ): Promise<PointsSummaryView> {
    const total = await this.ledger.totalFor(scope, membershipId);
    const entries = await this.ledger.listForMembership(
      scope,
      teamId,
      membershipId,
    );
    const badges = await this.badges.listForMembership(scope, membershipId);
    return {
      membershipId,
      total,
      entries: entries.map(entry => toLedgerEntryView(entry)),
      badges: badges.map(badge => toPlayerBadgeView(badge)),
    };
  }
}
