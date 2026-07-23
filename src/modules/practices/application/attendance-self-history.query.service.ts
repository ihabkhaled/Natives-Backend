import type { AuthUserIdentity } from '@core/auth';
import { CLOCK_PORT, type ClockPort } from '@core/clock/clock.port';
import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { AttendanceNotMemberError } from '../errors/attendance-not-member.error';
import { AttendanceMembershipRepository } from '../infrastructure/attendance-membership.repository';
import { AttendanceRecordRepository } from '../infrastructure/attendance-record.repository';
import { buildSelfHistoryScan } from '../lib/attendance.builders';
import type {
  MembershipRef,
  SelfHistoryRequest,
  SelfHistoryScan,
  SelfHistoryView,
} from '../model/attendance.types';

/**
 * Read side for a member's OWN attendance history: the team's past (started, not
 * cancelled) sessions LEFT-JOINed with the caller's record, newest first,
 * bounded and paginated. The membership is always resolved from the caller's
 * token — never from a client-supplied id — so the read can only ever expose the
 * caller's own rows. Unrecorded sessions appear with a null status
 * (null-not-zero) and `sheetState` lets the client flag "not finalized yet".
 */
@Injectable()
export class AttendanceSelfHistoryQueryService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    private readonly memberships: AttendanceMembershipRepository,
    private readonly records: AttendanceRecordRepository,
  ) {}

  getOwn(
    teamId: string,
    actor: AuthUserIdentity,
    request: SelfHistoryRequest,
  ): Promise<SelfHistoryView> {
    return this.unitOfWork.runInTransaction(scope =>
      this.resolveOwn(scope, teamId, actor, request),
    );
  }

  private async resolveOwn(
    scope: TransactionScope,
    teamId: string,
    actor: AuthUserIdentity,
    request: SelfHistoryRequest,
  ): Promise<SelfHistoryView> {
    const membership = await this.requireOwnMembership(
      scope,
      teamId,
      actor.userId,
    );
    return this.project(
      scope,
      buildSelfHistoryScan(teamId, membership.id, request, this.clock.now()),
    );
  }

  private async project(
    scope: TransactionScope,
    scan: SelfHistoryScan,
  ): Promise<SelfHistoryView> {
    const items = await this.records.selfHistory(scope, scan);
    const total = await this.records.countSelfHistory(scope, scan);
    return {
      items,
      total,
      limit: scan.page.limit,
      offset: scan.page.offset,
    };
  }

  private async requireOwnMembership(
    scope: TransactionScope,
    teamId: string,
    userId: string,
  ): Promise<MembershipRef> {
    const membership = await this.memberships.findActiveByUser(
      scope,
      teamId,
      userId,
    );
    if (membership === null) {
      throw new AttendanceNotMemberError();
    }
    return membership;
  }
}
