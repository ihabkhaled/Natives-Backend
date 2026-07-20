import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { SquadRepository } from '../infrastructure/squad.repository';
import type { PageRequest, Squad, SquadPage } from '../model/squads.types';
import { SquadLookupService } from './squad-lookup.service';

/**
 * Read side of squads (squad.read). Lists a team's squads in a bounded,
 * deterministically ordered page, optionally narrowed to one season, and resolves
 * a single squad (a miss is a 404). One transaction per call.
 */
@Injectable()
export class SquadQueryService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    private readonly repository: SquadRepository,
    private readonly lookup: SquadLookupService,
  ) {}

  listForScope(
    teamId: string,
    seasonId: string | null,
    page: PageRequest,
  ): Promise<SquadPage> {
    return this.unitOfWork.runInTransaction(tx =>
      this.page(tx, teamId, seasonId, page),
    );
  }

  getById(teamId: string, squadId: string): Promise<Squad> {
    return this.unitOfWork.runInTransaction(tx =>
      this.lookup.require(tx, teamId, squadId),
    );
  }

  private async page(
    tx: TransactionScope,
    teamId: string,
    seasonId: string | null,
    page: PageRequest,
  ): Promise<SquadPage> {
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
