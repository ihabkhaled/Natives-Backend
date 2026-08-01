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
import { Role } from '@shared/enums';

import { SignupConflictError } from '../errors/signup-conflict.error';
import { InvitationRepository } from '../infrastructure/invitation.repository';
import { PasswordCredentialRepository } from '../infrastructure/password-credential.repository';
import { UserRepository } from '../infrastructure/user.repository';
import { normalizeEmail } from '../lib/identity.helpers';
import { toSignupRequestSummary } from '../lib/identity.mapper';
import { SIGNUP_PENDING_ACK_MESSAGE } from '../model/identity.constants';
import { SecurityEventType, UserStatus } from '../model/identity.enums';
import type {
  SignupAcknowledgement,
  SignupCommand,
  User,
} from '../model/identity.types';
import { SecurityAuditService } from './security-audit.service';
import { SendSignupEmailService } from './send-signup-email.service';

/**
 * Registers a public self-signup. Creates the account in a PENDING state with no
 * role, no membership, and no session — inert until an admin approves it — while
 * storing the chosen password so approval needs no second step from the
 * applicant. Persisting the account, its credential, and the audit row is
 * atomic; the confirmation (applicant) and notification (admin) emails are sent
 * best-effort after commit, so a transport outage never fails the signup.
 */
@Injectable()
export class RequestSignupUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    @Inject(PASSWORD_HASH_PORT)
    private readonly passwordHash: PasswordHashPort,
    private readonly users: UserRepository,
    private readonly credentials: PasswordCredentialRepository,
    private readonly invitations: InvitationRepository,
    private readonly audit: SecurityAuditService,
    private readonly signupEmail: SendSignupEmailService,
  ) {}

  async execute(command: SignupCommand): Promise<SignupAcknowledgement> {
    const email = normalizeEmail(command.email);
    const user = await this.unitOfWork.runInTransaction(scope =>
      this.run(scope, command, email),
    );
    const summary = toSignupRequestSummary(user);
    await this.signupEmail.sendPendingNotifications(summary);
    return { message: SIGNUP_PENDING_ACK_MESSAGE, state: summary.state };
  }

  private async run(
    scope: TransactionScope,
    command: SignupCommand,
    email: string,
  ): Promise<User> {
    await this.assertAvailable(scope, email);
    const now = this.clock.now();
    const user = await this.users.insert(scope, {
      id: this.idGenerator.generate(),
      email,
      role: Role.User,
      status: UserStatus.Pending,
      displayName: command.displayName,
      now,
    });
    const hash = await this.passwordHash.hash(command.password);
    await this.credentialFor(scope, user.id, hash, now);
    await this.audit.record(scope, SecurityEventType.SignupRequested, user.id, {
      state: user.status,
    });
    return user;
  }

  private async credentialFor(
    scope: TransactionScope,
    userId: string,
    hash: string,
    now: Date,
  ): Promise<void> {
    await this.credentials.insert(
      scope,
      this.idGenerator.generate(),
      userId,
      hash,
      now,
    );
  }

  private async assertAvailable(
    scope: TransactionScope,
    email: string,
  ): Promise<void> {
    const existingUser = await this.users.findActiveByEmail(scope, email);
    const pending = await this.invitations.findActivePendingByEmail(
      scope,
      email,
    );
    if (existingUser !== null || pending !== null) {
      throw new SignupConflictError();
    }
  }
}
