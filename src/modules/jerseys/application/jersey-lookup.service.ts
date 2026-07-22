import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { JerseyScopeNotFoundError } from '../errors/jersey-scope-not-found.error';
import { OrderNotFoundError } from '../errors/order-not-found.error';
import { ProductNotFoundError } from '../errors/product-not-found.error';
import { ReservationNotFoundError } from '../errors/reservation-not-found.error';
import { JerseyOrderRepository } from '../infrastructure/jersey-order.repository';
import { JerseyProductRepository } from '../infrastructure/jersey-product.repository';
import { JerseyScopeRepository } from '../infrastructure/jersey-scope.repository';
import { NumberReservationRepository } from '../infrastructure/number-reservation.repository';
import type {
  JerseyOrder,
  JerseyProduct,
  NumberReservation,
} from '../model/jerseys.types';

/**
 * Resolves team-owned jersey records, translating a miss into a 404 that hides
 * existence, and validates the team/season/member scope of a write. Only the
 * caller's own team is reachable — a cross-team id is not-found, never a leak.
 */
@Injectable()
export class JerseyLookupService {
  constructor(
    private readonly scopes: JerseyScopeRepository,
    private readonly products: JerseyProductRepository,
    private readonly reservations: NumberReservationRepository,
    private readonly orders: JerseyOrderRepository,
  ) {}

  async requireTeam(scope: TransactionScope, teamId: string): Promise<void> {
    if (!(await this.scopes.activeTeamExists(scope, teamId))) {
      throw new JerseyScopeNotFoundError();
    }
  }

  async requireSeason(
    scope: TransactionScope,
    teamId: string,
    seasonId: string,
  ): Promise<void> {
    await this.requireTeam(scope, teamId);
    if (!(await this.scopes.seasonExists(scope, teamId, seasonId))) {
      throw new JerseyScopeNotFoundError();
    }
  }

  async requireMember(
    scope: TransactionScope,
    teamId: string,
    membershipId: string,
  ): Promise<void> {
    if (!(await this.scopes.membershipExists(scope, teamId, membershipId))) {
      throw new JerseyScopeNotFoundError();
    }
  }

  async requireProduct(
    scope: TransactionScope,
    teamId: string,
    productId: string,
  ): Promise<JerseyProduct> {
    const product = await this.products.findForWrite(scope, teamId, productId);
    if (product === null) {
      throw new ProductNotFoundError();
    }
    return product;
  }

  async requireReservation(
    scope: TransactionScope,
    teamId: string,
    reservationId: string,
  ): Promise<NumberReservation> {
    const reservation = await this.reservations.findForWrite(
      scope,
      teamId,
      reservationId,
    );
    if (reservation === null) {
      throw new ReservationNotFoundError();
    }
    return reservation;
  }

  async requireOrder(
    scope: TransactionScope,
    teamId: string,
    orderId: string,
  ): Promise<JerseyOrder> {
    const order = await this.orders.findForWrite(scope, teamId, orderId);
    if (order === null) {
      throw new OrderNotFoundError();
    }
    return order;
  }
}
