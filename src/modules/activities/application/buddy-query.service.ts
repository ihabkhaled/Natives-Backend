import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { ActivityBuddyRepository } from '../infrastructure/activity-buddy.repository';
import { toBuddyView } from '../lib/activity.response.mapper';
import type {
  ActivityBuddy,
  PagedResult,
  PageRequest,
} from '../model/activity.types';
import type { BuddyView } from '../model/activity.views';

/**
 * Member self read of the pending training-buddy credits pointing at the caller's
 * own membership, resolved from the authenticated identity. A single bounded,
 * deterministically ordered page in one transaction.
 */
@Injectable()
export class BuddyQueryService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    private readonly repository: ActivityBuddyRepository,
  ) {}

  listPendingForMember(
    teamId: string,
    userId: string,
    page: PageRequest,
  ): Promise<PagedResult<BuddyView>> {
    return this.unitOfWork.runInTransaction(tx =>
      this.pendingPage(tx, teamId, userId, page),
    );
  }

  private async pendingPage(
    tx: TransactionScope,
    teamId: string,
    userId: string,
    page: PageRequest,
  ): Promise<PagedResult<BuddyView>> {
    const rows = await this.repository.listPendingForMember(
      tx,
      teamId,
      userId,
      page,
    );
    const total = await this.repository.countPendingForMember(
      tx,
      teamId,
      userId,
    );
    return this.envelope(rows, total, page);
  }

  private envelope(
    rows: readonly ActivityBuddy[],
    total: number,
    page: PageRequest,
  ): PagedResult<BuddyView> {
    return {
      items: rows.map(row => toBuddyView(row)),
      total,
      limit: page.limit,
      offset: page.offset,
    };
  }
}
