import {
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { CatalogRepository } from '../infrastructure/catalog.repository';
import type { CatalogName } from '../model/teams.enums';
import type {
  ListCatalogEntriesResult,
  PageRequest,
} from '../model/teams.types';

/**
 * Read side for reference catalogs: a bounded, deterministically ordered page of
 * a single catalog's entries for a team (by sort order, then key).
 */
@Injectable()
export class CatalogQueryService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    private readonly catalog: CatalogRepository,
  ) {}

  listEntries(
    teamId: string,
    catalog: CatalogName,
    page: PageRequest,
  ): Promise<ListCatalogEntriesResult> {
    return this.unitOfWork.runInTransaction(scope =>
      this.catalog.list(scope, teamId, catalog, page),
    );
  }
}
