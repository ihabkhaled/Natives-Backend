import {
  JERSEY_DIVISION_VALUES,
  JERSEY_SIZE_VALUES,
  KIT_TYPE_VALUES,
  ORDER_STATUS_VALUES,
  PAYMENT_STATUS_VALUES,
  PRODUCT_STATUS_VALUES,
  RESERVATION_STATUS_VALUES,
  SLEEVE_TYPE_VALUES,
} from '../model/jerseys.enums';
import type {
  InventoryRow,
  OrderItemRow,
  OrderRow,
  ProductRow,
  ReservationRow,
  SupplierExportRow,
} from '../model/jerseys.rows';
import type {
  JerseyInventory,
  JerseyOrder,
  JerseyProduct,
  NumberReservation,
  OrderItem,
  SupplierExportLine,
} from '../model/jerseys.types';
import {
  parseEnumValue,
  toDate,
  toNullableDate,
  toNullableNumber,
  toNumber,
} from './jerseys.helpers';

export function toProduct(row: ProductRow): JerseyProduct {
  return {
    productId: row.id,
    teamId: row.team_id,
    seasonId: row.season_id,
    productKey: row.product_key,
    name: row.name,
    kitType: parseEnumValue(KIT_TYPE_VALUES, row.kit_type, 'kit type'),
    supplier: row.supplier,
    customizable: row.customizable,
    status: parseEnumValue(PRODUCT_STATUS_VALUES, row.status, 'product status'),
    createdBy: row.created_by,
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  };
}

export function toReservation(row: ReservationRow): NumberReservation {
  return {
    reservationId: row.id,
    teamId: row.team_id,
    seasonId: row.season_id,
    division: parseEnumValue(JERSEY_DIVISION_VALUES, row.division, 'division'),
    number: toNumber(row.number),
    membershipId: row.membership_id,
    printedName: row.printed_name,
    normalizedName: row.normalized_name,
    status: parseEnumValue(
      RESERVATION_STATUS_VALUES,
      row.status,
      'reservation status',
    ),
    activeFrom: toDate(row.active_from),
    releasedAt: toNullableDate(row.released_at),
    releaseReason: row.release_reason,
    recordVersion: toNumber(row.record_version),
    createdBy: row.created_by,
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  };
}

export function toOrder(row: OrderRow): JerseyOrder {
  return {
    orderId: row.id,
    teamId: row.team_id,
    seasonId: row.season_id,
    reference: row.reference,
    supplier: row.supplier,
    status: parseEnumValue(ORDER_STATUS_VALUES, row.status, 'order status'),
    paymentStatus: parseEnumValue(
      PAYMENT_STATUS_VALUES,
      row.payment_status,
      'payment status',
    ),
    external: row.external,
    notes: row.notes,
    recordVersion: toNumber(row.record_version),
    createdBy: row.created_by,
    submittedAt: toNullableDate(row.submitted_at),
    approvedAt: toNullableDate(row.approved_at),
    orderedAt: toNullableDate(row.ordered_at),
    receivedAt: toNullableDate(row.received_at),
    completedAt: toNullableDate(row.completed_at),
    cancelledAt: toNullableDate(row.cancelled_at),
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  };
}

export function toOrderItem(row: OrderItemRow): OrderItem {
  return {
    itemId: row.id,
    teamId: row.team_id,
    orderId: row.order_id,
    productId: row.product_id,
    membershipId: row.membership_id,
    kitType: parseEnumValue(KIT_TYPE_VALUES, row.kit_type, 'kit type'),
    size: parseEnumValue(JERSEY_SIZE_VALUES, row.size, 'size'),
    sleeves: parseEnumValue(SLEEVE_TYPE_VALUES, row.sleeves, 'sleeves'),
    division: parseEnumValue(JERSEY_DIVISION_VALUES, row.division, 'division'),
    printedName: row.printed_name,
    number: toNullableNumber(row.number),
    quantity: toNumber(row.quantity),
    createdAt: toDate(row.created_at),
  };
}

export function toInventory(row: InventoryRow): JerseyInventory {
  return {
    inventoryId: row.id,
    teamId: row.team_id,
    productId: row.product_id,
    size: parseEnumValue(JERSEY_SIZE_VALUES, row.size, 'size'),
    kitType: parseEnumValue(KIT_TYPE_VALUES, row.kit_type, 'kit type'),
    onHand: toNumber(row.on_hand),
    issued: toNumber(row.issued),
    returned: toNumber(row.returned),
    recordVersion: toNumber(row.record_version),
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  };
}

/**
 * Map a supplier export line. It carries the PRINT facts only — product,
 * variant, printed name, number, quantity — and never the member id, so a
 * supplier file cannot re-identify who each shirt is for.
 */
export function toSupplierExportLine(
  row: SupplierExportRow,
): SupplierExportLine {
  return {
    productName: row.product_name,
    kitType: parseEnumValue(KIT_TYPE_VALUES, row.kit_type, 'kit type'),
    size: parseEnumValue(JERSEY_SIZE_VALUES, row.size, 'size'),
    sleeves: parseEnumValue(SLEEVE_TYPE_VALUES, row.sleeves, 'sleeves'),
    printedName: row.printed_name,
    number: toNullableNumber(row.number),
    quantity: toNumber(row.quantity),
  };
}
