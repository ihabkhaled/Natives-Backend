import { CLOCK_PORT, type ClockPort } from '@core/clock/clock.port';
import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { SessionContextRequiredError } from '../errors/session-context-required.error';
import { RefreshSessionRepository } from '../infrastructure/refresh-session.repository';
import { SecurityEventType } from '../model/identity.enums';
import type { RevokeOtherSessionsResult } from '../model/identity.types';
import { SecurityAuditService } from './security-audit.service';

@Injectable()
export class RevokeOtherSessionsUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    private readonly sessions: RefreshSessionRepository,
    private readonly audit: SecurityAuditService,
  ) {}

  execute(
    userId: string,
    currentSessionId: string | undefined,
  ): Promise<RevokeOtherSessionsResult> {
    if (currentSessionId === undefined) {
      return Promise.reject(new SessionContextRequiredError());
    }
    return this.unitOfWork.runInTransaction(scope =>
      this.run(scope, userId, currentSessionId),
    );
  }

  private async run(
    scope: TransactionScope,
    userId: string,
    currentSessionId: string,
  ): Promise<RevokeOtherSessionsResult> {
    const revoked = await this.sessions.revokeOthersForUser(
      scope,
      userId,
      currentSessionId,
      this.clock.now(),
    );
    await this.audit.record(
      scope,
      SecurityEventType.OtherSessionsRevoked,
      userId,
      { currentSessionId, revoked },
    );
    return { revokedCount: revoked };
  }
}
