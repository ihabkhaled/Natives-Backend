import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { toProduct } from '../lib/jerseys.mapper';
import { LIST_MAX_LIMIT, PRODUCT_COLUMNS } from '../model/jerseys.constants';
import type { JerseyCountRow, ProductRow } from '../model/jerseys.rows';
import type {
  JerseyProduct,
  NewJerseyProduct,
  PageRequest,
} from '../model/jerseys.types';

/**
 * Persistence for jersey products. Data access only: parameterized SQL, static
 * column lists, bounded reads. Product keys are unique per team, so an insert is
 * an upsert that keeps the catalogue idempotent.
 */
@Injectable()
export class JerseyProductRepository {
  async insert(
    scope: TransactionScope,
    product: NewJerseyProduct,
  ): Promise<JerseyProduct> {
    const rows = await scope.run<ProductRow>(
      `INSERT INTO "jersey_products"
        ("id", "team_id", "season_id", "product_key", "name", "kit_type",
         "supplier", "customizable", "created_by", "created_at", "updated_at")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)
       ON CONFLICT ("team_id", "product_key") DO UPDATE SET
         "name" = EXCLUDED."name",
         "kit_type" = EXCLUDED."kit_type",
         "supplier" = EXCLUDED."supplier",
         "customizable" = EXCLUDED."customizable",
         "status" = 'active',
         "updated_at" = EXCLUDED."updated_at"
       RETURNING ${PRODUCT_COLUMNS}`,
      [
        product.id,
        product.teamId,
        product.seasonId,
        product.productKey,
        product.name,
        product.kitType,
        product.supplier,
        product.customizable,
        product.createdBy,
        product.now.toISOString(),
      ],
    );
    const row = rows[0];
    if (row === undefined) {
      throw new Error('Expected a returned row from the product write');
    }
    return toProduct(row);
  }

  async findForWrite(
    scope: TransactionScope,
    teamId: string,
    productId: string,
  ): Promise<JerseyProduct | null> {
    const rows = await scope.run<ProductRow>(
      `SELECT ${PRODUCT_COLUMNS} FROM "jersey_products"
        WHERE "id" = $1 AND "team_id" = $2`,
      [productId, teamId],
    );
    const row = rows[0];
    return row === undefined ? null : toProduct(row);
  }

  async listForTeam(
    scope: TransactionScope,
    teamId: string,
    page: PageRequest,
  ): Promise<readonly JerseyProduct[]> {
    const rows = await scope.run<ProductRow>(
      `SELECT ${PRODUCT_COLUMNS} FROM "jersey_products"
        WHERE "team_id" = $1
        ORDER BY "product_key" ASC, "id" ASC
        LIMIT $2 OFFSET $3`,
      [teamId, Math.min(page.limit, LIST_MAX_LIMIT), page.offset],
    );
    return rows.map(row => toProduct(row));
  }

  async countForTeam(scope: TransactionScope, teamId: string): Promise<number> {
    const rows = await scope.run<JerseyCountRow>(
      `SELECT COUNT(*)::int AS "count" FROM "jersey_products"
        WHERE "team_id" = $1`,
      [teamId],
    );
    return Number(rows[0]?.count ?? 0);
  }
}
