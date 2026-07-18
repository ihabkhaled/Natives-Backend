import { AppConfigService } from '@config/app-config.service';
import {
  EFFECTIVE_PERMISSION_RESOLVER_PORT,
  type EffectivePermissionResolverPort,
} from '@core/auth';
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
import { PASSWORD_HASH_PORT, type PasswordHashPort } from '@modules/auth';
import { Inject, Injectable } from '@nestjs/common';

import {
  computeFailedLoginDecision,
  isLockedOut,
} from '../domain/failed-login.policy';
import { canAuthenticate } from '../domain/user-status.policy';
import { InvalidCredentialsError } from '../errors/invalid-credentials.error';
import { FailedLoginStateRepository } from '../infrastructure/failed-login-state.repository';
import { UserRepository } from '../infrastructure/user.repository';
import { normalizeEmail } from '../lib/identity.helpers';
import { buildLoginResponse, toAuthUserIdentity } from '../lib/identity.mapper';
import { DUMMY_PASSWORD_HASH } from '../model/identity.constants';
import { SecurityEventType } from '../model/identity.enums';
import type {
  FailedLoginState,
  LoginCommand,
  LoginOutcome,
  LoginResponse,
  User,
  UserWithCredential,
} from '../model/identity.types';
import { SecurityAuditService } from './security-audit.service';
import { SessionIssuerService } from './session-issuer.service';

/**
 * Authenticates a login. Verifies the password against a fixed dummy hash when
 * no credential exists (constant-time anti-enumeration), enforces per-identity
 * lockout, and returns an identical generic error for every failure mode. On
 * success it clears the failure counter, audits, and issues a session.
 */
@Injectable()
export class LoginUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    @Inject(PASSWORD_HASH_PORT)
    private readonly passwordHash: PasswordHashPort,
    @Inject(EFFECTIVE_PERMISSION_RESOLVER_PORT)
    private readonly permissionResolver: EffectivePermissionResolverPort,
    private readonly config: AppConfigService,
    private readonly users: UserRepository,
    private readonly failedLogins: FailedLoginStateRepository,
    private readonly audit: SecurityAuditService,
    private readonly sessionIssuer: SessionIssuerService,
  ) {}

  async execute(command: LoginCommand): Promise<LoginResponse> {
    const email = normalizeEmail(command.email);
    const outcome = await this.unitOfWork.runInTransaction(scope =>
      this.run(scope, command, email),
    );
    if (outcome.kind === 'denied') {
      throw new InvalidCredentialsError();
    }
    const permissions = await this.resolvePermissions(outcome.user);
    return buildLoginResponse(outcome.session, outcome.user, permissions);
  }

  private async resolvePermissions(user: User): Promise<readonly string[]> {
    const granted = await this.permissionResolver.resolve(
      toAuthUserIdentity(user),
      {},
    );
    return [...granted].sort();
  }

  private async run(
    scope: TransactionScope,
    command: LoginCommand,
    email: string,
  ): Promise<LoginOutcome> {
    const now = this.clock.now();
    const state = await this.failedLogins.findByEmailForUpdate(scope, email);
    if (state !== null && isLockedOut(state, now)) {
      return { kind: 'denied' };
    }
    const found = await this.users.findWithCredentialByEmail(scope, email);
    const user = await this.authenticate(found, command.password);
    if (user === null) {
      await this.registerFailure(scope, email, state, now);
      return { kind: 'denied' };
    }
    await this.failedLogins.clearByEmail(scope, email);
    await this.audit.record(
      scope,
      SecurityEventType.LoginSucceeded,
      user.id,
      {},
    );
    const issued = await this.sessionIssuer.issue(
      scope,
      user,
      command.deviceLabel,
      this.idGenerator.generate(),
    );
    return { kind: 'issued', session: issued, user };
  }

  private async authenticate(
    found: UserWithCredential | null,
    password: string,
  ): Promise<User | null> {
    const passwordHash = found?.passwordHash ?? DUMMY_PASSWORD_HASH;
    const matches = await this.passwordHash.matches(password, passwordHash);
    if (found === null || !matches || !canAuthenticate(found.user)) {
      return null;
    }
    return found.user;
  }

  private async registerFailure(
    scope: TransactionScope,
    email: string,
    state: FailedLoginState | null,
    now: Date,
  ): Promise<void> {
    if (state === null) {
      await this.recordFirstFailure(scope, email, now);
      return;
    }
    await this.recordRepeatFailure(scope, state, now);
  }

  private async recordFirstFailure(
    scope: TransactionScope,
    email: string,
    now: Date,
  ): Promise<void> {
    await this.failedLogins.insert(scope, {
      id: this.idGenerator.generate(),
      email,
      attemptCount: 1,
      firstAttemptAt: now,
      lockedUntil: null,
    });
    await this.audit.record(scope, SecurityEventType.LoginFailed, null, {
      attempt: 1,
    });
  }

  private async recordRepeatFailure(
    scope: TransactionScope,
    state: FailedLoginState,
    now: Date,
  ): Promise<void> {
    const decision = computeFailedLoginDecision(
      state,
      now,
      this.config.identity.failedLoginWindowSeconds,
      this.config.identity.maxFailedLoginAttempts,
      this.config.identity.accountLockoutSeconds,
    );
    await this.failedLogins.update(scope, {
      id: state.id,
      attemptCount: decision.attemptCount,
      firstAttemptAt: decision.firstAttemptAt,
      lockedUntil: decision.lockedUntil,
      now,
    });
    await this.audit.record(
      scope,
      decision.locked
        ? SecurityEventType.AccountLocked
        : SecurityEventType.LoginFailed,
      null,
      { attempt: decision.attemptCount },
    );
  }
}
