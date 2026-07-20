import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { CompetitionRepository } from '../infrastructure/competition.repository';
import type {
  Competition,
  CompetitionPage,
  PageRequest,
} from '../model/competitions.types';
import { CompetitionLookupService } from './competition-lookup.service';

/**
 * Read side of competitions (competition.read). Lists a team's competitions in a
 * bounded, deterministically ordered page, optionally narrowed to one season, and
 * resolves a single competition (a miss is a 404). One transaction per call.
 */
@Injectable()
export class CompetitionQueryService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    private readonly repository: CompetitionRepository,
    private readonly lookup: CompetitionLookupService,
  ) {}

  listForScope(
    teamId: string,
    seasonId: string | null,
    page: PageRequest,
  ): Promise<CompetitionPage> {
    return this.unitOfWork.runInTransaction(tx =>
      this.page(tx, teamId, seasonId, page),
    );
  }

  getById(teamId: string, competitionId: string): Promise<Competition> {
    return this.unitOfWork.runInTransaction(tx =>
      this.lookup.require(tx, teamId, competitionId),
    );
  }

  private async page(
    tx: TransactionScope,
    teamId: string,
    seasonId: string | null,
    page: PageRequest,
  ): Promise<CompetitionPage> {
    const items = await this.repository.listForScope(
      tx,
      teamId,
      seasonId,
      page,
    );
    const total = await this.repository.countForScope(tx, teamId, seasonId);
    return { items, total, limit: page.limit, offset: page.offset };
  }
}
