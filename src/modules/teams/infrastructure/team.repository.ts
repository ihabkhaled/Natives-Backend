import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { parseTeamStatus, toDate, toNullableDate } from '../lib/teams.helpers';
import type { CountRow, IdRow, TeamRow } from '../model/teams.rows';
import type {
  ListTeamsResult,
  NewTeam,
  PageRequest,
  Team,
  TeamRemoval,
  TeamStatusChange,
  TeamUpdate,
} from '../model/teams.types';

/**
 * Persistence for the teams aggregate. Data access only: parameterized SQL run
 * through the caller's transaction scope, mapping snake_case rows into the
 * vendor-free Team type. Static column lists, bounded/paginated reads,
 * deterministic ordering, optimistic-version guarded writes. No interpolation.
 *
 * Soft-removed teams (`deleted_at` set) are filtered out of every read; the rows
 * themselves are never deleted, so every historical reference stays valid.
 */
@Injectable()
export class TeamRepository {
  async findById(scope: TransactionScope, id: string): Promise<Team | null> {
    const rows = await scope.run<TeamRow>(
      `SELECT "id", "slug", "name", "locale", "timezone", "primary_color",
              "logo_media_key", "status", "deleted_at", "created_by",
              "updated_by", "created_at", "updated_at", "version"
         FROM "teams" WHERE "id" = $1 AND "deleted_at" IS NULL`,
      [id],
    );
    const row = rows[0];
    return row === undefined ? null : this.toTeam(row);
  }

  async existsBySlug(scope: TransactionScope, slug: string): Promise<boolean> {
    const rows = await scope.run<IdRow>(
      `SELECT "id" FROM "teams" WHERE lower("slug") = lower($1)`,
      [slug],
    );
    return rows.length > 0;
  }

  async insert(scope: TransactionScope, team: NewTeam): Promise<Team> {
    const rows = await scope.run<TeamRow>(
      `INSERT INTO "teams" ("id", "slug", "name", "locale", "timezone",
              "primary_color", "logo_media_key", "created_by", "created_at",
              "updated_at")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
       RETURNING "id", "slug", "name", "locale", "timezone", "primary_color",
              "logo_media_key", "status", "deleted_at", "created_by",
              "updated_by", "created_at", "updated_at", "version"`,
      [
        team.id,
        team.slug,
        team.name,
        team.locale,
        team.timezone,
        team.primaryColor,
        team.logoMediaKey,
        team.createdBy,
        team.now.toISOString(),
      ],
    );
    return this.toTeam(this.requireRow(rows));
  }

  async update(
    scope: TransactionScope,
    update: TeamUpdate,
  ): Promise<Team | null> {
    const rows = await scope.run<TeamRow>(
      `UPDATE "teams"
          SET "name" = $2, "locale" = $3, "timezone" = $4, "primary_color" = $5,
              "logo_media_key" = $6, "updated_by" = $7, "updated_at" = $8,
              "version" = "version" + 1
        WHERE "id" = $1 AND "version" = $9 AND "status" = 'active'
          AND "deleted_at" IS NULL
       RETURNING "id", "slug", "name", "locale", "timezone", "primary_color",
              "logo_media_key", "status", "deleted_at", "created_by",
              "updated_by", "created_at", "updated_at", "version"`,
      [
        update.id,
        update.name,
        update.locale,
        update.timezone,
        update.primaryColor,
        update.logoMediaKey,
        update.updatedBy,
        update.now.toISOString(),
        update.expectedVersion,
      ],
    );
    const row = rows[0];
    return row === undefined ? null : this.toTeam(row);
  }

  /**
   * Applies a lifecycle state change under optimistic concurrency. Which target
   * state is legal is decided by the pure state machine before this is called.
   */
  async applyStatusChange(
    scope: TransactionScope,
    change: TeamStatusChange,
  ): Promise<Team | null> {
    const rows = await scope.run<TeamRow>(
      `UPDATE "teams"
          SET "status" = $2, "updated_by" = $3, "updated_at" = $4,
              "version" = "version" + 1
        WHERE "id" = $1 AND ($5::int IS NULL OR "version" = $5::int)
          AND "deleted_at" IS NULL
       RETURNING "id", "slug", "name", "locale", "timezone", "primary_color",
              "logo_media_key", "status", "deleted_at", "created_by",
              "updated_by", "created_at", "updated_at", "version"`,
      [
        change.id,
        change.status,
        change.updatedBy,
        change.now.toISOString(),
        change.expectedVersion,
      ],
    );
    const row = rows[0];
    return row === undefined ? null : this.toTeam(row);
  }

