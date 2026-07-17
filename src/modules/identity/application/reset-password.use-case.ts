import { CLOCK_PORT, type ClockPort } from '@core/clock/clock.port';
import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { PASSWORD_HASH_PORT, type PasswordHashPort } from '@modules/auth';
import { Inject, Injectable } from '@nestjs/common';

import { isResetTokenUsable } from '../domain/password-reset.policy';
import { ResetTokenInvalidError } from '../errors/reset-token-invalid.error';
import { PasswordCredentialRepository } from '../infrastructure/password-credential.repository';
import { PasswordResetTokenRepository } from '../infrastructure/password-reset-token.repository';
import { RefreshSessionRepository } from '../infrastructure/refresh-session.repository';
import { hashOpaqueToken } from '../lib/token-hash';
import { RESET_ACK_MESSAGE } from '../model/identity.constants';
import { SecurityEventType } from '../model/identity.enums';
import type {
  Acknowledgement,
  ResetPasswordCommand,
} from '../model/identity.types';
import { SecurityAuditService } from './security-audit.service';

/**
 * Consumes a single-use password-reset token atomically (locked FOR UPDATE):
 * verifies it is unconsumed and unexpired, marks it consumed, replaces the
 * password credential, and revokes ALL of the user's sessions so a leaked
 * password cannot outlive the reset. Generic error on any invalid token.
 */
@Injectable()
export class ResetPasswordUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(PASSWORD_HASH_PORT)
    private readonly passwordHash: PasswordHashPort,
    private readonly resetTokens: PasswordResetTokenRepository,
    private readonly credentials: PasswordCredentialRepository,
    private readonly sessions: RefreshSessionRepository,
    private readonly audit: SecurityAuditService,
  ) {}

  execute(command: ResetPasswordCommand): Promise<Acknowledgement> {
    return this.unitOfWork.runInTransaction(scope => this.run(scope, command));
  }

  private async run(
    scope: TransactionScope,
    command: ResetPasswordCommand,
  ): Promise<Acknowledgement> {
    const now = this.clock.now();
    const token = await this.resetTokens.findByTokenHashForUpdate(
      scope,
      hashOpaqueToken(command.token),
    );
    if (token === null || !isResetTokenUsable(token, now)) {
      throw new ResetTokenInvalidError();
    }
    await this.resetTokens.markConsumed(scope, token.id, now);
    const passwordHash = await this.passwordHash.hash(command.password);
    await this.credentials.replaceForUser(
      scope,
      token.userId,
      passwordHash,
      now,
    );
    await this.sessions.revokeAllForUser(scope, token.userId, now);
    await this.audit.record(
      scope,
      SecurityEventType.PasswordResetCompleted,
      token.userId,
      {},
    );
    return { message: RESET_ACK_MESSAGE };
  }
}
