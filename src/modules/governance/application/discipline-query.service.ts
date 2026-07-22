import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { DisciplineRepository } from '../infrastructure/discipline.repository';
import type {
  DisciplineCase,
  DisciplineCasePage,
  DisciplineListFilter,
  PageRequest,
} from '../model/governance.types';
import { GovernanceLookupService } from './governance-lookup.service';

/**
 * Read side of discipline cases. The controller gates the whole surface behind
 * `discipline.read`, so nobody without that permission reaches this service —
 * exports, search, and analytics never touch these rows, which is how the
 * confidential case data stays out of broad diffs.
 */
@Injectable()
export class DisciplineQueryService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    private readonly repository: DisciplineRepository,
    private readonly lookup: GovernanceLookupService,
  ) {}

  listForScope(
    teamId: string,
    filter: DisciplineListFilter,
    page: PageRequest,
  ): Promise<DisciplineCasePage> {
    return this.unitOfWork.runInTransaction(tx =>
      this.page(tx, teamId, filter, page),
    );
  }

  getById(teamId: string, caseId: string): Promise<DisciplineCase> {
    return this.unitOfWork.runInTransaction(tx =>
      this.lookup.requireCase(tx, teamId, caseId),
    );
  }

  private async page(
    tx: TransactionScope,
    teamId: string,
    filter: DisciplineListFilter,
    page: PageRequest,
  ): Promise<DisciplineCasePage> {
    const items = await this.repository.listForScope(tx, teamId, filter, page);
    const total = await this.repository.countForScope(tx, teamId, filter);
    return { items, total, limit: page.limit, offset: page.offset };
  }
}
