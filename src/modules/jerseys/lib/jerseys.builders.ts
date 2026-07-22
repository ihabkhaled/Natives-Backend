import type { AuditInput, DomainEventInput } from '@modules/platform';
import { AuditOutcome } from '@modules/platform';

import {
  isApproveTarget,
  isCancelTarget,
  isCompleteTarget,
  isOrderTarget,
  isReceiveTarget,
  isSubmitTarget,
} from '../domain/order.state-machine';
import {
  INVENTORY_RESOURCE_TYPE,
  JERSEYS_EVENT_VERSION,
  ORDER_COMPLETED_EVENT,
  ORDER_CREATED_ACTION,
  ORDER_RESOURCE_TYPE,
  PRODUCT_CREATED_ACTION,
  PRODUCT_RESOURCE_TYPE,
  RESERVATION_CREATED_ACTION,
  RESERVATION_RESOURCE_TYPE,
} from '../model/jerseys.constants';
import type { OrderStatus } from '../model/jerseys.enums';
import { IssueDirection } from '../model/jerseys.enums';
import type {
  IssueContent,
  JerseyInventory,
  JerseyOrder,
  JerseyProduct,
  NewJerseyIssue,
  NewJerseyOrder,
  NewJerseyProduct,
  NewNumberReservation,
  NewOrderItem,
  NumberReservation,
  OrderContent,
  OrderItem,
  OrderItemContent,
  OrderStatusChange,
  ProductContent,
  ReservationContent,
} from '../model/jerseys.types';
import { normalizePrintedName } from './jerseys.helpers';

// --- Row builders ------------------------------------------------------------

export function buildNewProduct(
  id: string,
  teamId: string,
  content: ProductContent,
  actorUserId: string,
  now: Date,
): NewJerseyProduct {
  return {
    id,
    teamId,
    seasonId: content.seasonId,
    productKey: content.productKey,
    name: content.name,
    kitType: content.kitType,
    supplier: content.supplier,
    customizable: content.customizable,
    createdBy: actorUserId,
    now,
  };
}

export function buildNewReservation(
  id: string,
  teamId: string,
  content: ReservationContent,
  actorUserId: string,
  now: Date,
): NewNumberReservation {
  return {
    id,
    teamId,
    seasonId: content.seasonId,
    division: content.division,
    number: content.number,
    membershipId: content.membershipId,
    printedName: content.printedName,
    normalizedName: normalizePrintedName(content.printedName),
    createdBy: actorUserId,
    now,
  };
}

export function buildNewOrder(
  id: string,
  teamId: string,
  content: OrderContent,
  actorUserId: string,
  now: Date,
): NewJerseyOrder {
  return {
    id,
    teamId,
    seasonId: content.seasonId,
    reference: content.reference,
    supplier: content.supplier,
    paymentStatus: content.paymentStatus,
    external: content.external,
    notes: content.notes,
    createdBy: actorUserId,
    now,
  };
}

export function buildNewOrderItem(
  id: string,
  teamId: string,
  orderId: string,
  content: OrderItemContent,
  now: Date,
): NewOrderItem {
  return {
    id,
    teamId,
    orderId,
    productId: content.productId,
    membershipId: content.membershipId,
    kitType: content.kitType,
    size: content.size,
    sleeves: content.sleeves,
    division: content.division,
    printedName:
      content.printedName === null
        ? null
        : normalizePrintedName(content.printedName),
    number: content.number,
    quantity: content.quantity,
    now,
  };
}

export function buildOrderStatusChange(
  order: JerseyOrder,
  target: OrderStatus,
  expectedRecordVersion: number,
  now: Date,
): OrderStatusChange {
  return {
    id: order.orderId,
    teamId: order.teamId,
    expectedRecordVersion,
    toStatus: target,
    submittedAt: isSubmitTarget(target) ? now : order.submittedAt,
    approvedAt: isApproveTarget(target) ? now : order.approvedAt,
    orderedAt: isOrderTarget(target) ? now : order.orderedAt,
    receivedAt: isReceiveTarget(target) ? now : order.receivedAt,
    completedAt: isCompleteTarget(target) ? now : order.completedAt,
    cancelledAt: isCancelTarget(target) ? now : order.cancelledAt,
    now,
  };
}

