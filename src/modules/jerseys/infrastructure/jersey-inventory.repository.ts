import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { toInventory } from '../lib/jerseys.mapper';
import { INVENTORY_COLUMNS, LIST_MAX_LIMIT } from '../model/jerseys.constants';
import type { JerseySize, KitType } from '../model/jerseys.enums';
import type {
  InventoryRow,
  JerseyCountRow,
  JerseyIdRow,
} from '../model/jerseys.rows';
import type {
  JerseyInventory,
  NewJerseyIssue,
  PageRequest,
} from '../model/jerseys.types';

/**
 * Persistence for jersey inventory and the append-only issue ledger. Data access
 * only: parameterized SQL, static column lists, bounded reads. Stock counts are
 * moved by a single guarded UPDATE that refuses to go below zero on hand — an
 * over-issue leaves the row untouched and the caller sees insufficient stock.
 */
@Injectable()
export class JerseyInventoryRepository {
  /** Ensure a variant row exists, then return it for the caller. */
  async ensureVariant(
    scope: TransactionScope,
    id: string,
    teamId: string,
    productId: string,
    size: JerseySize,
    kitType: KitType,
    now: Date,
  ): Promise<JerseyInventory> {
    await scope.run(
      `INSERT INTO "jersey_inventory"
        ("id", "team_id", "product_id", "size", "kit_type", "created_at",
         "updated_at")
       VALUES ($1, $2, $3, $4, $5, $6, $6)
       ON CONFLICT ("team_id", "product_id", "size", "kit_type")
       DO NOTHING`,
      [id, teamId, productId, size, kitType, now.toISOString()],
    );
    const rows = await scope.run<InventoryRow>(
      `SELECT ${INVENTORY_COLUMNS} FROM "jersey_inventory"
        WHERE "team_id" = $1 AND "product_id" = $2 AND "size" = $3
          AND "kit_type" = $4`,
      [teamId, productId, size, kitType],
    );
    const row = rows[0];
    if (row === undefined) {
      throw new Error('Expected a returned row from the inventory ensure');
    }
    return toInventory(row);
  }

  /**
   * Apply a signed stock delta and the matching issued/returned tally. The
   * on-hand guard `+ delta >= 0` makes an over-issue a no-op that returns null.
   */
  async applyMovement(
    scope: TransactionScope,
    inventoryId: string,
    delta: number,
    issuedDelta: number,
    returnedDelta: number,
    now: Date,
  ): Promise<JerseyInventory | null> {
    const rows = await scope.run<InventoryRow>(
      `UPDATE "jersey_inventory"
          SET "on_hand" = "on_hand" + $2,
              "issued" = "issued" + $3,
              "returned" = "returned" + $4,
              "updated_at" = $5,
              "record_version" = "record_version" + 1
        WHERE "id" = $1 AND "on_hand" + $2 >= 0
       RETURNING ${INVENTORY_COLUMNS}`,
      [inventoryId, delta, issuedDelta, returnedDelta, now.toISOString()],
    );
    const row = rows[0];
    return row === undefined ? null : toInventory(row);
  }

  async insertIssue(
    scope: TransactionScope,
    issue: NewJerseyIssue,
  ): Promise<string> {
    const rows = await scope.run<JerseyIdRow>(
      `INSERT INTO "jersey_issues"
        ("id", "team_id", "product_id", "membership_id", "size", "kit_type",
         "number", "direction", "quantity", "issued_by", "issued_at")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING "id"`,
      [
        issue.id,
        issue.teamId,
        issue.productId,
        issue.membershipId,
        issue.size,
        issue.kitType,
        issue.number,
        issue.direction,
        issue.quantity,
        issue.issuedBy,
        issue.now.toISOString(),
      ],
    );
    const row = rows[0];
    if (row === undefined) {
      throw new Error('Expected a returned row from the issue write');
    }
    return row.id;
  }

  async listForTeam(
    scope: TransactionScope,
    teamId: string,
    page: PageRequest,
  ): Promise<readonly JerseyInventory[]> {
    const rows = await scope.run<InventoryRow>(
      `SELECT ${INVENTORY_COLUMNS} FROM "jersey_inventory"
        WHERE "team_id" = $1
        ORDER BY "product_id" ASC, "size" ASC, "id" ASC
        LIMIT $2 OFFSET $3`,
      [teamId, Math.min(page.limit, LIST_MAX_LIMIT), page.offset],
    );
    return rows.map(row => toInventory(row));
  }

  async countForTeam(scope: TransactionScope, teamId: string): Promise<number> {
    const rows = await scope.run<JerseyCountRow>(
      `SELECT COUNT(*)::int AS "count" FROM "jersey_inventory"
        WHERE "team_id" = $1`,
      [teamId],
    );
    return Number(rows[0]?.count ?? 0);
  }
}
