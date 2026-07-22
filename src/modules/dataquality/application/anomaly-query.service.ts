import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { AnomalyRepository } from '../infrastructure/anomaly.repository';
import type {
  Anomaly,
  AnomalyListFilter,
  AnomalyPage,
  PageRequest,
} from '../model/dataquality.types';
import { DataQualityLookupService } from './dataquality-lookup.service';

/** Read side of the anomaly queue: a bounded page and one anomaly (a miss 404s). */
@Injectable()
export class AnomalyQueryService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    private readonly repository: AnomalyRepository,
    private readonly lookup: DataQualityLookupService,
  ) {}

  listForScope(
    teamId: string,
    filter: AnomalyListFilter,
    page: PageRequest,
  ): Promise<AnomalyPage> {
    return this.unitOfWork.runInTransaction(tx =>
      this.page(tx, teamId, filter, page),
    );
  }

  getById(teamId: string, anomalyId: string): Promise<Anomaly> {
    return this.unitOfWork.runInTransaction(tx =>
      this.lookup.requireAnomaly(tx, teamId, anomalyId),
    );
  }

  private async page(
    tx: TransactionScope,
    teamId: string,
    filter: AnomalyListFilter,
    page: PageRequest,
  ): Promise<AnomalyPage> {
    const items = await this.repository.listForScope(tx, teamId, filter, page);
    const total = await this.repository.countForScope(tx, teamId, filter);
    return { items, total, limit: page.limit, offset: page.offset };
  }
}
