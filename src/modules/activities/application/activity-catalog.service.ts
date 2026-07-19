import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { ActivityTypeNotFoundError } from '../errors/activity-type-not-found.error';
import { ActivityTypeRepository } from '../infrastructure/activity-type.repository';
import { toActivityTypeView } from '../lib/activity.response.mapper';
import type {
  ActivityType,
  PagedResult,
  PageRequest,
} from '../model/activity.types';
import type { ActivityTypeView } from '../model/activity.views';
import { ActivityScopeService } from './activity-scope.service';

/**
 * Read + lookup side of the versioned activity-type catalog. The list is a single
 * bounded, deterministically ordered page, scoped to a valid team.
 * `requireActiveType` loads a type inside a write transaction for submission
 * validation; an archived or missing type is a 404 so a claim can never pin a
 * retired catalog entry.
 */
@Injectable()
export class ActivityCatalogService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    private readonly scope: ActivityScopeService,
    private readonly repository: ActivityTypeRepository,
  ) {}

  listActiveTypes(
    teamId: string,
    page: PageRequest,
  ): Promise<PagedResult<ActivityTypeView>> {
    return this.unitOfWork.runInTransaction(tx => this.page(tx, teamId, page));
  }

  async requireActiveType(
    scope: TransactionScope,
    typeId: string,
  ): Promise<ActivityType> {
    const type = await this.repository.findActiveById(scope, typeId);
    if (type === null) {
      throw new ActivityTypeNotFoundError();
    }
    return type;
  }

  private async page(
    tx: TransactionScope,
    teamId: string,
    page: PageRequest,
  ): Promise<PagedResult<ActivityTypeView>> {
    await this.scope.validate(tx, teamId, null);
    const types = await this.repository.listActive(tx, page);
    const total = await this.repository.countActive(tx);
    return {
      items: types.map(type => toActivityTypeView(type)),
      total,
      limit: page.limit,
      offset: page.offset,
    };
  }
}
