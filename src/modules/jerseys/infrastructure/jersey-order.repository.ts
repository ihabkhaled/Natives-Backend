import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import {
  toOrder,
  toOrderItem,
  toSupplierExportLine,
} from '../lib/jerseys.mapper';
import {
  LIST_MAX_LIMIT,
  ORDER_COLUMNS,
  ORDER_ITEM_COLUMNS,
  ORDER_ITEMS_MAX,
} from '../model/jerseys.constants';
import type {
  JerseyCountRow,
  OrderItemRow,
  OrderRow,
  SupplierExportRow,
} from '../model/jerseys.rows';
import type {
  JerseyOrder,
  NewJerseyOrder,
  NewOrderItem,
  OrderItem,
  OrderListFilter,
  OrderStatusChange,
  PageRequest,
  SupplierExportLine,
} from '../model/jerseys.types';

/**
 * Persistence for apparel orders, their items, and the privacy-minimal supplier
 * export. Data access only: parameterized SQL, static column lists,
 * optimistic-version-guarded lifecycle writes, and bounded reads. The supplier
 * export projects PRINT facts only — never the member id.
 */
@Injectable()
export class JerseyOrderRepository {
  async insert(
    scope: TransactionScope,
    order: NewJerseyOrder,
  ): Promise<JerseyOrder> {
    const rows = await scope.run<OrderRow>(
      `INSERT INTO "jersey_orders"
        ("id", "team_id", "season_id", "reference", "supplier",
         "payment_status", "external", "notes", "created_by", "created_at",
         "updated_at")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)
       RETURNING ${ORDER_COLUMNS}`,
      [
        order.id,
        order.teamId,
        order.seasonId,
        order.reference,
        order.supplier,
        order.paymentStatus,
        order.external,
        order.notes,
        order.createdBy,
        order.now.toISOString(),
      ],
    );
    const row = rows[0];
    if (row === undefined) {
      throw new Error('Expected a returned row from the order write');
    }
    return toOrder(row);
  }

  async findForWrite(
    scope: TransactionScope,
    teamId: string,
    orderId: string,
  ): Promise<JerseyOrder | null> {
    const rows = await scope.run<OrderRow>(
      `SELECT ${ORDER_COLUMNS} FROM "jersey_orders"
        WHERE "id" = $1 AND "team_id" = $2`,
      [orderId, teamId],
    );
    const row = rows[0];
    return row === undefined ? null : toOrder(row);
  }

  async applyStatusChange(
    scope: TransactionScope,
    change: OrderStatusChange,
  ): Promise<JerseyOrder | null> {
    const rows = await scope.run<OrderRow>(
      `UPDATE "jersey_orders"
          SET "status" = $4, "submitted_at" = $5, "approved_at" = $6,
              "ordered_at" = $7, "received_at" = $8, "completed_at" = $9,
              "cancelled_at" = $10, "updated_at" = $11,
              "record_version" = "record_version" + 1
        WHERE "id" = $1 AND "team_id" = $2 AND "record_version" = $3
       RETURNING ${ORDER_COLUMNS}`,
      [
        change.id,
        change.teamId,
        change.expectedRecordVersion,
        change.toStatus,
        this.instant(change.submittedAt),
        this.instant(change.approvedAt),
        this.instant(change.orderedAt),
        this.instant(change.receivedAt),
        this.instant(change.completedAt),
        this.instant(change.cancelledAt),
        change.now.toISOString(),
      ],
    );
    const row = rows[0];
    return row === undefined ? null : toOrder(row);
  }

  async insertItem(
    scope: TransactionScope,
    item: NewOrderItem,
  ): Promise<OrderItem> {
    const rows = await scope.run<OrderItemRow>(
      `INSERT INTO "jersey_order_items"
        ("id", "team_id", "order_id", "product_id", "membership_id",
         "kit_type", "size", "sleeves", "division", "printed_name", "number",
         "quantity", "created_at")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING ${ORDER_ITEM_COLUMNS}`,
      [
        item.id,
        item.teamId,
        item.orderId,
        item.productId,
        item.membershipId,
        item.kitType,
        item.size,
        item.sleeves,
        item.division,
        item.printedName,
        item.number,
        item.quantity,
        item.now.toISOString(),
      ],
    );
    const row = rows[0];
    if (row === undefined) {
      throw new Error('Expected a returned row from the order item write');
    }
    return toOrderItem(row);
  }

  async listItems(
    scope: TransactionScope,
    orderId: string,
  ): Promise<readonly OrderItem[]> {
    const rows = await scope.run<OrderItemRow>(
      `SELECT ${ORDER_ITEM_COLUMNS} FROM "jersey_order_items"
        WHERE "order_id" = $1
        ORDER BY "created_at" ASC, "id" ASC
        LIMIT $2`,
      [orderId, ORDER_ITEMS_MAX],
    );
    return rows.map(row => toOrderItem(row));
  }

  async listForScope(
    scope: TransactionScope,
    teamId: string,
    filter: OrderListFilter,
    page: PageRequest,
  ): Promise<readonly JerseyOrder[]> {
    const rows = await scope.run<OrderRow>(
      `SELECT ${ORDER_COLUMNS} FROM "jersey_orders"
        WHERE "team_id" = $1
          AND ($2::uuid IS NULL OR "season_id" = $2)
          AND ($3::text IS NULL OR "status" = $3)
        ORDER BY "created_at" DESC, "id" ASC
        LIMIT $4 OFFSET $5`,
      [
        teamId,
        filter.seasonId,
        filter.status,
        Math.min(page.limit, LIST_MAX_LIMIT),
        page.offset,
      ],
    );
    return rows.map(row => toOrder(row));
  }

  async countForScope(
    scope: TransactionScope,
    teamId: string,
    filter: OrderListFilter,
  ): Promise<number> {
    const rows = await scope.run<JerseyCountRow>(
      `SELECT COUNT(*)::int AS "count" FROM "jersey_orders"
        WHERE "team_id" = $1
          AND ($2::uuid IS NULL OR "season_id" = $2)
          AND ($3::text IS NULL OR "status" = $3)`,
      [teamId, filter.seasonId, filter.status],
    );
    return Number(rows[0]?.count ?? 0);
  }

  /** The privacy-minimal supplier export: print facts only, no member id. */
  async supplierExport(
    scope: TransactionScope,
    orderId: string,
  ): Promise<readonly SupplierExportLine[]> {
    const rows = await scope.run<SupplierExportRow>(
      `SELECT p."name" AS "product_name", i."kit_type" AS "kit_type",
              i."size" AS "size", i."sleeves" AS "sleeves",
              i."printed_name" AS "printed_name", i."number" AS "number",
              i."quantity" AS "quantity"
         FROM "jersey_order_items" i
         JOIN "jersey_products" p ON p."id" = i."product_id"
        WHERE i."order_id" = $1
        ORDER BY p."name" ASC, i."size" ASC, i."number" ASC NULLS LAST
        LIMIT $2`,
      [orderId, ORDER_ITEMS_MAX],
    );
    return rows.map(row => toSupplierExportLine(row));
  }

  private instant(value: Date | null): string | null {
    return value === null ? null : value.toISOString();
  }
}
