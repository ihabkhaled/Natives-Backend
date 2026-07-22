import { CLOCK_PORT, type ClockPort } from '@core/clock/clock.port';
import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { toRoleSlug } from '@modules/rbac';
import { Inject, Injectable } from '@nestjs/common';

import { isInvitationAcceptable } from '../domain/invitation.policy';
import { InvitationInvalidError } from '../errors/invitation-invalid.error';
import { InvitationRepository } from '../infrastructure/invitation.repository';
import { hashOpaqueToken } from '../lib/token-hash';
import type { PublicInvitationDetails } from '../model/identity.types';

@Injectable()
export class GetInvitationDetailsUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    private readonly invitations: InvitationRepository,
  ) {}

  execute(token: string): Promise<PublicInvitationDetails> {
    return this.unitOfWork.runInTransaction(scope => this.run(scope, token));
  }

  private async run(
    scope: TransactionScope,
    token: string,
  ): Promise<PublicInvitationDetails> {
    const invitation = await this.invitations.findPublicByTokenHash(
      scope,
      hashOpaqueToken(token),
    );
    if (
      invitation === null ||
      !isInvitationAcceptable(invitation, this.clock.now())
    ) {
      throw new InvitationInvalidError();
    }
    return {
      email: invitation.email,
      role: invitation.role,
      inviterName: invitation.inviterName,
      expiresAt: invitation.expiresAt,
      teamRole: toRoleSlug(invitation.teamRoleKey),
      teamId: invitation.teamId,
      teamName: invitation.teamName,
    };
  }
}
