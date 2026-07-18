import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { parseResourceStatus, toDate } from '../lib/teams.helpers';
import type { CountRow, IdRow, TeamRow } from '../model/teams.rows';
import type {
  ListTeamsResult,
  NewTeam,
  PageRequest,
  Team,
  TeamUpdate,
} from '../model/teams.types';

/**
 * Persistence for the teams aggregate. Data access only: parameterized SQL run
 * through the caller's transaction scope, mapping snake_case rows into the
 * vendor-free Team type. Static column lists, bounded/paginated reads,
 * deterministic ordering, optimistic-version guarded writes. No interpolation.
 */
@Injectable()
export class TeamRepository {
  async findById(scope: TransactionScope, id: string): Promise<Team | null> {
    const rows = await scope.run<TeamRow>(
      `SELECT "id", "slug", "name", "locale", "timezone", "primary_color",
              "logo_media_key", "status", "created_by", "updated_by",
              "created_at", "updated_at", "version"
         FROM "teams" WHERE "id" = $1`,
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
              "logo_media_key", "status", "created_by", "updated_by",
              "created_at", "updated_at", "version"`,
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
       RETURNING "id", "slug", "name", "locale", "timezone", "primary_color",
              "logo_media_key", "status", "created_by", "updated_by",
              "created_at", "updated_at", "version"`,
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

  async archive(
    scope: TransactionScope,
    id: string,
    actorId: string | null,
    now: Date,
  ): Promise<Team | null> {
    const rows = await scope.run<TeamRow>(
      `UPDATE "teams"
          SET "status" = 'archived', "updated_by" = $2, "updated_at" = $3,
              "version" = "version" + 1
        WHERE "id" = $1 AND "status" = 'active'
       RETURNING "id", "slug", "name", "locale", "timezone", "primary_color",
              "logo_media_key", "status", "created_by", "updated_by",
              "created_at", "updated_at", "version"`,
      [id, actorId, now.toISOString()],
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
              "logo_media_key", "status", "created_by", "updated_by",
              "created_at", "updated_at", "version"
         FROM "teams"
        ORDER BY "created_at" ASC, "id" ASC
        LIMIT $1 OFFSET $2`,
      [page.limit, page.offset],
    );
    const counts = await scope.run<CountRow>(
      `SELECT COUNT(*)::int AS "count" FROM "teams"`,
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
      status: parseResourceStatus(row.status),
      createdBy: row.created_by,
      updatedBy: row.updated_by,
      createdAt: toDate(row.created_at),
      updatedAt: toDate(row.updated_at),
      version: row.version,
    };
  }
}
