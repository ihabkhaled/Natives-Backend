import type { AuthUserIdentity } from '@core/auth';
import { CLOCK_PORT, type ClockPort } from '@core/clock/clock.port';
import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { resolveCheckInWindow } from '../domain/check-in-window.policy';
import { AttendanceNotMemberError } from '../errors/attendance-not-member.error';
import { CheckInWindowClosedError } from '../errors/check-in-window-closed.error';
import { AttendanceMembershipRepository } from '../infrastructure/attendance-membership.repository';
import { AttendanceRecordRepository } from '../infrastructure/attendance-record.repository';
import { buildCheckInContext } from '../lib/attendance.builders';
import { deriveCheckInStatus } from '../lib/attendance.helpers';
import { toAttendanceView } from '../lib/attendance.mapper';
import { CheckInWindowState } from '../model/attendance.enums';
import type {
  AttendanceView,
  MembershipRef,
  SelfCheckInCommand,
} from '../model/attendance.types';
import type { PracticeSession } from '../model/practices.types';
import { AttendanceRecorderService } from './attendance-recorder.service';
import { AttendanceSheetService } from './attendance-sheet.service';
import { PracticeLookupService } from './practice-lookup.service';

/**
 * A member checks THEMSELVES in for a session. The status is derived from the clock
 * (on-time vs present-late with measured lateness) — never trusted from the client —
 * and the caller must have an active membership in the team. Idempotent: an
 * existing record for (session, own membership) is returned unchanged, never
 * overwritten — a repeat POST is a no-op and a coach-recorded mark is protected.
 * A new check-in must fall inside the explicit window (opens `startsAt − 60 min`,
 * closes at the session end; only published/rescheduled sessions). It enlists in
 * one transaction, refuses a finalized (locked) sheet, and records intent-free
 * facts: self check-in is attendance, distinct from RSVP, and never awards points.
 */
@Injectable()
export class SelfCheckInUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    private readonly lookup: PracticeLookupService,
    private readonly sheetService: AttendanceSheetService,
    private readonly memberships: AttendanceMembershipRepository,
    private readonly records: AttendanceRecordRepository,
    private readonly recorder: AttendanceRecorderService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    sessionId: string,
    command: SelfCheckInCommand,
  ): Promise<AttendanceView> {
    return this.unitOfWork.runInTransaction(scope =>
      this.run(scope, actor, teamId, sessionId, command),
    );
  }

  private async run(
    scope: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    sessionId: string,
    command: SelfCheckInCommand,
  ): Promise<AttendanceView> {
    const session = await this.lookup.requireSession(scope, teamId, sessionId);
    const membership = await this.requireMembership(
      scope,
      teamId,
      actor.userId,
    );
    const existing = await this.records.findBySessionMembership(
      scope,
      session.id,
      membership.id,
    );
    if (existing !== null) {
      return toAttendanceView(existing);
    }
    this.assertWindowOpen(session);
    return this.persistCheckIn(scope, session, membership, command, actor);
  }

  private assertWindowOpen(session: PracticeSession): void {
    const window = resolveCheckInWindow(session, this.clock.now());
    if (window.state !== CheckInWindowState.Open) {
      throw new CheckInWindowClosedError();
    }
  }

  private async persistCheckIn(
    scope: TransactionScope,
    session: PracticeSession,
    membership: MembershipRef,
    command: SelfCheckInCommand,
    actor: AuthUserIdentity,
  ): Promise<AttendanceView> {
    const now = this.clock.now();
    const sheet = await this.sheetService.ensureOpenSheet(
      scope,
      session,
      actor.userId,
      now,
    );
    const record = await this.recorder.record(
      scope,
      buildCheckInContext(
        sheet.id,
        session,
        membership,
        deriveCheckInStatus(now, session.startsAt),
        command.note,
        actor.userId,
        now,
      ),
    );
    return toAttendanceView(record);
  }

  private async requireMembership(
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
