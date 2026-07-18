import { CLOCK_PORT, type ClockPort } from '@core/clock/clock.port';
import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import {
  isSessionActive,
  isSessionReuse,
} from '../domain/refresh-session.policy';
import { canAuthenticate } from '../domain/user-status.policy';
import { InvalidRefreshTokenError } from '../errors/invalid-refresh-token.error';
import { RefreshSessionRepository } from '../infrastructure/refresh-session.repository';
import { UserRepository } from '../infrastructure/user.repository';
import { hashOpaqueToken } from '../lib/token-hash';
import { SecurityEventType } from '../model/identity.enums';
import type {
  IssuedSession,
  RefreshCommand,
  RefreshSession,
  SessionOutcome,
} from '../model/identity.types';
import { SecurityAuditService } from './security-audit.service';
import { SessionIssuerService } from './session-issuer.service';

/**
 * Rotates a refresh session. Presenting a live token revokes it and issues a
 * successor in the same family. Presenting an already-rotated or revoked token
 * is reuse: the entire token family is revoked and a security event recorded.
 * Denials commit their revocation/audit and then surface a generic error, so the
 * revocation is never rolled back by the thrown error. FOR UPDATE gives race
 * safety.
 */
@Injectable()
export class RefreshSessionUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    private readonly sessions: RefreshSessionRepository,
    private readonly users: UserRepository,
    private readonly audit: SecurityAuditService,
    private readonly sessionIssuer: SessionIssuerService,
  ) {}

  async execute(command: RefreshCommand): Promise<IssuedSession> {
    const outcome = await this.unitOfWork.runInTransaction(scope =>
      this.run(scope, command),
    );
    if (outcome.kind === 'denied') {
      throw new InvalidRefreshTokenError();
    }
    return outcome.session;
  }

  private async run(
    scope: TransactionScope,
    command: RefreshCommand,
  ): Promise<SessionOutcome> {
    const now = this.clock.now();
    const session = await this.sessions.findByTokenHashForUpdate(
      scope,
      hashOpaqueToken(command.refreshToken),
    );
    if (session === null) {
      return { kind: 'denied' };
    }
    if (isSessionReuse(session)) {
      await this.denyForReuse(scope, session, now);
      return { kind: 'denied' };
    }
    if (!isSessionActive(session, now)) {
      return { kind: 'denied' };
    }
    return this.rotate(scope, session, command, now);
  }

  private async rotate(
    scope: TransactionScope,
    session: RefreshSession,
    command: RefreshCommand,
    now: Date,
  ): Promise<SessionOutcome> {
    const user = await this.users.findById(scope, session.userId);
    if (user === null || !canAuthenticate(user)) {
      await this.sessions.revokeById(scope, session.id, now);
      return { kind: 'denied' };
    }
    await this.sessions.markRotated(scope, session.id, now);
    await this.audit.record(scope, SecurityEventType.TokenRefreshed, user.id, {
      familyId: session.familyId,
    });
    const issued = await this.sessionIssuer.issue(
      scope,
      user,
      command.deviceLabel,
      session.familyId,
    );
    return { kind: 'issued', session: issued };
  }

  private async denyForReuse(
    scope: TransactionScope,
    session: RefreshSession,
    now: Date,
  ): Promise<void> {
    await this.sessions.revokeFamilyForReuse(scope, session.familyId, now);
    await this.audit.record(
      scope,
      SecurityEventType.RefreshReuseDetected,
      session.userId,
      { familyId: session.familyId },
    );
  }
}
