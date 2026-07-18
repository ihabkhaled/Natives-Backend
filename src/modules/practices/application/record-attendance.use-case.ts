import type { AuthUserIdentity } from '@core/auth';
import { CLOCK_PORT, type ClockPort } from '@core/clock/clock.port';
import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { AuditRecorderService } from '@modules/platform';
import { Inject, Injectable } from '@nestjs/common';

import { AttendanceMembershipNotFoundError } from '../errors/attendance-membership-not-found.error';
import { InvalidAttendanceInputError } from '../errors/invalid-attendance-input.error';
import { AttendanceMembershipRepository } from '../infrastructure/attendance-membership.repository';
import { buildBulkAudit, buildMarkContext } from '../lib/attendance.builders';
import {
  hasDuplicateMembership,
  isMarkConsistent,
} from '../lib/attendance.helpers';
import { toAttendanceView } from '../lib/attendance.mapper';
import type {
  AttendanceMarkFields,
  AttendanceMarkInput,
  AttendanceRecord,
  AttendanceSheet,
  AttendanceView,
  BulkRecordResult,
  MembershipRef,
  RecordAttendanceCommand,
} from '../model/attendance.types';
import type { PracticeSession } from '../model/practices.types';
import { AttendanceRecorderService } from './attendance-recorder.service';
import { AttendanceSheetService } from './attendance-sheet.service';
import { PracticeLookupService } from './practice-lookup.service';

/**
 * A coach/admin records attendance for one or many participants into an OPEN sheet,
 * in one transaction. Bulk semantics are ATOMIC: the whole batch is validated (no
 * duplicate membership, each mark consistent with its status, each membership
 * active in the team) and applied together — any failure rolls the batch back, so
 * partial failures are never silently hidden. Recording never awards points.
 */
@Injectable()
export class RecordAttendanceUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    private readonly lookup: PracticeLookupService,
    private readonly sheetService: AttendanceSheetService,
    private readonly memberships: AttendanceMembershipRepository,
    private readonly recorder: AttendanceRecorderService,
    private readonly audit: AuditRecorderService,
  ) {}

  recordOne(
    actor: AuthUserIdentity,
    teamId: string,
    sessionId: string,
    membershipId: string,
    mark: AttendanceMarkFields,
  ): Promise<AttendanceView> {
    return this.unitOfWork.runInTransaction(scope =>
      this.runOne(scope, actor, teamId, sessionId, { ...mark, membershipId }),
    );
  }

  recordBulk(
    actor: AuthUserIdentity,
    teamId: string,
    sessionId: string,
    command: RecordAttendanceCommand,
  ): Promise<BulkRecordResult> {
    return this.unitOfWork.runInTransaction(scope =>
      this.runBulk(scope, actor, teamId, sessionId, command),
    );
  }

  private async runOne(
    scope: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    sessionId: string,
    mark: AttendanceMarkInput,
  ): Promise<AttendanceView> {
    const session = await this.lookup.requireSession(scope, teamId, sessionId);
    const sheet = await this.sheetService.ensureOpenSheet(
      scope,
      session,
      actor.userId,
      this.clock.now(),
    );
    const record = await this.applyMark(scope, actor, session, sheet, mark);
    return toAttendanceView(record);
  }

  private async runBulk(
    scope: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    sessionId: string,
    command: RecordAttendanceCommand,
  ): Promise<BulkRecordResult> {
    this.assertNoDuplicates(command.marks);
    const session = await this.lookup.requireSession(scope, teamId, sessionId);
    const sheet = await this.sheetService.ensureOpenSheet(
      scope,
      session,
      actor.userId,
      this.clock.now(),
    );
    const records = await this.applyMarks(
      scope,
      actor,
      session,
      sheet,
      command,
    );
    await this.audit.record(
      scope,
      buildBulkAudit(actor.userId, sheet, records.length),
    );
    return {
      items: records.map(record => toAttendanceView(record)),
      recorded: records.length,
    };
  }

  private assertNoDuplicates(marks: readonly AttendanceMarkInput[]): void {
    if (hasDuplicateMembership(marks.map(mark => mark.membershipId))) {
      throw new InvalidAttendanceInputError();
    }
  }

  private async applyMarks(
    scope: TransactionScope,
    actor: AuthUserIdentity,
    session: PracticeSession,
    sheet: AttendanceSheet,
    command: RecordAttendanceCommand,
  ): Promise<AttendanceRecord[]> {
    const records: AttendanceRecord[] = [];
    for (const mark of command.marks) {
      records.push(await this.applyMark(scope, actor, session, sheet, mark));
    }
    return records;
  }

  private async applyMark(
    scope: TransactionScope,
    actor: AuthUserIdentity,
    session: PracticeSession,
    sheet: AttendanceSheet,
    mark: AttendanceMarkInput,
  ): Promise<AttendanceRecord> {
    if (
      !isMarkConsistent(mark.status, mark.latenessMinutes, mark.excuseCategory)
    ) {
      throw new InvalidAttendanceInputError();
    }
    const membership = await this.requireMembership(
      scope,
      session.teamId,
      mark.membershipId,
    );
    return this.recorder.record(
      scope,
      buildMarkContext(
        sheet.id,
        session,
        membership,
        mark,
        actor.userId,
        this.clock.now(),
      ),
    );
  }

  private async requireMembership(
    scope: TransactionScope,
    teamId: string,
    membershipId: string,
  ): Promise<MembershipRef> {
    const membership = await this.memberships.findActiveById(
      scope,
      teamId,
      membershipId,
    );
    if (membership === null) {
      throw new AttendanceMembershipNotFoundError();
    }
    return membership;
  }
}