export function buildNewIssue(
  id: string,
  teamId: string,
  content: IssueContent,
  actorUserId: string,
  now: Date,
): NewJerseyIssue {
  return {
    id,
    teamId,
    productId: content.productId,
    membershipId: content.membershipId,
    size: content.size,
    kitType: content.kitType,
    number: content.number,
    direction: content.direction,
    quantity: content.quantity,
    issuedBy: actorUserId,
    now,
  };
}

/** The signed stock delta of an issue: negative on issue, positive on return. */
export function stockDeltaOf(content: IssueContent): number {
  return content.direction === IssueDirection.Return
    ? content.quantity
    : -content.quantity;
}

// --- Audit -------------------------------------------------------------------

export function buildProductAudit(
  actorUserId: string,
  product: JerseyProduct,
): AuditInput {
  return {
    actorUserId,
    action: PRODUCT_CREATED_ACTION,
    resourceType: PRODUCT_RESOURCE_TYPE,
    resourceId: product.productId,
    teamId: product.teamId,
    seasonId: product.seasonId,
    correlationId: null,
    outcome: AuditOutcome.Success,
    diff: { productKey: product.productKey, kitType: product.kitType },
  };
}

export function buildReservationAudit(
  action: string,
  actorUserId: string,
  reservation: NumberReservation,
): AuditInput {
  return {
    actorUserId,
    action,
    resourceType: RESERVATION_RESOURCE_TYPE,
    resourceId: reservation.reservationId,
    teamId: reservation.teamId,
    seasonId: reservation.seasonId,
    correlationId: null,
    outcome: AuditOutcome.Success,
    diff: {
      number: reservation.number,
      division: reservation.division,
      membershipId: reservation.membershipId,
      status: reservation.status,
    },
  };
}

export function buildReservationCreatedAudit(
  actorUserId: string,
  reservation: NumberReservation,
): AuditInput {
  return buildReservationAudit(
    RESERVATION_CREATED_ACTION,
    actorUserId,
    reservation,
  );
}

export function buildOrderAudit(
  action: string,
  actorUserId: string,
  order: JerseyOrder,
): AuditInput {
  return {
    actorUserId,
    action,
    resourceType: ORDER_RESOURCE_TYPE,
    resourceId: order.orderId,
    teamId: order.teamId,
    seasonId: order.seasonId,
    correlationId: null,
    outcome: AuditOutcome.Success,
    diff: {
      reference: order.reference,
      status: order.status,
      paymentStatus: order.paymentStatus,
      external: order.external,
    },
  };
}

export function buildOrderCreatedAudit(
  actorUserId: string,
  order: JerseyOrder,
): AuditInput {
  return buildOrderAudit(ORDER_CREATED_ACTION, actorUserId, order);
}

export function buildItemAudit(
  action: string,
  actorUserId: string,
  item: OrderItem,
): AuditInput {
  return {
    actorUserId,
    action,
    resourceType: ORDER_RESOURCE_TYPE,
    resourceId: item.orderId,
    teamId: item.teamId,
    seasonId: null,
    correlationId: null,
    outcome: AuditOutcome.Success,
    diff: {
      productId: item.productId,
      size: item.size,
      quantity: item.quantity,
    },
  };
}

export function buildInventoryAudit(
  action: string,
  actorUserId: string,
  inventory: JerseyInventory,
  content: IssueContent,
): AuditInput {
  return {
    actorUserId,
    action,
    resourceType: INVENTORY_RESOURCE_TYPE,
    resourceId: inventory.inventoryId,
    teamId: inventory.teamId,
    seasonId: null,
    correlationId: null,
    outcome: AuditOutcome.Success,
    diff: {
      productId: inventory.productId,
      size: inventory.size,
      direction: content.direction,
      quantity: content.quantity,
      membershipId: content.membershipId,
    },
  };
}

// --- Domain events -----------------------------------------------------------

export function buildOrderCompletedEvent(
  order: JerseyOrder,
  actorUserId: string,
): DomainEventInput {
  return {
    aggregateType: ORDER_RESOURCE_TYPE,
    aggregateId: order.orderId,
    eventType: ORDER_COMPLETED_EVENT,
    eventVersion: JERSEYS_EVENT_VERSION,
    actorUserId,
    teamId: order.teamId,
    seasonId: order.seasonId,
    correlationId: null,
    causationId: null,
    payload: { reference: order.reference, external: order.external },
  };
}
