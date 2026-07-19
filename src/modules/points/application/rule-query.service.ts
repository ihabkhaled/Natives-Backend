import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { PointsRuleRepository } from '../infrastructure/points-rule.repository';
import type { PageRequest, PointsRulePage } from '../model/points.types';

/**
 * Read side of points-rule versions (points.rules.manage). Surfaces the team's own
 * rules alongside the seeded global candidates so an administrator can approve and
 * publish a value set. Bounded, deterministically ordered, one transaction.
 */
@Injectable()
export class RuleQueryService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    private readonly repository: PointsRuleRepository,
  ) {}

  listForTeam(teamId: string, page: PageRequest): Promise<PointsRulePage> {
    return this.unitOfWork.runInTransaction(tx => this.page(tx, teamId, page));
  }

  private async page(
    tx: TransactionScope,
    teamId: string,
    page: PageRequest,
  ): Promise<PointsRulePage> {
    const items = await this.repository.listForTeam(tx, teamId, page);
    const total = await this.repository.countForTeam(tx, teamId);
    return { items, total, limit: page.limit, offset: page.offset };
  }
}
