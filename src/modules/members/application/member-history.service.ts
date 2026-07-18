import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { StatusEventRepository } from '../infrastructure/status-event.repository';
import { HISTORY_LIST_MAX } from '../model/members.constants';
import type { ListHistoryResult } from '../model/members.types';
import { MemberLookupService } from './member-lookup.service';

/**
 * Read side for a membership's status-history timeline (append-only lifecycle
 * events). Restricted to lifecycle managers at the route. Bounded and ordered
 * oldest-first for a deterministic audit trail.
 */
@Injectable()
export class MemberHistoryService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    private readonly lookup: MemberLookupService,
    private readonly events: StatusEventRepository,
  ) {}

  listHistory(
    teamId: string,
    membershipId: string,
  ): Promise<ListHistoryResult> {
    return this.unitOfWork.runInTransaction(scope =>
      this.load(scope, teamId, membershipId),
    );
  }

  private async load(
    scope: TransactionScope,
    teamId: string,
    membershipId: string,
  ): Promise<ListHistoryResult> {
    await this.lookup.requireMembership(scope, teamId, membershipId);
    const items = await this.events.listByMembership(
      scope,
      membershipId,
      HISTORY_LIST_MAX,
    );
    return { items };
  }
}
