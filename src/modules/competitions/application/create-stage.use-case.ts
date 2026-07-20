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

import { StageRepository } from '../infrastructure/stage.repository';
import { buildNewStage, buildStageAudit } from '../lib/competitions.builders';
import type { CreateStageCommand, Stage } from '../model/competitions.types';
import { CompetitionLookupService } from './competition-lookup.service';

/**
 * Appends an ordered stage to a competition. The competition is resolved within
 * the team scope (a miss is a 404), the next ordinal is assigned so a unique-order
 * constraint holds, then the stage and its audit entry are written in one
 * transaction.
 */
@Injectable()
export class CreateStageUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    private readonly lookup: CompetitionLookupService,
    private readonly repository: StageRepository,
    private readonly audit: AuditRecorderService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    competitionId: string,
    command: CreateStageCommand,
  ): Promise<Stage> {
    return this.unitOfWork.runInTransaction(tx =>
      this.run(tx, actor, teamId, competitionId, command),
    );
  }

  private async run(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    competitionId: string,
    command: CreateStageCommand,
  ): Promise<Stage> {
    await this.lookup.require(tx, teamId, competitionId);
    const ordinal = await this.repository.nextStageOrdinal(tx, competitionId);
    const stage = await this.repository.insertStage(
      tx,
      buildNewStage(
        this.idGenerator.generate(),
        competitionId,
        command.content.name,
        command.content.stageFormat,
        ordinal,
        this.clock.now(),
      ),
    );
    await this.audit.record(tx, buildStageAudit(actor.userId, stage, teamId));
    return stage;
  }
}
