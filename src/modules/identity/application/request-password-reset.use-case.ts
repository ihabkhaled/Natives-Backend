import { AppConfigService } from '@config/app-config.service';
import { CLOCK_PORT, type ClockPort } from '@core/clock/clock.port';
import {
  ID_GENERATOR_PORT,
  type IdGeneratorPort,
} from '@core/id-generator/id-generator.port';
import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { canRecoverAccount } from '../domain/user-status.policy';
import { PasswordResetTokenRepository } from '../infrastructure/password-reset-token.repository';
import { UserRepository } from '../infrastructure/user.repository';
import { normalizeEmail } from '../lib/identity.helpers';
import { hashOpaqueToken } from '../lib/token-hash';
import {
  MILLISECONDS_PER_SECOND,
  RECOVERY_ACK_MESSAGE,
  SECURE_RANDOM_PORT,
} from '../model/identity.constants';
import { SecurityEventType } from '../model/identity.enums';
import type {
  Acknowledgement,
  SecureRandomPort,
} from '../model/identity.types';
import { SecurityAuditService } from './security-audit.service';

/**
 * Requests a password reset. ALWAYS returns the same generic acknowledgement so
 * the response never reveals whether an account exists. When (and only when) an
 * active account matches, a single-use hashed reset token is minted; the
 * plaintext is delivered out-of-band and never returned.
 */
@Injectable()
export class RequestPasswordResetUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    @Inject(SECURE_RANDOM_PORT)
    private readonly secureRandom: SecureRandomPort,
    private readonly config: AppConfigService,
    private readonly users: UserRepository,
    private readonly resetTokens: PasswordResetTokenRepository,
    private readonly audit: SecurityAuditService,
  ) {}

  execute(email: string): Promise<Acknowledgement> {
    const normalized = normalizeEmail(email);
    return this.unitOfWork.runInTransaction(scope =>
      this.run(scope, normalized),
    );
  }

  private async run(
    scope: TransactionScope,
    normalizedEmail: string,
  ): Promise<Acknowledgement> {
    const user = await this.users.findActiveByEmail(scope, normalizedEmail);
    if (user === null || !canRecoverAccount(user)) {
      return { message: RECOVERY_ACK_MESSAGE };
    }
    const now = this.clock.now();
    const ttl = this.config.identity.passwordResetTtlSeconds;
    const token = this.secureRandom.generateToken();
    await this.resetTokens.insert(scope, {
      id: this.idGenerator.generate(),
      userId: user.id,
      tokenHash: hashOpaqueToken(token),
      expiresAt: new Date(now.getTime() + ttl * MILLISECONDS_PER_SECOND),
      now,
    });
    await this.audit.record(
      scope,
      SecurityEventType.PasswordResetRequested,
      user.id,
      {},
    );
    return { message: RECOVERY_ACK_MESSAGE };
  }
}
