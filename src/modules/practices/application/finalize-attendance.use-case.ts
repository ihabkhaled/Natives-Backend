import type { AuthUserIdentity } from '@core/auth';
import { CLOCK_PORT, type ClockPort } from '@core/clock/clock.port';
import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import {
  AuditRecorderService,
  RecordDomainEventService,
} from '@modules/platform';
import { Inject, Injectable } from '@nestjs/common';

import { canFinalize } from '../domain/attendance.state-machine';
import { InvalidAttendanceTransitionError } from '../errors/invalid-attendance-transition.error';
import { OptimisticConflictError } from '../errors/optimistic-conflict.error';
import { AttendanceRecordRepository } from '../infrastructure/attendance-record.repository';
import { AttendanceSheetRepository } from '../infrastructure/attendance-sheet.repository';
import {
  buildFinalizeAudit,
  buildFinalizedEvent,
  buildSheetFinalize,
} from '../lib/attendance.builders';
import { toSheetStatusView } from '../lib/attendance.mapper';
import type {
  AttendanceSheet,
  AttendanceSheetStatusView,
  FinalizeAttendanceCommand,
} from '../model/attendance.types';
import { AttendanceSheetService } from './attendance-sheet.service';
import { PracticeLookupService } from './practice-lookup.service';

/**
 * Finalizes (locks) a session's attendance sheet: OPEN → FINALIZED under optimistic
 * concurrency, validated by the pure state machine. In one transaction it flips the
 * state, writes an audit row, and enqueues a versioned `attendance.finalized` event
 * to the transactional outbox. After finalization, changes require an audited
 * correction — the sheet is never silently editable.
 */
@Injectable()
export class FinalizeAttendanceUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    private readonly lookup: PracticeLookupService,
    private readonly sheetService: AttendanceSheetService,
    private readonly sheets: AttendanceSheetRepository,
    private readonly records: AttendanceRecordRepository,
    private readonly audit: AuditRecorderService,
    private readonly events: RecordDomainEventService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    sessionId: string,
    command: FinalizeAttendanceCommand,
  ): Promise<AttendanceSheetStatusView> {
    return this.unitOfWork.runInTransaction(scope =>
      this.run(scope, actor, teamId, sessionId, command),
    );
  }

  private async run(
    scope: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    sessionId: string,
    command: FinalizeAttendanceCommand,
  ): Promise<AttendanceSheetStatusView> {
    await this.lookup.requireSession(scope, teamId, sessionId);
    const sheet = await this.sheetService.requireSheet(scope, sessionId);
    if (!canFinalize(sheet.state)) {
      throw new InvalidAttendanceTransitionError();
    }
    const finalized = await this.finalize(scope, sheet, command, actor);
    return this.record(scope, actor, finalized, sessionId);
  }

  private async finalize(
    scope: TransactionScope,
    sheet: AttendanceSheet,
    command: FinalizeAttendanceCommand,
    actor: AuthUserIdentity,
  ): Promise<AttendanceSheet> {
    const finalized = await this.sheets.finalize(
      scope,
      buildSheetFinalize(
        sheet.id,
        command.expectedVersion,
        actor.userId,
        this.clock.now(),
      ),
    );
    if (finalized === null) {
      throw new OptimisticConflictError();
    }
    return finalized;
  }

  private async record(
    scope: TransactionScope,
    actor: AuthUserIdentity,
    finalized: AttendanceSheet,
    sessionId: string,
  ): Promise<AttendanceSheetStatusView> {
    const recordCount = await this.records.countBySession(scope, sessionId);
    await this.audit.record(scope, buildFinalizeAudit(actor.userId, finalized));
    await this.events.enqueue(
      scope,
      buildFinalizedEvent(actor.userId, finalized, recordCount),
    );
    return toSheetStatusView(finalized, recordCount);
  }
}
