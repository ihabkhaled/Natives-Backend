import {
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { PracticeSessionRepository } from '../infrastructure/practice-session.repository';
import { SessionStatusEventRepository } from '../infrastructure/session-status-event.repository';
import { HISTORY_SCAN_LIMIT } from '../model/practices.constants';
import type {
  ListSessionsResult,
  ListStatusEventsResult,
  PracticeSession,
  SessionListFilter,
} from '../model/practices.types';
import { PracticeLookupService } from './practice-lookup.service';

/**
 * Read side for practice sessions: the bounded, deterministically ordered
 * calendar/list (filtered by window/status/type/season), a single session
 * resolved within team scope, and a session's append-only status history. Team
 * scope comes from the route param the guard enforces.
 */
@Injectable()
export class SessionQueryService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    private readonly sessions: PracticeSessionRepository,
    private readonly statusEvents: SessionStatusEventRepository,
    private readonly lookup: PracticeLookupService,
  ) {}

  listSessions(
    teamId: string,
    filter: SessionListFilter,
  ): Promise<ListSessionsResult> {
    return this.unitOfWork.runInTransaction(scope =>
      this.sessions.list(scope, teamId, filter),
    );
  }

  getSession(teamId: string, sessionId: string): Promise<PracticeSession> {
    return this.unitOfWork.runInTransaction(scope =>
      this.lookup.requireSession(scope, teamId, sessionId),
    );
  }

  listHistory(
    teamId: string,
    sessionId: string,
  ): Promise<ListStatusEventsResult> {
    return this.unitOfWork.runInTransaction(async scope => {
      await this.lookup.requireSession(scope, teamId, sessionId);
      const items = await this.statusEvents.listBySession(
        scope,
        sessionId,
        HISTORY_SCAN_LIMIT,
      );
      return { items };
    });
  }
}
