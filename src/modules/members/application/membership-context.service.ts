import { CLOCK_PORT, type ClockPort } from '@core/clock/clock.port';
import {
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { MembershipContextRepository } from '../infrastructure/membership-context.repository';
import type { MembershipContext } from '../model/members.types';

/**
 * Public members surface: the team/season contexts one user personally belongs
 * to. Self-scoped by construction — the caller passes the authenticated user id
 * resolved from the verified token, so a principal only ever sees their own
 * memberships. Consumed by the identity module to populate the principal.
 */
@Injectable()
export class MembershipContextService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    private readonly memberships: MembershipContextRepository,
  ) {}

  listForUser(userId: string): Promise<readonly MembershipContext[]> {
    const asOf = this.clock.now();
    return this.unitOfWork.runInTransaction(scope =>
      this.memberships.listForUser(scope, userId, asOf),
    );
  }
}
