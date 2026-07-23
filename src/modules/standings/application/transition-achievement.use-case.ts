import type { AuthUserIdentity } from '@core/auth';
import { CLOCK_PORT, type ClockPort } from '@core/clock/clock.port';
import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import {
  AuditRecorderService,
  RecordDomainEventService,
} from '@modules/platform';
import { Inject, Injectable } from '@nestjs/common';

import {
  canTransitionAchievement,
  isApproveTarget,
  targetStatusOf,
} from '../domain/achievement.state-machine';
import { AchievementInvalidTransitionError } from '../errors/achievement-invalid-transition.error';
import { StandingsVersionConflictError } from '../errors/standings-version-conflict.error';
import { AchievementRepository } from '../infrastructure/achievement.repository';
import {
  buildAchievementApprovedEvent,
  buildAchievementAudit,
  buildAchievementStatusChange,
} from '../lib/standings.builders';
import { ACHIEVEMENT_TRANSITIONED_ACTION } from '../model/standings.constants';
import type {
  Achievement,
  TransitionAchievementCommand,
} from '../model/standings.types';
import { AchievementQueryService } from './achievement-query.service';

/**
 * Moves an achievement claim through its approval workflow (UN-506). The state
 * machine decides what is legal and the optimistic record version decides who
 * wins a race. Approval is the moment a claim becomes history, so it — and only
 * it — enqueues `achievement.approved` with the classification, never the
 * description or the evidence link.
 */
@Injectable()
export class TransitionAchievementUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    private readonly lookup: AchievementQueryService,
    private readonly achievements: AchievementRepository,
    private readonly audit: AuditRecorderService,
    private readonly events: RecordDomainEventService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    achievementId: string,
    command: TransitionAchievementCommand,
  ): Promise<Achievement> {
    return this.unitOfWork.runInTransaction(tx =>
      this.run(tx, actor, teamId, achievementId, command),
    );
  }

  private async run(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    achievementId: string,
    command: TransitionAchievementCommand,
  ): Promise<Achievement> {
    const existing = await this.lookup.require(tx, teamId, achievementId);
    const target = targetStatusOf(command.transition);
    if (!canTransitionAchievement(existing.status, target)) {
      throw new AchievementInvalidTransitionError();
    }
    const changed = await this.achievements.applyStatusChange(
      tx,
      buildAchievementStatusChange(
        existing,
        target,
        actor.userId,
        command.expectedRecordVersion,
        this.clock.now(),
        command.reason,
      ),
    );
    return this.finish(tx, actor, changed);
  }

  private async finish(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    changed: Achievement | null,
  ): Promise<Achievement> {
    if (changed === null) {
      throw new StandingsVersionConflictError();
    }
    await this.audit.record(
      tx,
      buildAchievementAudit(
        ACHIEVEMENT_TRANSITIONED_ACTION,
        actor.userId,
        changed,
      ),
    );
    if (isApproveTarget(changed.status)) {
      await this.events.enqueue(
        tx,
        buildAchievementApprovedEvent(changed, actor.userId),
      );
    }
    return changed;
  }
}
