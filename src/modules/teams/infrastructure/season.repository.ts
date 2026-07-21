import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { parseSeasonStatus, toDate } from '../lib/teams.helpers';
import type {
  CountRow,
  IdRow,
  SeasonRangeRow,
  SeasonRow,
} from '../model/teams.rows';
import type {
  ListSeasonsResult,
  NewSeason,
  PageRequest,
  Season,
  SeasonDateRange,
  SeasonStatusChange,
  SeasonUpdate,
} from '../model/teams.types';

/**
 * Persistence for the seasons aggregate. Team-scoped, parameterized, bounded, and
 * deterministically ordered. Date-only columns are read as ISO `YYYY-MM-DD`
 * strings via `to_char` so no timezone conversion is ever applied to a calendar
 * date. Overlap is decided by the pure domain policy over the ranges this returns.
 */
@Injectable()
export class SeasonRepository {
  async findByIdInTeam(
    scope: TransactionScope,
    teamId: string,
    id: string,
  ): Promise<Season | null> {
    const rows = await scope.run<SeasonRow>(
      `SELECT "id", "team_id", "slug", "name",
              to_char("starts_on", 'YYYY-MM-DD') AS "starts_on",
              to_char("ends_on", 'YYYY-MM-DD') AS "ends_on",
              "status", "created_by", "updated_by", "created_at", "updated_at",
              "version"
         FROM "seasons" WHERE "id" = $1 AND "team_id" = $2`,
      [id, teamId],
    );
    const row = rows[0];
    return row === undefined ? null : this.toSeason(row);
  }

  async existsBySlug(
    scope: TransactionScope,
    teamId: string,
    slug: string,
  ): Promise<boolean> {
    const rows = await scope.run<IdRow>(
      `SELECT "id" FROM "seasons"
        WHERE "team_id" = $1 AND lower("slug") = lower($2)`,
      [teamId, slug],
    );
    return rows.length > 0;
  }

  async listActiveRanges(
    scope: TransactionScope,
    teamId: string,
    limit: number,
  ): Promise<readonly SeasonDateRange[]> {
    const rows = await scope.run<SeasonRangeRow>(
      `SELECT "id", to_char("starts_on", 'YYYY-MM-DD') AS "starts_on",
              to_char("ends_on", 'YYYY-MM-DD') AS "ends_on"
         FROM "seasons"
        WHERE "team_id" = $1 AND "status" <> 'archived'
        ORDER BY "starts_on" ASC, "id" ASC
        LIMIT $2`,
      [teamId, limit],
    );
    return rows.map(row => ({
      id: row.id,
      startsOn: row.starts_on,
      endsOn: row.ends_on,
    }));
  }

  /**
   * The team's single current season: the one holding the `active` slot that the
   * partial unique index `ux_seasons_one_active_per_team` guarantees is unique.
   * Returns null (never a guess) when the team has no active season, so callers
   * distinguish "no current season" from "some season".
   */
  async findCurrent(
    scope: TransactionScope,
    teamId: string,
  ): Promise<Season | null> {
    const rows = await scope.run<SeasonRow>(
      `SELECT "id", "team_id", "slug", "name",
              to_char("starts_on", 'YYYY-MM-DD') AS "starts_on",
              to_char("ends_on", 'YYYY-MM-DD') AS "ends_on",
              "status", "created_by", "updated_by", "created_at", "updated_at",
              "version"
         FROM "seasons"
        WHERE "team_id" = $1 AND "status" = 'active'
        ORDER BY "starts_on" DESC, "id" DESC
        LIMIT 1`,
      [teamId],
    );
    const row = rows[0];
    return row === undefined ? null : this.toSeason(row);
  }

  /**
   * True when the team already has an `active` season other than `excludeId`.
   * Pre-checked so activation returns a typed conflict rather than surfacing the
   * unique-index violation from the driver.
   */
  async hasOtherActive(
    scope: TransactionScope,
    teamId: string,
    excludeId: string | null,
  ): Promise<boolean> {
    const rows = await scope.run<IdRow>(
      `SELECT "id" FROM "seasons"
        WHERE "team_id" = $1 AND "status" = 'active'
          AND ($2::uuid IS NULL OR "id" <> $2::uuid)
        LIMIT 1`,
      [teamId, excludeId],
    );
    return rows.length > 0;
  }