  /**
   * Soft removal: stamps `deleted_at`. The row and every record referencing it
   * survive — no team is ever hard-deleted.
   */
  async softRemove(
    scope: TransactionScope,
    removal: TeamRemoval,
  ): Promise<Team | null> {
    const rows = await scope.run<TeamRow>(
      `UPDATE "teams"
          SET "deleted_at" = $3, "updated_by" = $2, "updated_at" = $3,
              "version" = "version" + 1
        WHERE "id" = $1 AND ($4::int IS NULL OR "version" = $4::int)
          AND "deleted_at" IS NULL
       RETURNING "id", "slug", "name", "locale", "timezone", "primary_color",
              "logo_media_key", "status", "deleted_at", "created_by",
              "updated_by", "created_at", "updated_at", "version"`,
      [
        removal.id,
        removal.updatedBy,
        removal.now.toISOString(),
        removal.expectedVersion,
      ],
    );
    const row = rows[0];
    return row === undefined ? null : this.toTeam(row);
  }

  async list(
    scope: TransactionScope,
    page: PageRequest,
  ): Promise<ListTeamsResult> {
    const rows = await scope.run<TeamRow>(
      `SELECT "id", "slug", "name", "locale", "timezone", "primary_color",
              "logo_media_key", "status", "deleted_at", "created_by",
              "updated_by", "created_at", "updated_at", "version"
         FROM "teams"
        WHERE "deleted_at" IS NULL
        ORDER BY "created_at" ASC, "id" ASC
        LIMIT $1 OFFSET $2`,
      [page.limit, page.offset],
    );
    const counts = await scope.run<CountRow>(
      `SELECT COUNT(*)::int AS "count" FROM "teams" WHERE "deleted_at" IS NULL`,
    );
    return {
      items: rows.map(row => this.toTeam(row)),
      total: counts[0]?.count ?? 0,
      limit: page.limit,
      offset: page.offset,
    };
  }

  /**
   * Bounded page of only the teams a principal holds a live role assignment in.
   * Backs the team-scoped directory so a team administrator never sees the whole
   * platform, which only a platform-scoped grant unlocks.
   */
  async listForUser(
    scope: TransactionScope,
    userId: string,
    page: PageRequest,
  ): Promise<ListTeamsResult> {
    const rows = await scope.run<TeamRow>(
      `SELECT t."id", t."slug", t."name", t."locale", t."timezone",
              t."primary_color", t."logo_media_key", t."status", t."deleted_at",
              t."created_by", t."updated_by", t."created_at", t."updated_at",
              t."version"
         FROM "teams" t
        WHERE t."deleted_at" IS NULL
          AND EXISTS (
            SELECT 1 FROM "user_role_assignments" a
             WHERE a."user_id" = $1 AND a."team_id" = t."id"
               AND a."revoked_at" IS NULL
          )
        ORDER BY t."created_at" ASC, t."id" ASC
        LIMIT $2 OFFSET $3`,
      [userId, page.limit, page.offset],
    );
    const counts = await scope.run<CountRow>(
      `SELECT COUNT(*)::int AS "count" FROM "teams" t
        WHERE t."deleted_at" IS NULL
          AND EXISTS (
            SELECT 1 FROM "user_role_assignments" a
             WHERE a."user_id" = $1 AND a."team_id" = t."id"
               AND a."revoked_at" IS NULL
          )`,
      [userId],
    );
    return {
      items: rows.map(row => this.toTeam(row)),
      total: counts[0]?.count ?? 0,
      limit: page.limit,
      offset: page.offset,
    };
  }

  private requireRow(rows: readonly TeamRow[]): TeamRow {
    const row = rows[0];
    if (row === undefined) {
      throw new Error('Expected a returned row from the team write');
    }
    return row;
  }

  private toTeam(row: TeamRow): Team {
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      locale: row.locale,
      timezone: row.timezone,
      primaryColor: row.primary_color,
      logoMediaKey: row.logo_media_key,
      status: parseTeamStatus(row.status),
      deletedAt: toNullableDate(row.deleted_at),
      createdBy: row.created_by,
      updatedBy: row.updated_by,
      createdAt: toDate(row.created_at),
      updatedAt: toDate(row.updated_at),
      version: row.version,
    };
  }
}
