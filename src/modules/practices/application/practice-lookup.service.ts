import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { PracticeScheduleNotFoundError } from '../errors/practice-schedule-not-found.error';
import { PracticeSessionNotFoundError } from '../errors/practice-session-not-found.error';
import { PracticeScheduleRepository } from '../infrastructure/practice-schedule.repository';
import { PracticeSessionRepository } from '../infrastructure/practice-session.repository';
import type {
  PracticeSchedule,
  PracticeSession,
} from '../model/practices.types';

/**
 * Shared read guards for team-scoped practice writes: resolve a schedule or
 * session within the caller's transaction and team scope, or raise a not-found
 * error. A record in another team resolves to not-found, hiding cross-team
 * existence.
 */
@Injectable()
export class PracticeLookupService {
  constructor(
    private readonly schedules: PracticeScheduleRepository,
    private readonly sessions: PracticeSessionRepository,
  ) {}

  async requireSchedule(
    scope: TransactionScope,
    teamId: string,
    scheduleId: string,
  ): Promise<PracticeSchedule> {
    const schedule = await this.schedules.findByIdInTeam(
      scope,
      teamId,
      scheduleId,
    );
    if (schedule === null) {
      throw new PracticeScheduleNotFoundError();
    }
    return schedule;
  }

  async requireSession(
    scope: TransactionScope,
    teamId: string,
    sessionId: string,
  ): Promise<PracticeSession> {
    const session = await this.sessions.findByIdInTeam(
      scope,
      teamId,
      sessionId,
    );
    if (session === null) {
      throw new PracticeSessionNotFoundError();
    }
    return session;
  }
}
