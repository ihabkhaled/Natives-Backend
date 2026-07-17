import { AppConfigService } from '@config/app-config.service';
import { AUTH_TOKEN_PORT, type AuthTokenPort } from '@core/auth';
import { CLOCK_PORT, type ClockPort } from '@core/clock/clock.port';
import {
  ID_GENERATOR_PORT,
  type IdGeneratorPort,
} from '@core/id-generator/id-generator.port';
import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { RefreshSessionRepository } from '../infrastructure/refresh-session.repository';
import { toAuthUserIdentity } from '../lib/identity.mapper';
import { hashOpaqueToken } from '../lib/token-hash';
import {
  MILLISECONDS_PER_SECOND,
  SECURE_RANDOM_PORT,
} from '../model/identity.constants';
import type {
  IssuedSession,
  NewRefreshSession,
  RefreshSessionDraft,
  SecureRandomPort,
  User,
} from '../model/identity.types';

/**
 * Issues a new session: persists a hashed refresh token in the given token
 * family and signs a short-lived access token. The plaintext refresh token is
 * returned to the caller once and never stored. Runs inside the caller's
 * transaction scope.
 */
@Injectable()
export class SessionIssuerService {
  constructor(
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    @Inject(SECURE_RANDOM_PORT)
    private readonly secureRandom: SecureRandomPort,
    @Inject(AUTH_TOKEN_PORT) private readonly tokenPort: AuthTokenPort,
    private readonly sessions: RefreshSessionRepository,
    private readonly config: AppConfigService,
  ) {}

  async issue(
    scope: TransactionScope,
    user: User,
    deviceLabel: string | null,
    familyId: string,
  ): Promise<IssuedSession> {
    const draft = this.buildDraft(user, deviceLabel, familyId);
    await this.sessions.insert(scope, draft.record);
    const accessToken = await this.tokenPort.sign(toAuthUserIdentity(user));
    return {
      accessToken,
      refreshToken: draft.token,
      refreshTokenExpiresAt: draft.record.expiresAt,
      userId: user.id,
    };
  }

  private buildDraft(
    user: User,
    deviceLabel: string | null,
    familyId: string,
  ): RefreshSessionDraft {
    const token = this.secureRandom.generateToken();
    return {
      token,
      record: this.buildRecord(token, user, deviceLabel, familyId),
    };
  }

  private buildRecord(
    token: string,
    user: User,
    deviceLabel: string | null,
    familyId: string,
  ): NewRefreshSession {
    const now = this.clock.now();
    const ttl = this.config.identity.refreshTokenTtlSeconds;
    return {
      id: this.idGenerator.generate(),
      userId: user.id,
      tokenHash: hashOpaqueToken(token),
      familyId,
      deviceLabel,
      issuedAt: now,
      expiresAt: new Date(now.getTime() + ttl * MILLISECONDS_PER_SECOND),
    };
  }
}
