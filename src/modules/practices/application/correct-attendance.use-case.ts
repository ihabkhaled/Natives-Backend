import type { AuthUserIdentity } from '@core/auth';
import { CLOCK_PORT, type ClockPort } from '@core/clock/clock.port';
import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { RecordDomainEventService } from '@modules/platform';
import { Inject, Injectable } from '@nestjs/common';

import { canCorrect } from '../domain/attendance.state-machine';
import { AttendanceMembershipNotFoundError } from '../errors/attendance-membership-not-found.error';
import { InvalidAttendanceInputError } from '../errors/invalid-attendance-input.error';
import { InvalidAttendanceTransitionError } from '../errors/invalid-attendance-transition.error';
import { AttendanceMembershipRepository } from '../infrastructure/attendance-membership.repository';
import { AttendanceSheetRepository } from '../infrastructure/attendance-sheet.repository';
import {
  buildCorrectedEvent,
  buildCorrectionContext,
  buildSheetCorrection,
} from '../lib/attendance.builders';
import { isMarkConsistent } from '../lib/attendance.helpers';
import { toAttendanceView } from '../lib/attendance.mapper';
import type {
  AttendanceRecord,
  AttendanceSheet,
  AttendanceView,
  CorrectAttendanceCommand,
  MembershipRef,
} from '../model/attendance.types';
import type { PracticeSession } from '../model/practices.types';
import { AttendanceRecorderService } from './attendance-recorder.service';
import { AttendanceSheetService } from './attendance-sheet.service';
import { PracticeLookupService } from './practice-lookup.service';

/**
 * Privileged correction of one participant's attendance AFTER finalization. The
 * sheet must be FINALIZED or already CORRECTED (validated by the pure state
 * machine); the correction upserts the record under optimistic concurrency, appends
 * an immutable revision carrying the mandatory reason, moves the sheet to CORRECTED,
 * and enqueues a versioned `attendance.corrected` event — all in one transaction.
 */
@Injectable()
export class CorrectAttendanceUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    private readonly lookup: PracticeLookupService,
    private readonly sheetService: AttendanceSheetService,
    private readonly sheets: AttendanceSheetRepository,
    private readonly memberships: AttendanceMembershipRepository,
    private readonly recorder: AttendanceRecorderService,
    private readonly events: RecordDomainEventService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    sessionId: string,
    membershipId: string,
    command: CorrectAttendanceCommand,
  ): Promise<AttendanceView> {
    return this.unitOfWork.runInTransaction(scope =>
      this.run(scope, actor, teamId, sessionId, membershipId, command),
    );
  }

  private async run(
    scope: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    sessionId: string,
    membershipId: string,
    command: CorrectAttendanceCommand,
  ): Promise<AttendanceView> {
    const session = await this.lookup.requireSession(scope, teamId, sessionId);
    const sheet = await this.sheetService.requireSheet(scope, sessionId);
    this.assertCorrectable(sheet, command);
    const membership = await this.requireMembership(
      scope,
      teamId,
      membershipId,
    );
    const record = await this.applyCorrection(
      scope,
      actor,
      session,
      sheet,
      membership,
      command,
    );
    await this.finishCorrection(scope, actor, sheet, record);
    return toAttendanceView(record);
  }

  private assertCorrectable(
    sheet: AttendanceSheet,
    command: CorrectAttendanceCommand,
  ): void {
    if (!canCorrect(sheet.state)) {
      throw new InvalidAttendanceTransitionError();
    }
    if (
      !isMarkConsistent(
        command.status,
        command.latenessMinutes,
        command.excuseCategory,
      )
    ) {
      throw new InvalidAttendanceInputError();
    }
  }

  private applyCorrection(
    scope: TransactionScope,
    actor: AuthUserIdentity,
    session: PracticeSession,
    sheet: AttendanceSheet,
    membership: MembershipRef,
    command: CorrectAttendanceCommand,
  ): Promise<AttendanceRecord> {
    return this.recorder.record(
      scope,
      buildCorrectionContext(
        sheet.id,
        session,
        membership,
        command,
        actor.userId,
        this.clock.now(),
      ),
    );
  }

  private async finishCorrection(
    scope: TransactionScope,
    actor: AuthUserIdentity,
    sheet: AttendanceSheet,
    record: AttendanceRecord,
  ): Promise<void> {
    const corrected = await this.sheets.applyCorrection(
      scope,
      buildSheetCorrection(sheet.id, actor.userId, this.clock.now()),
    );
    if (corrected === null) {
      throw new InvalidAttendanceTransitionError();
    }
    await this.events.enqueue(
      scope,
      buildCorrectedEvent(actor.userId, corrected, record),
    );
  }

  private async requireMembership(
    scope: TransactionScope,
    teamId: string,
    membershipId: string,
  ): Promise<MembershipRef> {
    const membership = await this.memberships.findByIdInTeam(
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
