import { describe, expect, it } from 'vitest';

import {
  IssueDirection,
  JerseyDivision,
  JerseySize,
  KitType,
  OrderStatus,
  PaymentStatus,
  ProductStatus,
  ReservationStatus,
  SleeveType,
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
  IssueContent,
  JerseyOrder,
  JerseyProduct,
  NumberReservation,
} from '../model/jerseys.types';
import {
  buildInventoryAudit,
  buildNewIssue,
  buildNewOrder,
  buildNewOrderItem,
  buildNewProduct,
  buildNewReservation,
  buildOrderAudit,
  buildOrderCompletedEvent,
  buildOrderStatusChange,
  buildProductAudit,
  buildReservationCreatedAudit,
  stockDeltaOf,
} from './jerseys.builders';
import {
  normalizePrintedName,
  parseEnumValue,
  resolveJerseysPage,
  toDate,
  toNullableDate,
  toNullableNumber,
  toNumber,
} from './jerseys.helpers';
import {
  toInventory,
  toOrder,
  toOrderItem,
  toProduct,
  toReservation,
  toSupplierExportLine,
} from './jerseys.mapper';
import {
  toIssueContent,
  toOrderContent,
  toOrderItemContent,
  toProductContent,
  toReservationContent,
  toReservationListFilter,
} from './jerseys-command.mapper';

const NOW = new Date('2025-03-01T00:00:00.000Z');

const PRODUCT_ROW: ProductRow = {
  id: 'product-1',
  team_id: 'team-1',
  season_id: null,
  product_key: 'home_kit',
  name: 'Home Kit',
  kit_type: 'home',
  supplier: null,
  customizable: true,
  status: 'active',
  created_by: 'user-1',
  created_at: NOW,
  updated_at: NOW,
};

const RESERVATION_ROW: ReservationRow = {
  id: 'res-1',
  team_id: 'team-1',
  season_id: 'season-1',
  division: 'open',
  number: '7',
  membership_id: 'member-1',
  printed_name: 'ALI',
  normalized_name: 'ALI',
  status: 'active',
  active_from: NOW,
  released_at: null,
  release_reason: null,
  record_version: '1',
  created_by: 'user-1',
  created_at: NOW,
  updated_at: NOW,
};

const ORDER_ROW: OrderRow = {
  id: 'order-1',
  team_id: 'team-1',
  season_id: 'season-1',
  reference: 'ORD-1',
  supplier: null,
  status: 'draft',
  payment_status: 'unset',
  external: false,
  notes: null,
  record_version: '1',
  created_by: 'user-1',
  submitted_at: null,
  approved_at: null,
  ordered_at: null,
  received_at: null,
  completed_at: null,
  cancelled_at: null,
  created_at: NOW,
  updated_at: NOW,
};

const ITEM_ROW: OrderItemRow = {
  id: 'item-1',
  team_id: 'team-1',
  order_id: 'order-1',
  product_id: 'product-1',
  membership_id: null,
  kit_type: 'home',
  size: 'm',
  sleeves: 'short',
  division: 'open',
  printed_name: 'ALI',
  number: '7',
  quantity: '2',
  created_at: NOW,
};

const INVENTORY_ROW: InventoryRow = {
  id: 'inv-1',
  team_id: 'team-1',
  product_id: 'product-1',
  size: 'm',
  kit_type: 'home',
  on_hand: '10',
  issued: '2',
  returned: '0',
  record_version: '1',
  created_at: NOW,
  updated_at: NOW,
};

const EXPORT_ROW: SupplierExportRow = {
  product_name: 'Home Kit',
  kit_type: 'home',
  size: 'm',
  sleeves: 'short',
  printed_name: 'ALI',
  number: '7',
  quantity: '2',
};

const PRODUCT: JerseyProduct = toProduct(PRODUCT_ROW);
const RESERVATION: NumberReservation = toReservation(RESERVATION_ROW);
const ORDER: JerseyOrder = toOrder(ORDER_ROW);

describe('jerseys helpers', () => {
  it('clamps paging and coerces driver values', () => {
    expect(resolveJerseysPage(undefined, undefined)).toEqual({
      limit: 20,
      offset: 0,
    });
    expect(resolveJerseysPage(500, 4)).toEqual({ limit: 100, offset: 4 });
    expect(toDate(NOW)).toBe(NOW);
    expect(toNullableDate(null)).toBeNull();
    expect(toNumber('7')).toBe(7);
    expect(toNullableNumber(null)).toBeNull();
    expect(parseEnumValue(['a'], 'a', 'x')).toBe('a');
    expect(() => parseEnumValue(['a'], 'z', 'x')).toThrow(/x/u);
  });

  it('normalizes a printed name for uniqueness and print', () => {
    expect(normalizePrintedName('  ali  khan ')).toBe('ALI KHAN');
    expect(normalizePrintedName('A'.repeat(40))).toHaveLength(20);
  });
});

describe('jerseys mapper', () => {
  it('maps a product, reservation, order, item, inventory, and export line', () => {
    expect(PRODUCT.kitType).toBe(KitType.Home);
    expect(PRODUCT.status).toBe(ProductStatus.Active);
    expect(RESERVATION.number).toBe(7);
    expect(RESERVATION.status).toBe(ReservationStatus.Active);
    expect(RESERVATION.division).toBe(JerseyDivision.Open);
    expect(ORDER.status).toBe(OrderStatus.Draft);
    expect(ORDER.paymentStatus).toBe(PaymentStatus.Unset);
    const mappedItem = toOrderItem(ITEM_ROW);
    expect(mappedItem.size).toBe(JerseySize.Medium);
    expect(mappedItem.sleeves).toBe(SleeveType.Short);
    expect(mappedItem.quantity).toBe(2);
    expect(toInventory(INVENTORY_ROW).onHand).toBe(10);
    const line = toSupplierExportLine(EXPORT_ROW);
    expect(line).not.toHaveProperty('membershipId');
    expect(line.number).toBe(7);
  });
});

