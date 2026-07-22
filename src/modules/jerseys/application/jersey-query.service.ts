import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { JerseyInventoryRepository } from '../infrastructure/jersey-inventory.repository';
import { JerseyOrderRepository } from '../infrastructure/jersey-order.repository';
import { JerseyProductRepository } from '../infrastructure/jersey-product.repository';
import { NumberReservationRepository } from '../infrastructure/number-reservation.repository';
import type {
  JerseyInventoryPage,
  JerseyOrder,
  JerseyOrderPage,
  JerseyProductPage,
  NumberReservationPage,
  OrderItemList,
  OrderListFilter,
  PageRequest,
  ReservationListFilter,
} from '../model/jerseys.types';
import { JerseyLookupService } from './jersey-lookup.service';

/**
 * Read side of jersey products, reservations, orders, and inventory. Bounded,
 * deterministically ordered pages under allow-listed filters; a single order is
 * resolved with its items (a miss is a 404). One transaction per call.
 */
@Injectable()
export class JerseyQueryService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    private readonly products: JerseyProductRepository,
    private readonly reservations: NumberReservationRepository,
    private readonly orders: JerseyOrderRepository,
    private readonly inventory: JerseyInventoryRepository,
    private readonly lookup: JerseyLookupService,
  ) {}

  listProducts(teamId: string, page: PageRequest): Promise<JerseyProductPage> {
    return this.unitOfWork.runInTransaction(async tx => {
      const items = await this.products.listForTeam(tx, teamId, page);
      const total = await this.products.countForTeam(tx, teamId);
      return { items, total, limit: page.limit, offset: page.offset };
    });
  }

  listReservations(
    teamId: string,
    filter: ReservationListFilter,
    page: PageRequest,
  ): Promise<NumberReservationPage> {
    return this.unitOfWork.runInTransaction(tx =>
      this.reservationPage(tx, teamId, filter, page),
    );
  }

  listOrders(
    teamId: string,
    filter: OrderListFilter,
    page: PageRequest,
  ): Promise<JerseyOrderPage> {
    return this.unitOfWork.runInTransaction(tx =>
      this.orderPage(tx, teamId, filter, page),
    );
  }

  getOrder(teamId: string, orderId: string): Promise<JerseyOrder> {
    return this.unitOfWork.runInTransaction(tx =>
      this.lookup.requireOrder(tx, teamId, orderId),
    );
  }

  listOrderItems(teamId: string, orderId: string): Promise<OrderItemList> {
    return this.unitOfWork.runInTransaction(async tx => {
      await this.lookup.requireOrder(tx, teamId, orderId);
      const items = await this.orders.listItems(tx, orderId);
      return { items };
    });
  }

  listInventory(
    teamId: string,
    page: PageRequest,
  ): Promise<JerseyInventoryPage> {
    return this.unitOfWork.runInTransaction(async tx => {
      const items = await this.inventory.listForTeam(tx, teamId, page);
      const total = await this.inventory.countForTeam(tx, teamId);
      return { items, total, limit: page.limit, offset: page.offset };
    });
  }

  private async reservationPage(
    tx: TransactionScope,
    teamId: string,
    filter: ReservationListFilter,
    page: PageRequest,
  ): Promise<NumberReservationPage> {
    const items = await this.reservations.listForScope(
      tx,
      teamId,
      filter,
      page,
    );
    const total = await this.reservations.countForScope(tx, teamId, filter);
    return { items, total, limit: page.limit, offset: page.offset };
  }

  private async orderPage(
    tx: TransactionScope,
    teamId: string,
    filter: OrderListFilter,
    page: PageRequest,
  ): Promise<JerseyOrderPage> {
    const items = await this.orders.listForScope(tx, teamId, filter, page);
    const total = await this.orders.countForScope(tx, teamId, filter);
    return { items, total, limit: page.limit, offset: page.offset };
  }
}
