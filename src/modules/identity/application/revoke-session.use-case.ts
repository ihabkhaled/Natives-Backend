import { CLOCK_PORT, type ClockPort } from '@core/clock/clock.port';
import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { SessionNotFoundError } from '../errors/session-not-found.error';
import { RefreshSessionRepository } from '../infrastructure/refresh-session.repository';
import { LOGOUT_ACK_MESSAGE } from '../model/identity.constants';
import { SecurityEventType } from '../model/identity.enums';
import type { Acknowledgement } from '../model/identity.types';
import { SecurityAuditService } from './security-audit.service';

@Injectable()
export class RevokeSessionUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    private readonly sessions: RefreshSessionRepository,
    private readonly audit: SecurityAuditService,
  ) {}

  execute(userId: string, sessionId: string): Promise<Acknowledgement> {
    return this.unitOfWork.runInTransaction(scope =>
      this.run(scope, userId, sessionId),
    );
  }

  private async run(
    scope: TransactionScope,
    userId: string,
    sessionId: string,
  ): Promise<Acknowledgement> {
    const revoked = await this.sessions.revokeOwnedById(
      scope,
      userId,
      sessionId,
      this.clock.now(),
    );
    if (!revoked) {
      throw new SessionNotFoundError();
    }
    await this.audit.record(scope, SecurityEventType.SessionRevoked, userId, {
      sessionId,
    });
    return { message: LOGOUT_ACK_MESSAGE };
  }
}
