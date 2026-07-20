import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { StageRepository } from '../infrastructure/stage.repository';
import type { CompetitionStructure } from '../model/competitions.types';
import { CompetitionLookupService } from './competition-lookup.service';

/**
 * Read side of a competition's stage/round structure (competition.read). Resolves
 * the competition within the team scope (a miss is a 404), then returns its ordered
 * stages and rounds. One transaction per call.
 */
@Injectable()
export class StructureQueryService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    private readonly repository: StageRepository,
    private readonly lookup: CompetitionLookupService,
  ) {}

  getStructure(
    teamId: string,
    competitionId: string,
  ): Promise<CompetitionStructure> {
    return this.unitOfWork.runInTransaction(tx =>
      this.assemble(tx, teamId, competitionId),
    );
  }

  private async assemble(
    tx: TransactionScope,
    teamId: string,
    competitionId: string,
  ): Promise<CompetitionStructure> {
    await this.lookup.require(tx, teamId, competitionId);
    const stages = await this.repository.listStages(tx, competitionId);
    const rounds = await this.repository.listRounds(tx, competitionId);
    return { stages, rounds };
  }
}
