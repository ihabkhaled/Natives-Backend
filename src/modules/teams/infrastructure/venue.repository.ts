import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import {
  parseResourceStatus,
  toDate,
  toNullableNumber,
} from '../lib/teams.helpers';
import type { CountRow, IdRow, VenueRow } from '../model/teams.rows';
import type {
  ListVenuesResult,
  NewVenue,
  PageRequest,
  Venue,
  VenueUpdate,
} from '../model/teams.types';

/**
 * Persistence for the venues aggregate. Team-scoped, parameterized, bounded, and
 * deterministically ordered. Numeric coordinates are returned as strings by the
 * driver and mapped preserving null (null-not-zero): an absent coordinate stays
 * null, never 0.
 */
@Injectable()
export class VenueRepository {
  async findByIdInTeam(
    scope: TransactionScope,
    teamId: string,
    id: string,
  ): Promise<Venue | null> {
    const rows = await scope.run<VenueRow>(
      `SELECT "id", "team_id", "name", "address", "timezone", "latitude",
              "longitude", "status", "created_by", "updated_by", "created_at",
              "updated_at", "version"
         FROM "venues" WHERE "id" = $1 AND "team_id" = $2`,
      [id, teamId],
    );
    const row = rows[0];
    return row === undefined ? null : this.toVenue(row);
  }

  async existsByName(
    scope: TransactionScope,
    teamId: string,
    name: string,
  ): Promise<boolean> {
    const rows = await scope.run<IdRow>(
      `SELECT "id" FROM "venues"
        WHERE "team_id" = $1 AND lower("name") = lower($2)`,
      [teamId, name],
    );
    return rows.length > 0;
  }

  async insert(scope: TransactionScope, venue: NewVenue): Promise<Venue> {
    const rows = await scope.run<VenueRow>(
      `INSERT INTO "venues" ("id", "team_id", "name", "address", "timezone",
              "latitude", "longitude", "created_by", "created_at", "updated_at")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
       RETURNING "id", "team_id", "name", "address", "timezone", "latitude",
              "longitude", "status", "created_by", "updated_by", "created_at",
              "updated_at", "version"`,
      [
        venue.id,
        venue.teamId,
        venue.name,
        venue.address,
        venue.timezone,
        venue.latitude,
        venue.longitude,
        venue.createdBy,
        venue.now.toISOString(),
      ],
    );
    return this.toVenue(this.requireRow(rows));
  }

  async update(
    scope: TransactionScope,
    update: VenueUpdate,
  ): Promise<Venue | null> {
    const rows = await scope.run<VenueRow>(
      `UPDATE "venues"
          SET "name" = $3, "address" = $4, "timezone" = $5, "latitude" = $6,
              "longitude" = $7, "status" = $8, "updated_by" = $9,
              "updated_at" = $10, "version" = "version" + 1
        WHERE "id" = $1 AND "team_id" = $2 AND "version" = $11
       RETURNING "id", "team_id", "name", "address", "timezone", "latitude",
              "longitude", "status", "created_by", "updated_by", "created_at",
              "updated_at", "version"`,
      [
        update.id,
        update.teamId,
        update.name,
        update.address,
        update.timezone,
        update.latitude,
        update.longitude,
        update.status,
        update.updatedBy,
        update.now.toISOString(),
        update.expectedVersion,
      ],
    );
    const row = rows[0];
    return row === undefined ? null : this.toVenue(row);
  }

  async archive(
    scope: TransactionScope,
    teamId: string,
    id: string,
    actorId: string | null,
    now: Date,
  ): Promise<Venue | null> {
    const rows = await scope.run<VenueRow>(
      `UPDATE "venues"
          SET "status" = 'archived', "updated_by" = $3, "updated_at" = $4,
              "version" = "version" + 1
        WHERE "id" = $1 AND "team_id" = $2 AND "status" = 'active'
       RETURNING "id", "team_id", "name", "address", "timezone", "latitude",
              "longitude", "status", "created_by", "updated_by", "created_at",
              "updated_at", "version"`,
      [id, teamId, actorId, now.toISOString()],
    );
    const row = rows[0];
    return row === undefined ? null : this.toVenue(row);
  }

  async list(
    scope: TransactionScope,
    teamId: string,
    page: PageRequest,
  ): Promise<ListVenuesResult> {
    const rows = await scope.run<VenueRow>(
      `SELECT "id", "team_id", "name", "address", "timezone", "latitude",
              "longitude", "status", "created_by", "updated_by", "created_at",
              "updated_at", "version"
         FROM "venues" WHERE "team_id" = $1
        ORDER BY lower("name") ASC, "id" ASC
        LIMIT $2 OFFSET $3`,
      [teamId, page.limit, page.offset],
    );
    const counts = await scope.run<CountRow>(
      `SELECT COUNT(*)::int AS "count" FROM "venues" WHERE "team_id" = $1`,
      [teamId],
    );
    return {
      items: rows.map(row => this.toVenue(row)),
      total: counts[0]?.count ?? 0,
      limit: page.limit,
      offset: page.offset,
    };
  }

  private requireRow(rows: readonly VenueRow[]): VenueRow {
    const row = rows[0];
    if (row === undefined) {
      throw new Error('Expected a returned row from the venue write');
    }
    return row;
  }

  private toVenue(row: VenueRow): Venue {
    return {
      id: row.id,
      teamId: row.team_id,
      name: row.name,
      address: row.address,
      timezone: row.timezone,
      latitude: toNullableNumber(row.latitude),
      longitude: toNullableNumber(row.longitude),
      status: parseResourceStatus(row.status),
      createdBy: row.created_by,
      updatedBy: row.updated_by,
      createdAt: toDate(row.created_at),
      updatedAt: toDate(row.updated_at),
      version: row.version,
    };
  }
}
