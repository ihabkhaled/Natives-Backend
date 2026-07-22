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

import { InsufficientStockError } from '../errors/insufficient-stock.error';
import { JerseyInventoryRepository } from '../infrastructure/jersey-inventory.repository';
import {
  buildInventoryAudit,
  buildNewIssue,
  stockDeltaOf,
} from '../lib/jerseys.builders';
import { INVENTORY_ISSUED_ACTION } from '../model/jerseys.constants';
import { IssueDirection } from '../model/jerseys.enums';
import type {
  IssueStockCommand,
  JerseyInventory,
} from '../model/jerseys.types';
import { JerseyLookupService } from './jersey-lookup.service';

/**
 * Issues physical stock to a member or records a return (UN-604). This is
 * distinct from a profile preference and a confirmed order: it records that a
 * SPECIFIC member physically received (or returned) a specific variant. The
 * on-hand stock is moved by a single guarded UPDATE — issuing more than is on
 * hand is refused rather than driving the count negative.
 */
@Injectable()
export class IssueStockUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly ids: IdGeneratorPort,
    private readonly lookup: JerseyLookupService,
    private readonly inventory: JerseyInventoryRepository,
    private readonly audit: AuditRecorderService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    command: IssueStockCommand,
  ): Promise<JerseyInventory> {
    return this.unitOfWork.runInTransaction(tx =>
      this.run(tx, actor, teamId, command),
    );
  }

  private async run(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    command: IssueStockCommand,
  ): Promise<JerseyInventory> {
    const content = command.content;
    await this.lookup.requireProduct(tx, teamId, content.productId);
    await this.lookup.requireMember(tx, teamId, content.membershipId);
    const now = this.clock.now();
    const variant = await this.inventory.ensureVariant(
      tx,
      this.ids.generate(),
      teamId,
      content.productId,
      content.size,
      content.kitType,
      now,
    );
    const moved = await this.move(tx, variant, command, now);
    await this.recordIssue(tx, actor, teamId, command, now);
    await this.audit.record(
      tx,
      buildInventoryAudit(
        INVENTORY_ISSUED_ACTION,
        actor.userId,
        moved,
        content,
      ),
    );
    return moved;
  }

  private async move(
    tx: TransactionScope,
    variant: JerseyInventory,
    command: IssueStockCommand,
    now: Date,
  ): Promise<JerseyInventory> {
    const content = command.content;
    const isReturn = content.direction === IssueDirection.Return;
    const moved = await this.inventory.applyMovement(
      tx,
      variant.inventoryId,
      stockDeltaOf(content),
      isReturn ? 0 : content.quantity,
      isReturn ? content.quantity : 0,
      now,
    );
    if (moved === null) {
      throw new InsufficientStockError();
    }
    return moved;
  }

  private async recordIssue(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    command: IssueStockCommand,
    now: Date,
  ): Promise<void> {
    await this.inventory.insertIssue(
      tx,
      buildNewIssue(
        this.ids.generate(),
        teamId,
        command.content,
        actor.userId,
        now,
      ),
    );
  }
}
