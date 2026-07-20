import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { OpponentRepository } from '../infrastructure/opponent.repository';
import type { OpponentPage, PageRequest } from '../model/competitions.types';

/**
 * Read side of the opponent catalogue (competition.read). Lists a team's
 * opponents in a bounded, deterministically ordered page. One transaction per call.
 */
@Injectable()
export class OpponentQueryService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    private readonly repository: OpponentRepository,
  ) {}

  listForTeam(teamId: string, page: PageRequest): Promise<OpponentPage> {
    return this.unitOfWork.runInTransaction(tx => this.page(tx, teamId, page));
  }

  private async page(
    tx: TransactionScope,
    teamId: string,
    page: PageRequest,
  ): Promise<OpponentPage> {
    const items = await this.repository.listForTeam(tx, teamId, page);
    const total = await this.repository.countForTeam(tx, teamId);
    return { items, total, limit: page.limit, offset: page.offset };
  }
}
