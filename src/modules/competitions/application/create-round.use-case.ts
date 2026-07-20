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

import { CompetitionScopeNotFoundError } from '../errors/competition-scope-not-found.error';
import { StageRepository } from '../infrastructure/stage.repository';
import { buildNewRound, buildRoundAudit } from '../lib/competitions.builders';
import type { CreateRoundCommand, Round } from '../model/competitions.types';
import { CompetitionLookupService } from './competition-lookup.service';

/**
 * Appends an ordered round to a stage of a competition. The competition and stage
 * are resolved within the team scope (a miss is a 404), the next ordinal is
 * assigned per stage, then the round and its audit entry are written in one
 * transaction.
 */
@Injectable()
export class CreateRoundUseCase {
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
    command: CreateRoundCommand,
  ): Promise<Round> {
    return this.unitOfWork.runInTransaction(tx =>
      this.run(tx, actor, teamId, competitionId, command),
    );
  }

  private async run(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    competitionId: string,
    command: CreateRoundCommand,
  ): Promise<Round> {
    await this.lookup.require(tx, teamId, competitionId);
    const stageId = command.content.stageId;
    if (
      !(await this.repository.stageInCompetition(tx, competitionId, stageId))
    ) {
      throw new CompetitionScopeNotFoundError();
    }
    const round = await this.write(tx, competitionId, stageId, command);
    await this.audit.record(tx, buildRoundAudit(actor.userId, round, teamId));
    return round;
  }

  private async write(
    tx: TransactionScope,
    competitionId: string,
    stageId: string,
    command: CreateRoundCommand,
  ): Promise<Round> {
    const ordinal = await this.repository.nextRoundOrdinal(tx, stageId);
    return this.repository.insertRound(
      tx,
      buildNewRound(
        this.idGenerator.generate(),
        stageId,
        competitionId,
        command.content.name,
        ordinal,
        this.clock.now(),
      ),
    );
  }
}
