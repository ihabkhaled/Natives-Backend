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

import { InvitationConflictError } from '../errors/invitation-conflict.error';
import { InvitationRepository } from '../infrastructure/invitation.repository';
import { UserRepository } from '../infrastructure/user.repository';
import { normalizeEmail } from '../lib/identity.helpers';
import { toInvitationDelivery } from '../lib/identity.mapper';
import { hashOpaqueToken } from '../lib/token-hash';
import {
  MILLISECONDS_PER_SECOND,
  SECURE_RANDOM_PORT,
} from '../model/identity.constants';
import { SecurityEventType } from '../model/identity.enums';
import type {
  CreateInvitationCommand,
  InvitationDelivery,
  SecureRandomPort,
} from '../model/identity.types';
import { SecurityAuditService } from './security-audit.service';
import { SendInvitationEmailService } from './send-invitation-email.service';

/**
 * Creates a pending invitation for a privileged actor. Generates a CSPRNG token,
 * persists only its sha-256 hash, and audits the action — all atomically.
 *
 * The invitation email is sent automatically once that transaction commits, so
 * inviting somebody is a single step. Sending is best-effort and deliberately
 * outside the transaction; the response still carries the one-time link so an
 * admin can hand it over manually (see OD-002).
 */
@Injectable()
export class CreateInvitationUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    @Inject(SECURE_RANDOM_PORT)
    private readonly secureRandom: SecureRandomPort,
    private readonly config: AppConfigService,
    private readonly users: UserRepository,
    private readonly invitations: InvitationRepository,
    private readonly audit: SecurityAuditService,
    private readonly invitationEmail: SendInvitationEmailService,
  ) {}

  async execute(command: CreateInvitationCommand): Promise<InvitationDelivery> {
    const email = normalizeEmail(command.email);
    const delivery = await this.unitOfWork.runInTransaction(scope =>
      this.run(scope, command, email),
    );
    await this.invitationEmail.send(delivery);
    return delivery;
  }

  private async run(
    scope: TransactionScope,
    command: CreateInvitationCommand,
    email: string,
  ): Promise<InvitationDelivery> {
    await this.assertAvailable(scope, email);
    const now = this.clock.now();
    const ttl = this.config.identity.invitationTtlSeconds;
    const token = this.secureRandom.generateToken();
    const invitation = await this.invitations.insert(scope, {
      id: this.idGenerator.generate(),
      email,
      tokenHash: hashOpaqueToken(token),
      invitedBy: command.invitedBy,
      role: command.role,
      expiresAt: new Date(now.getTime() + ttl * MILLISECONDS_PER_SECOND),
      now,
    });
    await this.audit.record(
      scope,
      SecurityEventType.InvitationCreated,
      command.invitedBy,
      { invitationId: invitation.id },
    );
    return toInvitationDelivery(invitation, token);
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
      throw new InvitationConflictError();
    }
  }
}
