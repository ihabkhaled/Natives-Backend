import { CLOCK_PORT, type ClockPort } from '@core/clock/clock.port';
import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { PracticeDashboardRepository } from '../infrastructure/practice-dashboard.repository';
import {
  latestAttendanceInstant,
  toAttendanceStatusCount,
  toCountSignal,
  toUpcomingSession,
} from '../lib/signals.mapper';
import type { AttendanceStatusCountRow } from '../model/signals.rows';
import type {
  PracticeDashboardSignals,
  PracticeSignalScope,
} from '../model/signals.types';

/**
 * Public practices surface for dashboard projections. Returns the upcoming
 * published sessions (with the viewer's RSVP state), the viewer's attendance
 * status counts, and the two coach-facing backlogs — all as bounded aggregates
 * measured against one clock reading, so every derived widget can state a
 * consistent as-of time. Read-only: nothing here is stored or editable.
 */
@Injectable()
export class PracticeDashboardSignalsService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    private readonly repository: PracticeDashboardRepository,
  ) {}

  collect(scope: PracticeSignalScope): Promise<PracticeDashboardSignals> {
    const now = this.clock.now();
    return this.unitOfWork.runInTransaction(tx => this.read(tx, scope, now));
  }

  private async read(
    tx: TransactionScope,
    scope: PracticeSignalScope,
    now: Date,
  ): Promise<PracticeDashboardSignals> {
    const attendance = await this.readAttendance(tx, scope);
    return {
      ...(await this.readTeamBacklogs(tx, scope.teamId, now)),
      upcomingSessions: await this.readUpcoming(tx, scope, now),
      attendanceCounts: attendance.map(row => toAttendanceStatusCount(row)),
      attendanceAsOf: latestAttendanceInstant(attendance),
    };
  }

  private async readUpcoming(
    tx: TransactionScope,
    scope: PracticeSignalScope,
    now: Date,
  ): Promise<PracticeDashboardSignals['upcomingSessions']> {
    const rows = await this.repository.listUpcomingSessions(
      tx,
      scope.teamId,
      scope.membershipId,
      now,
    );
    return rows.map(row => toUpcomingSession(row));
  }

  private async readTeamBacklogs(
    tx: TransactionScope,
    teamId: string,
    now: Date,
  ): Promise<
    Pick<PracticeDashboardSignals, 'draftSessions' | 'openAttendanceSheets'>
  > {
    const drafts = await this.repository.countDraftSessions(tx, teamId, now);
    const sheets = await this.repository.countOpenAttendanceSheets(
      tx,
      teamId,
      now,
    );
    return {
      draftSessions: toCountSignal(drafts),
      openAttendanceSheets: toCountSignal(sheets),
    };
  }

  private readAttendance(
    tx: TransactionScope,
    scope: PracticeSignalScope,
  ): Promise<AttendanceStatusCountRow[]> {
    if (scope.membershipId === null) {
      return Promise.resolve([]);
    }
    return this.repository.listAttendanceCounts(
      tx,
      scope.teamId,
      scope.membershipId,
    );
  }
}
