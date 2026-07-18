import { CLOCK_PORT, type ClockPort } from '@core/clock/clock.port';
import {
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { InvitationRepository } from '../infrastructure/invitation.repository';

/**
 * Sweeps pending invitations whose expiry has passed and marks them EXPIRED.
 * Idempotent and bounded; safe to invoke from a scheduled maintenance job.
 * Returns the number of invitations expired.
 */
@Injectable()
export class ExpireInvitationsUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    private readonly invitations: InvitationRepository,
  ) {}

  execute(): Promise<number> {
    return this.unitOfWork.runInTransaction(scope =>
      this.invitations.expireOverdue(scope, this.clock.now()),
    );
  }
}
