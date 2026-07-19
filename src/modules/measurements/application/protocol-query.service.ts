import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { MeasurementProtocolNotFoundError } from '../errors/measurement-protocol-not-found.error';
import { MeasurementProtocolRepository } from '../infrastructure/measurement-protocol.repository';
import type {
  MeasurementProtocol,
  PageRequest,
  ProtocolPage,
} from '../model/measurements.types';

/**
 * Read side of the measurement-protocol catalog (analytics.read.team). Every list
 * is one bounded, deterministically ordered page in a single transaction; a team
 * sees its own protocols plus the seeded global catalog. Detail resolves a visible
 * protocol or a 404 that hides existence.
 */
@Injectable()
export class ProtocolQueryService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    private readonly repository: MeasurementProtocolRepository,
  ) {}

  listForTeam(teamId: string, page: PageRequest): Promise<ProtocolPage> {
    return this.unitOfWork.runInTransaction(tx =>
      this.teamPage(tx, teamId, page),
    );
  }

  getDetail(teamId: string, protocolId: string): Promise<MeasurementProtocol> {
    return this.unitOfWork.runInTransaction(tx =>
      this.requireVisible(tx, teamId, protocolId),
    );
  }

  private async teamPage(
    tx: TransactionScope,
    teamId: string,
    page: PageRequest,
  ): Promise<ProtocolPage> {
    const items = await this.repository.listForTeam(tx, teamId, page);
    const total = await this.repository.countForTeam(tx, teamId);
    return { items, total, limit: page.limit, offset: page.offset };
  }

  private async requireVisible(
    tx: TransactionScope,
    teamId: string,
    protocolId: string,
  ): Promise<MeasurementProtocol> {
    const protocol = await this.repository.findVisible(tx, teamId, protocolId);
    if (protocol === null) {
      throw new MeasurementProtocolNotFoundError();
    }
    return protocol;
  }
}
