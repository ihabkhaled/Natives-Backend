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
import { toInvitationSummary } from '../lib/identity.mapper';
import { InvitationStatus, SecurityEventType } from '../model/identity.enums';
import type { InvitationSummary } from '../model/identity.types';
import { SecurityAuditService } from './security-audit.service';

/**
 * Revokes a pending invitation so its token can never be accepted. Only pending
 * invitations are revocable; already accepted/expired/revoked ones are rejected.
 */
@Injectable()
export class RevokeInvitationUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    private readonly invitations: InvitationRepository,
    private readonly audit: SecurityAuditService,
  ) {}

  execute(
    invitationId: string,
    actorUserId: string,
  ): Promise<InvitationSummary> {
    return this.unitOfWork.runInTransaction(scope =>
      this.run(scope, invitationId, actorUserId),
    );
  }

  private async run(
    scope: TransactionScope,
    invitationId: string,
    actorUserId: string,
  ): Promise<InvitationSummary> {
    const invitation = await this.invitations.findById(scope, invitationId);
    if (invitation === null) {
      throw new InvitationNotFoundError();
    }
    if (!isInvitationMutable(invitation)) {
      throw new InvitationInvalidError();
    }
    const now = this.clock.now();
    await this.invitations.markRevoked(scope, invitation.id, now);
    await this.audit.record(
      scope,
      SecurityEventType.InvitationRevoked,
      actorUserId,
      { invitationId: invitation.id },
    );
    return toInvitationSummary({
      ...invitation,
      status: InvitationStatus.Revoked,
      revokedAt: now,
      updatedAt: now,
    });
  }
}
