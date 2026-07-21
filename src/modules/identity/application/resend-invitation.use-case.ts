import { AppConfigService } from '@config/app-config.service';
import { CLOCK_PORT, type ClockPort } from '@core/clock/clock.port';
import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { isInvitationMutable } from '../domain/invitation.policy';
import { InvitationInvalidError } from '../errors/invitation-invalid.error';
import { InvitationNotFoundError } from '../errors/invitation-not-found.error';
import { InvitationRepository } from '../infrastructure/invitation.repository';
import { toInvitationDelivery } from '../lib/identity.mapper';
import { hashOpaqueToken } from '../lib/token-hash';
import {
  MILLISECONDS_PER_SECOND,
  SECURE_RANDOM_PORT,
} from '../model/identity.constants';
import { SecurityEventType } from '../model/identity.enums';
import type {
  InvitationDelivery,
  SecureRandomPort,
} from '../model/identity.types';
import { SecurityAuditService } from './security-audit.service';
import { SendInvitationEmailService } from './send-invitation-email.service';

/**
 * Re-issues a pending invitation with a fresh token and expiry. The previous
 * token hash is overwritten, invalidating any earlier link. Non-pending
 * invitations cannot be resent.
 *
 * "Resend" means what it says: the new link is emailed automatically once the
 * rotation commits, with the same best-effort semantics as create.
 */
@Injectable()
export class ResendInvitationUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(SECURE_RANDOM_PORT)
    private readonly secureRandom: SecureRandomPort,
    private readonly config: AppConfigService,
    private readonly invitations: InvitationRepository,
    private readonly audit: SecurityAuditService,
    private readonly invitationEmail: SendInvitationEmailService,
  ) {}

  async execute(
    invitationId: string,
    actorUserId: string,
  ): Promise<InvitationDelivery> {
    const delivery = await this.unitOfWork.runInTransaction(scope =>
      this.run(scope, invitationId, actorUserId),
    );
    await this.invitationEmail.send(delivery);
    return delivery;
  }

  private async run(
    scope: TransactionScope,
    invitationId: string,
    actorUserId: string,
  ): Promise<InvitationDelivery> {
    const invitation = await this.invitations.findById(scope, invitationId);
    if (invitation === null) {
      throw new InvitationNotFoundError();
    }
    if (!isInvitationMutable(invitation)) {
      throw new InvitationInvalidError();
    }
    const now = this.clock.now();
    const ttl = this.config.identity.invitationTtlSeconds;
    const expiresAt = new Date(now.getTime() + ttl * MILLISECONDS_PER_SECOND);
    const token = this.secureRandom.generateToken();
    await this.invitations.rotateToken(
      scope,
      invitation.id,
      hashOpaqueToken(token),
      expiresAt,
      now,
    );
    await this.audit.record(
      scope,
      SecurityEventType.InvitationResent,
      actorUserId,
      { invitationId: invitation.id },
    );
    return toInvitationDelivery(
      { ...invitation, expiresAt, updatedAt: now },
      token,
    );
  }
}
