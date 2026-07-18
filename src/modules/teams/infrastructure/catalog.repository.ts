import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import {
  parseCatalogName,
  parseResourceStatus,
  toDate,
} from '../lib/teams.helpers';
import type { CatalogEntryRow, CountRow, IdRow } from '../model/teams.rows';
import type {
  CatalogEntry,
  ListCatalogEntriesResult,
  NewCatalogEntry,
  PageRequest,
} from '../model/teams.types';

/**
 * Persistence for the reference-catalog aggregate. Team-scoped, parameterized,
 * bounded, deterministically ordered by (sort_order, key). Entries carry a
 * reference_count so the application can block archiving an in-use entry.
 */
@Injectable()
export class CatalogRepository {
  async findByIdInTeam(
    scope: TransactionScope,
    teamId: string,
    id: string,
  ): Promise<CatalogEntry | null> {
    const rows = await scope.run<CatalogEntryRow>(
      `SELECT "id", "team_id", "catalog", "key", "label", "sort_order",
              "metadata", "reference_count", "status", "created_by",
              "updated_by", "created_at", "updated_at", "version"
         FROM "reference_catalog_entries"
        WHERE "id" = $1 AND "team_id" = $2`,
      [id, teamId],
    );
    const row = rows[0];
    return row === undefined ? null : this.toEntry(row);
  }

  async existsByKey(
    scope: TransactionScope,
    teamId: string,
    catalog: string,
    key: string,
  ): Promise<boolean> {
    const rows = await scope.run<IdRow>(
      `SELECT "id" FROM "reference_catalog_entries"
        WHERE "team_id" = $1 AND "catalog" = $2 AND "key" = $3`,
      [teamId, catalog, key],
    );
    return rows.length > 0;
  }

  async insert(
    scope: TransactionScope,
    entry: NewCatalogEntry,
  ): Promise<CatalogEntry> {
    const rows = await scope.run<CatalogEntryRow>(
      `INSERT INTO "reference_catalog_entries" ("id", "team_id", "catalog",
              "key", "label", "sort_order", "metadata", "created_by",
              "created_at", "updated_at")
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $9)
       RETURNING "id", "team_id", "catalog", "key", "label", "sort_order",
              "metadata", "reference_count", "status", "created_by",
              "updated_by", "created_at", "updated_at", "version"`,
      [
        entry.id,
        entry.teamId,
        entry.catalog,
        entry.key,
        entry.label,
        entry.sortOrder,
        JSON.stringify(entry.metadata),
        entry.createdBy,
        entry.now.toISOString(),
      ],
    );
    return this.toEntry(this.requireRow(rows));
  }

  async archive(
    scope: TransactionScope,
    teamId: string,
    id: string,
    actorId: string | null,
    now: Date,
  ): Promise<CatalogEntry | null> {
    const rows = await scope.run<CatalogEntryRow>(
      `UPDATE "reference_catalog_entries"
          SET "status" = 'archived', "updated_by" = $3, "updated_at" = $4,
              "version" = "version" + 1
        WHERE "id" = $1 AND "team_id" = $2 AND "status" = 'active'
       RETURNING "id", "team_id", "catalog", "key", "label", "sort_order",
              "metadata", "reference_count", "status", "created_by",
              "updated_by", "created_at", "updated_at", "version"`,
      [id, teamId, actorId, now.toISOString()],
    );
    const row = rows[0];
    return row === undefined ? null : this.toEntry(row);
  }

  async list(
    scope: TransactionScope,
    teamId: string,
    catalog: string,
    page: PageRequest,
  ): Promise<ListCatalogEntriesResult> {
    const rows = await scope.run<CatalogEntryRow>(
      `SELECT "id", "team_id", "catalog", "key", "label", "sort_order",
              "metadata", "reference_count", "status", "created_by",
              "updated_by", "created_at", "updated_at", "version"
         FROM "reference_catalog_entries"
        WHERE "team_id" = $1 AND "catalog" = $2
        ORDER BY "sort_order" ASC, "key" ASC
        LIMIT $3 OFFSET $4`,
      [teamId, catalog, page.limit, page.offset],
    );
    const counts = await scope.run<CountRow>(
      `SELECT COUNT(*)::int AS "count" FROM "reference_catalog_entries"
        WHERE "team_id" = $1 AND "catalog" = $2`,
      [teamId, catalog],
    );
    return {
      items: rows.map(row => this.toEntry(row)),
      total: counts[0]?.count ?? 0,
      limit: page.limit,
      offset: page.offset,
    };
  }

  private requireRow(rows: readonly CatalogEntryRow[]): CatalogEntryRow {
    const row = rows[0];
    if (row === undefined) {
      throw new Error('Expected a returned row from the catalog write');
    }
    return row;
  }

  private toEntry(row: CatalogEntryRow): CatalogEntry {
    return {
      id: row.id,
      teamId: row.team_id,
      catalog: parseCatalogName(row.catalog),
      key: row.key,
      label: row.label,
      sortOrder: row.sort_order,
      metadata: row.metadata,
      referenceCount: row.reference_count,
      status: parseResourceStatus(row.status),
      createdBy: row.created_by,
      updatedBy: row.updated_by,
      createdAt: toDate(row.created_at),
      updatedAt: toDate(row.updated_at),
      version: row.version,
    };
  }
}