  /**
   * Applies a lifecycle state change under optimistic concurrency. Which target
   * state is legal is decided by the pure state machine before this is called.
   */
  async applyStatusChange(
    scope: TransactionScope,
    change: SeasonStatusChange,
  ): Promise<Season | null> {
    const rows = await scope.run<SeasonRow>(
      `UPDATE "seasons"
          SET "status" = $3, "updated_by" = $4, "updated_at" = $5,
              "version" = "version" + 1
        WHERE "id" = $1 AND "team_id" = $2
          AND ($6::int IS NULL OR "version" = $6::int)
       RETURNING "id", "team_id", "slug", "name",
              to_char("starts_on", 'YYYY-MM-DD') AS "starts_on",
              to_char("ends_on", 'YYYY-MM-DD') AS "ends_on",
              "status", "created_by", "updated_by", "created_at", "updated_at",
              "version"`,
      [
        change.id,
        change.teamId,
        change.status,
        change.updatedBy,
        change.now.toISOString(),
        change.expectedVersion,
      ],
    );
    const row = rows[0];
    return row === undefined ? null : this.toSeason(row);
  }

  async insert(scope: TransactionScope, season: NewSeason): Promise<Season> {
    const rows = await scope.run<SeasonRow>(
      `INSERT INTO "seasons" ("id", "team_id", "slug", "name", "starts_on",
              "ends_on", "status", "created_by", "created_at", "updated_at")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
       RETURNING "id", "team_id", "slug", "name",
              to_char("starts_on", 'YYYY-MM-DD') AS "starts_on",
              to_char("ends_on", 'YYYY-MM-DD') AS "ends_on",
              "status", "created_by", "updated_by", "created_at", "updated_at",
              "version"`,
      [
        season.id,
        season.teamId,
        season.slug,
        season.name,
        season.startsOn,
        season.endsOn,
        season.status,
        season.createdBy,
        season.now.toISOString(),
      ],
    );
    return this.toSeason(this.requireRow(rows));
  }

  async update(
    scope: TransactionScope,
    update: SeasonUpdate,
  ): Promise<Season | null> {
    const rows = await scope.run<SeasonRow>(
      `UPDATE "seasons"
          SET "slug" = $3, "name" = $4, "starts_on" = $5, "ends_on" = $6,
              "status" = $7, "updated_by" = $8, "updated_at" = $9,
              "version" = "version" + 1
        WHERE "id" = $1 AND "team_id" = $2 AND "version" = $10
       RETURNING "id", "team_id", "slug", "name",
              to_char("starts_on", 'YYYY-MM-DD') AS "starts_on",
              to_char("ends_on", 'YYYY-MM-DD') AS "ends_on",
              "status", "created_by", "updated_by", "created_at", "updated_at",
              "version"`,
      [
        update.id,
        update.teamId,
        update.slug,
        update.name,
        update.startsOn,
        update.endsOn,
        update.status,
        update.updatedBy,
        update.now.toISOString(),
        update.expectedVersion,
      ],
    );
    const row = rows[0];
    return row === undefined ? null : this.toSeason(row);
  }

  async list(
    scope: TransactionScope,
    teamId: string,
    page: PageRequest,
  ): Promise<ListSeasonsResult> {
    const rows = await scope.run<SeasonRow>(
      `SELECT "id", "team_id", "slug", "name",
              to_char("starts_on", 'YYYY-MM-DD') AS "starts_on",
              to_char("ends_on", 'YYYY-MM-DD') AS "ends_on",
              "status", "created_by", "updated_by", "created_at", "updated_at",
              "version"
         FROM "seasons" WHERE "team_id" = $1
        ORDER BY "starts_on" ASC, "id" ASC
        LIMIT $2 OFFSET $3`,
      [teamId, page.limit, page.offset],
    );
    const counts = await scope.run<CountRow>(
      `SELECT COUNT(*)::int AS "count" FROM "seasons" WHERE "team_id" = $1`,
      [teamId],
    );
    return {
      items: rows.map(row => this.toSeason(row)),
      total: counts[0]?.count ?? 0,
      limit: page.limit,
      offset: page.offset,
    };
  }

  private requireRow(rows: readonly SeasonRow[]): SeasonRow {
    const row = rows[0];
    if (row === undefined) {
      throw new Error('Expected a returned row from the season write');
    }
    return row;
  }

  private toSeason(row: SeasonRow): Season {
    return {
      id: row.id,
      teamId: row.team_id,
      slug: row.slug,
      name: row.name,
      startsOn: row.starts_on,
      endsOn: row.ends_on,
      status: parseSeasonStatus(row.status),
      createdBy: row.created_by,
      updatedBy: row.updated_by,
      createdAt: toDate(row.created_at),
      updatedAt: toDate(row.updated_at),
      version: row.version,
    };
  }
}
