import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { FixtureRepository } from '../infrastructure/fixture.repository';
import { toFixtureViewPage } from '../lib/competitions.mapper';
import type { FixturePage, PageRequest } from '../model/competitions.types';
import { CompetitionLookupService } from './competition-lookup.service';

/**
 * Read side of a competition's fixtures (competition.read) — the team calendar
 * shell. Resolves the competition within the team scope (a miss is a 404), then
 * returns a bounded, chronologically ordered page of fixtures presented in
 * Africa/Cairo. Cancelled fixtures remain in the page for history.
 */
@Injectable()
export class FixtureQueryService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    private readonly repository: FixtureRepository,
    private readonly lookup: CompetitionLookupService,
  ) {}

  listForCompetition(
    teamId: string,
    competitionId: string,
    page: PageRequest,
  ): Promise<FixturePage> {
    return this.unitOfWork.runInTransaction(tx =>
      this.page(tx, teamId, competitionId, page),
    );
  }

  private async page(
    tx: TransactionScope,
    teamId: string,
    competitionId: string,
    page: PageRequest,
  ): Promise<FixturePage> {
    await this.lookup.require(tx, teamId, competitionId);
    const fixtures = await this.repository.listForCompetition(
      tx,
      teamId,
      competitionId,
      page,
    );
    const total = await this.repository.countForCompetition(
      tx,
      teamId,
      competitionId,
    );
    return toFixtureViewPage(fixtures, total, page);
  }
}