describe('jerseys command mapper', () => {
  it('defaults a product to a customizable home kit', () => {
    const content = toProductContent({
      productKey: ' home_kit ',
      name: ' Home Kit ',
    });
    expect(content.kitType).toBe(KitType.Home);
    expect(content.customizable).toBe(true);
    expect(content.productKey).toBe('home_kit');
  });

  it('defaults a reservation to the open division', () => {
    expect(
      toReservationContent({
        seasonId: 'season-1',
        number: 7,
        membershipId: 'member-1',
        printedName: ' Ali ',
      }).division,
    ).toBe(JerseyDivision.Open);
  });

  it('defaults an order to unset payment and internal', () => {
    const content = toOrderContent({
      seasonId: 'season-1',
      reference: 'ORD-1',
    });
    expect(content.paymentStatus).toBe(PaymentStatus.Unset);
    expect(content.external).toBe(false);
  });

  it('defaults an order item to a short-sleeve home open medium', () => {
    const content = toOrderItemContent({
      productId: 'product-1',
      size: JerseySize.Medium,
    });
    expect(content.kitType).toBe(KitType.Home);
    expect(content.sleeves).toBe(SleeveType.Short);
    expect(content.division).toBe(JerseyDivision.Open);
    expect(content.printedName).toBeNull();
    expect(content.quantity).toBe(1);
  });

  it('defaults an issue to a single outbound movement', () => {
    const content = toIssueContent({
      productId: 'product-1',
      membershipId: 'member-1',
      size: JerseySize.Medium,
    });
    expect(content.direction).toBe(IssueDirection.Issue);
    expect(content.quantity).toBe(1);
  });

  it('keeps every absent reservation filter facet null', () => {
    expect(toReservationListFilter({})).toEqual({
      seasonId: null,
      division: null,
      status: null,
      membershipId: null,
    });
  });
});

describe('jerseys builders', () => {
  it('builds new products, reservations, orders, items, and issues', () => {
    expect(
      buildNewProduct(
        'id-1',
        'team-1',
        toProductContent({ productKey: 'home', name: 'Home' }),
        'user-1',
        NOW,
      ).kitType,
    ).toBe(KitType.Home);
    expect(
      buildNewReservation(
        'id-1',
        'team-1',
        toReservationContent({
          seasonId: 'season-1',
          number: 7,
          membershipId: 'member-1',
          printedName: 'ali',
        }),
        'user-1',
        NOW,
      ).normalizedName,
    ).toBe('ALI');
    expect(
      buildNewOrder(
        'id-1',
        'team-1',
        toOrderContent({ seasonId: 'season-1', reference: 'ORD-1' }),
        'user-1',
        NOW,
      ).reference,
    ).toBe('ORD-1');
    const newItem = buildNewOrderItem(
      'id-1',
      'team-1',
      'order-1',
      toOrderItemContent({
        productId: 'product-1',
        size: JerseySize.Medium,
        printedName: 'ali',
      }),
      NOW,
    );
    expect(newItem.printedName).toBe('ALI');
    expect(
      buildNewIssue(
        'id-1',
        'team-1',
        toIssueContent({
          productId: 'product-1',
          membershipId: 'member-1',
          size: JerseySize.Medium,
        }),
        'user-1',
        NOW,
      ).issuedBy,
    ).toBe('user-1');
  });

  it('stamps only the instant an order transition owns', () => {
    const submitted = buildOrderStatusChange(
      ORDER,
      OrderStatus.Submitted,
      1,
      NOW,
    );
    expect(submitted.submittedAt).toBe(NOW);
    expect(submitted.completedAt).toBeNull();
    const completed = buildOrderStatusChange(
      ORDER,
      OrderStatus.Completed,
      1,
      NOW,
    );
    expect(completed.completedAt).toBe(NOW);
  });

  it('computes the signed stock delta of an issue and a return', () => {
    const issue: IssueContent = {
      productId: 'product-1',
      membershipId: 'member-1',
      size: JerseySize.Medium,
      kitType: KitType.Home,
      number: null,
      direction: IssueDirection.Issue,
      quantity: 3,
    };
    expect(stockDeltaOf(issue)).toBe(-3);
    expect(stockDeltaOf({ ...issue, direction: IssueDirection.Return })).toBe(
      3,
    );
  });

  it('audits with classifications and emits a print-safe completion event', () => {
    expect(buildProductAudit('user-1', PRODUCT).diff['productKey']).toBe(
      'home_kit',
    );
    expect(
      buildReservationCreatedAudit('user-1', RESERVATION).diff['number'],
    ).toBe(7);
    expect(
      buildOrderAudit('jersey.order.created', 'user-1', ORDER).diff[
        'reference'
      ],
    ).toBe('ORD-1');
    const audit = buildInventoryAudit(
      'jersey.inventory.issued',
      'user-1',
      toInventory(INVENTORY_ROW),
      {
        productId: 'product-1',
        membershipId: 'member-1',
        size: JerseySize.Medium,
        kitType: KitType.Home,
        number: null,
        direction: IssueDirection.Issue,
        quantity: 1,
      },
    );
    expect(audit.diff['direction']).toBe(IssueDirection.Issue);
    const event = buildOrderCompletedEvent(ORDER, 'user-1');
    expect(event.payload['reference']).toBe('ORD-1');
  });
});
