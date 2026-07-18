import type { AuthUserIdentity } from '@core/auth';
import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { AttendanceNotMemberError } from '../errors/attendance-not-member.error';
import { AttendanceMembershipRepository } from '../infrastructure/attendance-membership.repository';
import { AttendanceRecordRepository } from '../infrastructure/attendance-record.repository';
import { AttendanceRecordRevisionRepository } from '../infrastructure/attendance-record-revision.repository';
import { AttendanceSheetRepository } from '../infrastructure/attendance-sheet.repository';
import {
  notRecordedView,
  toAttendanceView,
  toSheetView,
} from '../lib/attendance.mapper';
import { ATTENDANCE_HISTORY_SCAN_LIMIT } from '../model/attendance.constants';
import type {
  AttendanceSheetView,
  AttendanceView,
  ListAttendanceRevisionsResult,
  MembershipRef,
} from '../model/attendance.types';
import type { PageRequest } from '../model/practices.types';
import { PracticeLookupService } from './practice-lookup.service';

/**
 * Read side for attendance: the roster + sheet state (the prefill source — every
 * active member appears, unmarked ⇒ null status), a member's own record
 * (synthesized "not recorded" when absent), and one member's correction history.
 * Every read resolves the session within the caller's team scope first, so a
 * cross-team id is a clean not-found. Notes and reasons are never in the roster.
 */
@Injectable()
export class AttendanceQueryService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    private readonly lookup: PracticeLookupService,
    private readonly memberships: AttendanceMembershipRepository,
    private readonly sheets: AttendanceSheetRepository,
    private readonly records: AttendanceRecordRepository,
    private readonly revisions: AttendanceRecordRevisionRepository,
  ) {}

  getRoster(
    teamId: string,
    sessionId: string,
    page: PageRequest,
  ): Promise<AttendanceSheetView> {
    return this.unitOfWork.runInTransaction(scope =>
      this.resolveRoster(scope, teamId, sessionId, page),
    );
  }

  getOwn(
    teamId: string,
    sessionId: string,
    actor: AuthUserIdentity,
  ): Promise<AttendanceView> {
    return this.unitOfWork.runInTransaction(scope =>
      this.resolveOwn(scope, teamId, sessionId, actor),
    );
  }

  getHistory(
    teamId: string,
    sessionId: string,
    membershipId: string,
  ): Promise<ListAttendanceRevisionsResult> {
    return this.unitOfWork.runInTransaction(async scope => {
      await this.lookup.requireSession(scope, teamId, sessionId);
      const items = await this.revisions.listBySessionMembership(
        scope,
        sessionId,
        membershipId,
        ATTENDANCE_HISTORY_SCAN_LIMIT,
      );
      return { items };
    });
  }

  private async resolveRoster(
    scope: TransactionScope,
    teamId: string,
    sessionId: string,
    page: PageRequest,
  ): Promise<AttendanceSheetView> {
    await this.lookup.requireSession(scope, teamId, sessionId);
    const sheet = await this.sheets.findBySession(scope, sessionId);
    const items = await this.records.listRoster(scope, teamId, sessionId, page);
    const total = await this.records.countRoster(scope, teamId);
    return toSheetView(sessionId, sheet, items, total, page);
  }

  private async resolveOwn(
    scope: TransactionScope,
    teamId: string,
    sessionId: string,
    actor: AuthUserIdentity,
  ): Promise<AttendanceView> {
    await this.lookup.requireSession(scope, teamId, sessionId);
    const membership = await this.requireOwnMembership(
      scope,
      teamId,
      actor.userId,
    );
    return this.loadOwnView(scope, sessionId, membership);
  }

  private async loadOwnView(
    scope: TransactionScope,
    sessionId: string,
    membership: MembershipRef,
  ): Promise<AttendanceView> {
    const record = await this.records.findBySessionMembership(
      scope,
      sessionId,
      membership.id,
    );
    return record === null
      ? notRecordedView(sessionId, membership.id)
      : toAttendanceView(record);
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
