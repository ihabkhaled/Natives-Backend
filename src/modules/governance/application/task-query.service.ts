import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { TaskRepository } from '../infrastructure/task.repository';
import type {
  GovernanceTask,
  GovernanceTaskPage,
  PageRequest,
  TaskListFilter,
} from '../model/governance.types';
import { GovernanceLookupService } from './governance-lookup.service';

/** Read side of governance tasks: a bounded page and one task (a miss 404s). */
@Injectable()
export class TaskQueryService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    private readonly repository: TaskRepository,
    private readonly lookup: GovernanceLookupService,
  ) {}

  listForScope(
    teamId: string,
    filter: TaskListFilter,
    page: PageRequest,
  ): Promise<GovernanceTaskPage> {
    return this.unitOfWork.runInTransaction(tx =>
      this.page(tx, teamId, filter, page),
    );
  }

  getById(teamId: string, taskId: string): Promise<GovernanceTask> {
    return this.unitOfWork.runInTransaction(tx =>
      this.lookup.requireTask(tx, teamId, taskId),
    );
  }

  private async page(
    tx: TransactionScope,
    teamId: string,
    filter: TaskListFilter,
    page: PageRequest,
  ): Promise<GovernanceTaskPage> {
    const items = await this.repository.listForScope(tx, teamId, filter, page);
    const total = await this.repository.countForScope(tx, teamId, filter);
    return { items, total, limit: page.limit, offset: page.offset };
  }
}
