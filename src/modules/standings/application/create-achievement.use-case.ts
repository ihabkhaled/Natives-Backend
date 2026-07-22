import type { AuthUserIdentity } from '@core/auth';
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
import { AuditRecorderService } from '@modules/platform';
import { Inject, Injectable } from '@nestjs/common';

import { StandingsValidationError } from '../errors/standings-validation.error';
import { AchievementRepository } from '../infrastructure/achievement.repository';
import { isCalendarDay } from '../lib/achievement-import.reconciler';
import {
  buildAchievementAudit,
  buildNewAchievement,
} from '../lib/standings.builders';
import { ACHIEVEMENT_CREATED_ACTION } from '../model/standings.constants';
import { AchievementSource } from '../model/standings.enums';
import type {
  Achievement,
  CreateAchievementCommand,
} from '../model/standings.types';

/**
 * Creates a DRAFT achievement claim (UN-506). Nothing here reaches the trophy
 * cabinet: a claim only becomes history after a human approves it, which is a
 * separate, separately-permissioned transition. The achievement date must be a
 * real calendar day — a legacy sheet's broken cell is refused rather than stored
 * as an unparseable fact.
 */
@Injectable()
export class CreateAchievementUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly ids: IdGeneratorPort,
    private readonly achievements: AchievementRepository,
    private readonly audit: AuditRecorderService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    command: CreateAchievementCommand,
  ): Promise<Achievement> {
    return this.unitOfWork.runInTransaction(tx =>
      this.run(tx, actor, teamId, command),
    );
  }

  private async run(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    command: CreateAchievementCommand,
  ): Promise<Achievement> {
    if (!isCalendarDay(command.content.achievedOn)) {
      throw new StandingsValidationError();
    }
    const achievement = await this.achievements.insert(
      tx,
      buildNewAchievement(
        this.ids.generate(),
        teamId,
        command.content,
        AchievementSource.Manual,
        null,
        actor.userId,
        this.clock.now(),
      ),
    );
    await this.audit.record(
      tx,
      buildAchievementAudit(
        ACHIEVEMENT_CREATED_ACTION,
        actor.userId,
        achievement,
      ),
    );
    return achievement;
  }
}
