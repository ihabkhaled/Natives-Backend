import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { DrillNotFoundError } from '../errors/drill-not-found.error';
import { DrillRepository } from '../infrastructure/drill.repository';
import { resolveDrillsQuery } from '../lib/agendas.helpers';
import { toDrillView, toListDrillsView } from '../lib/agendas.mapper';
import type {
  DrillView,
  ListDrillsQueryInput,
  ListDrillsView,
} from '../model/agendas.types';

/**
 * Read side for the drill catalog (practice.read). The list is bounded, paginated,
 * deterministically ordered, and filtered only on the allowlisted category / status
 * / skill-tag dimensions; a single get resolves within the caller's team scope so a
 * cross-team id is a clean not-found.
 */
@Injectable()
export class DrillQueryService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    private readonly drills: DrillRepository,
  ) {}

  list(teamId: string, query: ListDrillsQueryInput): Promise<ListDrillsView> {
    return this.unitOfWork.runInTransaction(scope =>
      this.runList(scope, teamId, query),
    );
  }

  getDrill(teamId: string, drillId: string): Promise<DrillView> {
    return this.unitOfWork.runInTransaction(scope =>
      this.runGet(scope, teamId, drillId),
    );
  }

  private async runList(
    scope: TransactionScope,
    teamId: string,
    query: ListDrillsQueryInput,
  ): Promise<ListDrillsView> {
    const resolved = resolveDrillsQuery(query);
    const items = await this.drills.list(scope, teamId, resolved);
    const total = await this.drills.count(scope, teamId, resolved);
    return toListDrillsView({
      items,
      total,
      limit: resolved.limit,
      offset: resolved.offset,
    });
  }

  private async runGet(
    scope: TransactionScope,
    teamId: string,
    drillId: string,
  ): Promise<DrillView> {
    const drill = await this.drills.findByIdInTeam(scope, teamId, drillId);
    if (drill === null) {
      throw new DrillNotFoundError();
    }
    return toDrillView(drill);
  }
}
