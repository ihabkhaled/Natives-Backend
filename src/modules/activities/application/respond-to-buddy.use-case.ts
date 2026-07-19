import type { AuthUserIdentity } from '@core/auth';
import { CLOCK_PORT, type ClockPort } from '@core/clock/clock.port';
import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { AuditRecorderService } from '@modules/platform';
import { Inject, Injectable } from '@nestjs/common';

import {
  canRespondToBuddy,
  resolveBuddyResponse,
} from '../domain/activity-buddy.policy';
import { ActivityBuddyConflictError } from '../errors/activity-buddy-conflict.error';
import { ActivityBuddyNotFoundError } from '../errors/activity-buddy-not-found.error';
import { ActivityBuddyRepository } from '../infrastructure/activity-buddy.repository';
import {
  buildBuddyAudit,
  buildBuddyResponseUpdate,
} from '../lib/activity.builders';
import { toBuddyView } from '../lib/activity.response.mapper';
import { BUDDY_RESPONDED_ACTION } from '../model/activities.constants';
import type { BuddyDecision } from '../model/activity.enums';
import type { ActivityBuddy } from '../model/activity.types';
import type { BuddyView } from '../model/activity.views';

/**
 * Records a credited member's response to a pending training-buddy credit (confirm
 * or decline). Ownership is resolved from the token identity against the buddy
 * membership, so a member can only ever answer their own credit; a missing or
 * out-of-scope credit is a 404, and an already-answered credit is a conflict.
 */
@Injectable()
export class RespondToBuddyUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    private readonly repository: ActivityBuddyRepository,
    private readonly audit: AuditRecorderService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    buddyId: string,
    decision: BuddyDecision,
  ): Promise<BuddyView> {
    return this.unitOfWork.runInTransaction(tx =>
      this.run(tx, actor, teamId, buddyId, decision),
    );
  }

  private async run(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    buddyId: string,
    decision: BuddyDecision,
  ): Promise<BuddyView> {
    const buddy = await this.repository.findOwnedForResponse(
      tx,
      teamId,
      buddyId,
      actor.userId,
    );
    if (buddy === null) {
      throw new ActivityBuddyNotFoundError();
    }
    if (!canRespondToBuddy(buddy.status)) {
      throw new ActivityBuddyConflictError();
    }
    const updated = await this.apply(tx, buddyId, decision, actor.userId);
    await this.audit.record(
      tx,
      buildBuddyAudit(BUDDY_RESPONDED_ACTION, actor.userId, updated, teamId),
    );
    return toBuddyView(updated);
  }

  private async apply(
    tx: TransactionScope,
    buddyId: string,
    decision: BuddyDecision,
    actorUserId: string,
  ): Promise<ActivityBuddy> {
    const updated = await this.repository.updateStatus(
      tx,
      buildBuddyResponseUpdate(
        buddyId,
        resolveBuddyResponse(decision),
        actorUserId,
        this.clock.now(),
      ),
    );
    if (updated === null) {
      throw new ActivityBuddyConflictError();
    }
    return updated;
  }
}
