import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { GovernanceDirectoryRepository } from '../infrastructure/governance-directory.repository';
import type {
  GovernanceAppointmentList,
  GovernancePosition,
  GovernancePositionPage,
  PageRequest,
} from '../model/governance.types';
import { GovernanceLookupService } from './governance-lookup.service';

/** Read side of governance positions and their appointment history. */
@Injectable()
export class DirectoryQueryService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    private readonly repository: GovernanceDirectoryRepository,
    private readonly lookup: GovernanceLookupService,
  ) {}

  listPositions(
    teamId: string,
    page: PageRequest,
  ): Promise<GovernancePositionPage> {
    return this.unitOfWork.runInTransaction(tx => this.page(tx, teamId, page));
  }

  getPosition(teamId: string, positionId: string): Promise<GovernancePosition> {
    return this.unitOfWork.runInTransaction(tx =>
      this.lookup.requirePosition(tx, teamId, positionId),
    );
  }

  listAppointments(
    teamId: string,
    positionId: string,
    page: PageRequest,
  ): Promise<GovernanceAppointmentList> {
    return this.unitOfWork.runInTransaction(async tx => {
      await this.lookup.requirePosition(tx, teamId, positionId);
      const items = await this.repository.listAppointments(
        tx,
        positionId,
        page,
      );
      return { items };
    });
  }

  private async page(
    tx: TransactionScope,
    teamId: string,
    page: PageRequest,
  ): Promise<GovernancePositionPage> {
    const items = await this.repository.listPositions(tx, teamId, page);
    const total = await this.repository.countPositions(tx, teamId);
    return { items, total, limit: page.limit, offset: page.offset };
  }
}
