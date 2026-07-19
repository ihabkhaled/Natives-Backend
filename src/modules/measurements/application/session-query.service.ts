import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { MeasurementSessionNotFoundError } from '../errors/measurement-session-not-found.error';
import { MeasurementAttemptRepository } from '../infrastructure/measurement-attempt.repository';
import { MeasurementSessionRepository } from '../infrastructure/measurement-session.repository';
import type {
  PageRequest,
  SessionDetail,
  SessionPage,
} from '../model/measurements.types';

/**
 * Read side of measurement sessions (analytics.read.team). Lists are one bounded,
 * deterministically ordered page per transaction; detail resolves a non-deleted
 * session with its attempts or a 404 that hides existence.
 */
@Injectable()
export class SessionQueryService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    private readonly sessions: MeasurementSessionRepository,
    private readonly attempts: MeasurementAttemptRepository,
  ) {}

  listForTeam(teamId: string, page: PageRequest): Promise<SessionPage> {
    return this.unitOfWork.runInTransaction(tx =>
      this.teamPage(tx, teamId, page),
    );
  }

  getDetail(teamId: string, sessionId: string): Promise<SessionDetail> {
    return this.unitOfWork.runInTransaction(tx =>
      this.detail(tx, teamId, sessionId),
    );
  }

  private async teamPage(
    tx: TransactionScope,
    teamId: string,
    page: PageRequest,
  ): Promise<SessionPage> {
    const items = await this.sessions.listForTeam(tx, teamId, page);
    const total = await this.sessions.countForTeam(tx, teamId);
    return { items, total, limit: page.limit, offset: page.offset };
  }

  private async detail(
    tx: TransactionScope,
    teamId: string,
    sessionId: string,
  ): Promise<SessionDetail> {
    const session = await this.sessions.findForWrite(tx, teamId, sessionId);
    if (session === null) {
      throw new MeasurementSessionNotFoundError();
    }
    return {
      session,
      attempts: await this.attempts.listForSession(tx, sessionId),
    };
  }
}
