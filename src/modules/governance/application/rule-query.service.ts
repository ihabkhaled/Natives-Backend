import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { RuleRepository } from '../infrastructure/rule.repository';
import type {
  PageRequest,
  RuleListFilter,
  TeamRule,
  TeamRulePage,
} from '../model/governance.types';
import { GovernanceLookupService } from './governance-lookup.service';

/** Read side of versioned team rules: a bounded page and one rule (a miss 404s). */
@Injectable()
export class RuleQueryService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    private readonly repository: RuleRepository,
    private readonly lookup: GovernanceLookupService,
  ) {}

  listForScope(
    teamId: string,
    filter: RuleListFilter,
    page: PageRequest,
  ): Promise<TeamRulePage> {
    return this.unitOfWork.runInTransaction(tx =>
      this.page(tx, teamId, filter, page),
    );
  }

  getById(teamId: string, ruleId: string): Promise<TeamRule> {
    return this.unitOfWork.runInTransaction(tx =>
      this.lookup.requireRule(tx, teamId, ruleId),
    );
  }

  private async page(
    tx: TransactionScope,
    teamId: string,
    filter: RuleListFilter,
    page: PageRequest,
  ): Promise<TeamRulePage> {
    const items = await this.repository.listForScope(tx, teamId, filter, page);
    const total = await this.repository.countForScope(tx, teamId, filter);
    return { items, total, limit: page.limit, offset: page.offset };
  }
}
