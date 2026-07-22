import type { AuthUserIdentity } from '@core/auth';
import { CLOCK_PORT, type ClockPort } from '@core/clock/clock.port';
import {
  ID_GENERATOR_PORT,
  type IdGeneratorPort,
} from '@core/id-generator/id-generator.port';
import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { AuditRecorderService } from '@modules/platform';
import { Inject, Injectable } from '@nestjs/common';

import { JerseyProductRepository } from '../infrastructure/jersey-product.repository';
import { buildNewProduct, buildProductAudit } from '../lib/jerseys.builders';
import type {
  CreateProductCommand,
  JerseyProduct,
} from '../model/jerseys.types';
import { JerseyLookupService } from './jersey-lookup.service';

/**
 * Creates or updates a jersey product in the team catalogue (UN-604). Product
 * keys are unique per team, so re-registering the same key updates it rather
 * than duplicating the catalogue.
 */
@Injectable()
export class CreateProductUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly ids: IdGeneratorPort,
    private readonly lookup: JerseyLookupService,
    private readonly products: JerseyProductRepository,
    private readonly audit: AuditRecorderService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    command: CreateProductCommand,
  ): Promise<JerseyProduct> {
    return this.unitOfWork.runInTransaction(tx =>
      this.run(tx, actor, teamId, command),
    );
  }

  private async run(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    command: CreateProductCommand,
  ): Promise<JerseyProduct> {
    await this.requireScope(tx, teamId, command.content.seasonId);
    const product = await this.products.insert(
      tx,
      buildNewProduct(
        this.ids.generate(),
        teamId,
        command.content,
        actor.userId,
        this.clock.now(),
      ),
    );
    await this.audit.record(tx, buildProductAudit(actor.userId, product));
    return product;
  }

  private async requireScope(
    tx: TransactionScope,
    teamId: string,
    seasonId: string | null,
  ): Promise<void> {
    if (seasonId === null) {
      await this.lookup.requireTeam(tx, teamId);
      return;
    }
    await this.lookup.requireSeason(tx, teamId, seasonId);
  }
}
