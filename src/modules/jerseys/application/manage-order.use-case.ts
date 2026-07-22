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
import {
  AuditRecorderService,
  RecordDomainEventService,
} from '@modules/platform';
import { Inject, Injectable } from '@nestjs/common';

import { validateOrderItem } from '../domain/apparel-validation.policy';
import {
  canTransitionOrder,
  isCompleteTarget,
  isOrderEditable,
  orderTargetOf,
} from '../domain/order.state-machine';
import { JerseyValidationError } from '../errors/jersey-validation.error';
import { JerseyVersionConflictError } from '../errors/jersey-version-conflict.error';
import { OrderInvalidTransitionError } from '../errors/order-invalid-transition.error';
import { OrderLockedError } from '../errors/order-locked.error';
import { JerseyOrderRepository } from '../infrastructure/jersey-order.repository';
import {
  buildItemAudit,
  buildNewOrder,
  buildNewOrderItem,
  buildOrderAudit,
  buildOrderCompletedEvent,
  buildOrderCreatedAudit,
  buildOrderStatusChange,
} from '../lib/jerseys.builders';
import {
  ORDER_ITEM_ADDED_ACTION,
  ORDER_TRANSITIONED_ACTION,
} from '../model/jerseys.constants';
import type {
  AddOrderItemCommand,
  CreateOrderCommand,
  JerseyOrder,
  OrderItem,
  OrderTransitionCommand,
} from '../model/jerseys.types';
import { JerseyLookupService } from './jersey-lookup.service';

/**
 * Creates apparel orders, adds validated items, and drives the order lifecycle
 * (UN-604). Items may only be added while the order is a DRAFT — once submitted,
 * its contents are frozen. Every item is validated (size, number, printed name,
 * division, quantity) before it is written. Completion enqueues a
 * classification-only event.
 */
@Injectable()
export class ManageOrderUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly ids: IdGeneratorPort,
    private readonly lookup: JerseyLookupService,
    private readonly orders: JerseyOrderRepository,
    private readonly audit: AuditRecorderService,
    private readonly events: RecordDomainEventService,
  ) {}

  create(
    actor: AuthUserIdentity,
    teamId: string,
    command: CreateOrderCommand,
  ): Promise<JerseyOrder> {
    return this.unitOfWork.runInTransaction(tx =>
      this.runCreate(tx, actor, teamId, command),
    );
  }

  addItem(
    actor: AuthUserIdentity,
    teamId: string,
    orderId: string,
    command: AddOrderItemCommand,
  ): Promise<OrderItem> {
    return this.unitOfWork.runInTransaction(tx =>
      this.runAddItem(tx, actor, teamId, orderId, command),
    );
  }

  transition(
    actor: AuthUserIdentity,
    teamId: string,
    orderId: string,
    command: OrderTransitionCommand,
  ): Promise<JerseyOrder> {
    return this.unitOfWork.runInTransaction(tx =>
      this.runTransition(tx, actor, teamId, orderId, command),
    );
  }

  private async runCreate(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    command: CreateOrderCommand,
  ): Promise<JerseyOrder> {
    await this.lookup.requireSeason(tx, teamId, command.content.seasonId);
    const order = await this.orders.insert(
      tx,
      buildNewOrder(
        this.ids.generate(),
        teamId,
        command.content,
        actor.userId,
        this.clock.now(),
      ),
    );
    await this.audit.record(tx, buildOrderCreatedAudit(actor.userId, order));
    return order;
  }

  private async runAddItem(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    orderId: string,
    command: AddOrderItemCommand,
  ): Promise<OrderItem> {
    const order = await this.lookup.requireOrder(tx, teamId, orderId);
    if (!isOrderEditable(order.status)) {
      throw new OrderLockedError();
    }
    const product = await this.lookup.requireProduct(
      tx,
      teamId,
      command.content.productId,
    );
    this.assertItemValid(command, product.customizable);
    const item = await this.orders.insertItem(
      tx,
      buildNewOrderItem(
        this.ids.generate(),
        teamId,
        orderId,
        command.content,
        this.clock.now(),
      ),
    );
    await this.audit.record(
      tx,
      buildItemAudit(ORDER_ITEM_ADDED_ACTION, actor.userId, item),
    );
    return item;
  }

  private assertItemValid(
    command: AddOrderItemCommand,
    customizable: boolean,
  ): void {
    const verdict = validateOrderItem(
      command.content,
      command.content.division,
      customizable,
    );
    if (!verdict.valid) {
      throw new JerseyValidationError();
    }
  }

  private async runTransition(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    orderId: string,
    command: OrderTransitionCommand,
  ): Promise<JerseyOrder> {
    const existing = await this.lookup.requireOrder(tx, teamId, orderId);
    const target = orderTargetOf(command.transition);
    if (!canTransitionOrder(existing.status, target)) {
      throw new OrderInvalidTransitionError();
    }
    const changed = await this.orders.applyStatusChange(
      tx,
      buildOrderStatusChange(
        existing,
        target,
        command.expectedRecordVersion,
        this.clock.now(),
      ),
    );
    return this.finish(tx, actor, changed);
  }

  private async finish(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    changed: JerseyOrder | null,
  ): Promise<JerseyOrder> {
    if (changed === null) {
      throw new JerseyVersionConflictError();
    }
    await this.audit.record(
      tx,
      buildOrderAudit(ORDER_TRANSITIONED_ACTION, actor.userId, changed),
    );
    if (isCompleteTarget(changed.status)) {
      await this.events.enqueue(
        tx,
        buildOrderCompletedEvent(changed, actor.userId),
      );
    }
    return changed;
  }
}
