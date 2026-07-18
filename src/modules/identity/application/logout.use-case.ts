import { CLOCK_PORT, type ClockPort } from '@core/clock/clock.port';
import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { RefreshSessionRepository } from '../infrastructure/refresh-session.repository';
import { hashOpaqueToken } from '../lib/token-hash';
import { LOGOUT_ACK_MESSAGE } from '../model/identity.constants';
import { SecurityEventType } from '../model/identity.enums';
import type { Acknowledgement } from '../model/identity.types';
import { SecurityAuditService } from './security-audit.service';

/**
 * Revokes the caller's current session identified by the presented refresh
 * token. Idempotent and ownership-scoped: an unknown token or one belonging to
 * another user is a silent no-op, and the response is always a generic
 * acknowledgement.
 */
@Injectable()
export class LogoutUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    private readonly sessions: RefreshSessionRepository,
    private readonly audit: SecurityAuditService,
  ) {}

  execute(userId: string, refreshToken: string): Promise<Acknowledgement> {
    return this.unitOfWork.runInTransaction(scope =>
      this.run(scope, userId, refreshToken),
    );
  }

  private async run(
    scope: TransactionScope,
    userId: string,
    refreshToken: string,
  ): Promise<Acknowledgement> {
    const session = await this.sessions.findByTokenHashForUpdate(
      scope,
      hashOpaqueToken(refreshToken),
    );
    if (session !== null && session.userId === userId) {
      await this.sessions.revokeById(scope, session.id, this.clock.now());
      await this.audit.record(scope, SecurityEventType.SessionRevoked, userId, {
        sessionId: session.id,
      });
    }
    return { message: LOGOUT_ACK_MESSAGE };
  }
}
