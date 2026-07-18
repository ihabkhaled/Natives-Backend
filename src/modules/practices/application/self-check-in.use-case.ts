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
import { buildCheckInContext } from '../lib/attendance.builders';
import { deriveCheckInStatus } from '../lib/attendance.helpers';
import { toAttendanceView } from '../lib/attendance.mapper';
import type {
  AttendanceView,
  MembershipRef,
  SelfCheckInCommand,
} from '../model/attendance.types';
import { AttendanceRecorderService } from './attendance-recorder.service';
import { AttendanceSheetService } from './attendance-sheet.service';
import { PracticeLookupService } from './practice-lookup.service';

/**
 * A member checks THEMSELVES in for a session. The status is derived from the clock
 * (on-time vs present-late with measured lateness) — never trusted from the client —
 * and the caller must have an active membership in the team. It enlists in one
 * transaction, refuses a finalized (locked) sheet, and records intent-free facts:
 * self check-in is attendance, distinct from RSVP, and never awards points.
 */
@Injectable()
export class SelfCheckInUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    private readonly lookup: PracticeLookupService,
    private readonly sheetService: AttendanceSheetService,
    private readonly memberships: AttendanceMembershipRepository,
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
