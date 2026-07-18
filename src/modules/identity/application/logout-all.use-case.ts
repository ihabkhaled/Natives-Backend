import { CLOCK_PORT, type ClockPort } from '@core/clock/clock.port';
import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { RefreshSessionRepository } from '../infrastructure/refresh-session.repository';
import { LOGOUT_ALL_ACK_MESSAGE } from '../model/identity.constants';
import { SecurityEventType } from '../model/identity.enums';
import type { Acknowledgement } from '../model/identity.types';
import { SecurityAuditService } from './security-audit.service';

/**
 * Revokes every live session for the caller (all token families). Used for
 * "sign out everywhere" and forced global logout. Returns a generic
 * acknowledgement with no session detail.
 */
@Injectable()
export class LogoutAllUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    private readonly sessions: RefreshSessionRepository,
    private readonly audit: SecurityAuditService,
  ) {}

  execute(userId: string): Promise<Acknowledgement> {
    return this.unitOfWork.runInTransaction(scope => this.run(scope, userId));
  }

  private async run(
    scope: TransactionScope,
    userId: string,
  ): Promise<Acknowledgement> {
    const revoked = await this.sessions.revokeAllForUser(
      scope,
      userId,
      this.clock.now(),
    );
    await this.audit.record(
      scope,
      SecurityEventType.AllSessionsRevoked,
      userId,
      { revoked },
    );
    return { message: LOGOUT_ALL_ACK_MESSAGE };
  }
}
