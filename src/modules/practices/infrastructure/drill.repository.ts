import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import {
  coalesceStrings,
  parseDrillCategory,
  parseDrillIntensity,
  parseDrillStatus,
} from '../lib/agendas.helpers';
import { toDate } from '../lib/practices.helpers';
import { DRILL_COLUMNS } from '../model/agendas.constants';
import type { AgendaCountRow, DrillRow } from '../model/agendas.rows';
import type {
  Drill,
  DrillUpdate,
  ListDrillsQuery,
  NewDrill,
} from '../model/agendas.types';

/**
 * Persistence for the reusable drill catalog. Team-scoped, parameterized, bounded,
 * deterministically ordered, static column lists. The insert uses `ON CONFLICT DO
 * NOTHING` against the partial unique index on active `(team_id, name)` so a
 * duplicate name is a clean null the application maps to a name conflict; archival
 * is idempotent and never deletes, so blocks that reference the drill keep a stable
 * link.
 */
@Injectable()
export class DrillRepository {
  async insert(
    scope: TransactionScope,
    drill: NewDrill,
  ): Promise<Drill | null> {
    const rows = await scope.run<DrillRow>(
      `INSERT INTO "drill_definitions" ("id", "team_id", "season_id", "name",
              "category", "objective", "instructions", "equipment", "intensity",
              "default_duration_minutes", "skill_tags", "safety_notes",
              "media_url", "created_by", "created_at", "updated_at")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
              $15)
       ON CONFLICT ("team_id", "name") WHERE "status" = 'active' DO NOTHING
       RETURNING ${DRILL_COLUMNS}`,
      [
        drill.id,
        drill.teamId,
        drill.seasonId,
        drill.name,
        drill.category,
        drill.objective,
        drill.instructions,
        [...drill.equipment],
        drill.intensity,
        drill.defaultDurationMinutes,
        [...drill.skillTags],
        drill.safetyNotes,
        drill.mediaUrl,
        drill.createdBy,
        drill.now.toISOString(),
      ],
    );
    const row = rows[0];
    return row === undefined ? null : this.toDrill(row);
  }

  async findByIdInTeam(
    scope: TransactionScope,
    teamId: string,
    id: string,
  ): Promise<Drill | null> {
    const rows = await scope.run<DrillRow>(
      `SELECT ${DRILL_COLUMNS} FROM "drill_definitions"
        WHERE "id" = $1 AND "team_id" = $2`,
      [id, teamId],
    );
    const row = rows[0];
    return row === undefined ? null : this.toDrill(row);
  }

  async activeNameExists(
    scope: TransactionScope,
    teamId: string,
    name: string,
    excludeId: string,
  ): Promise<boolean> {
    const rows = await scope.run<AgendaCountRow>(
      `SELECT COUNT(*)::int AS "count" FROM "drill_definitions"
        WHERE "team_id" = $1 AND "name" = $2 AND "status" = 'active'
          AND "id" <> $3`,
      [teamId, name, excludeId],
    );
    return (rows[0]?.count ?? 0) > 0;
  }

  async update(
    scope: TransactionScope,
    update: DrillUpdate,
  ): Promise<Drill | null> {
    const rows = await scope.run<DrillRow>(
      `UPDATE "drill_definitions"
          SET "name" = $2, "category" = $3, "objective" = $4,
              "instructions" = $5, "equipment" = $6, "intensity" = $7,
              "default_duration_minutes" = $8, "skill_tags" = $9,
              "safety_notes" = $10, "media_url" = $11, "updated_by" = $12,
              "updated_at" = $13, "version" = "version" + 1
        WHERE "id" = $1 AND ($14::int IS NULL OR "version" = $14)
       RETURNING ${DRILL_COLUMNS}`,
      [
        update.id,
        update.name,
        update.category,
        update.objective,
        update.instructions,
        [...update.equipment],
        update.intensity,
        update.defaultDurationMinutes,
        [...update.skillTags],
        update.safetyNotes,
        update.mediaUrl,
        update.updatedBy,
        update.now.toISOString(),
        update.expectedVersion,
      ],
    );
    const row = rows[0];
    return row === undefined ? null : this.toDrill(row);
  }

  async archive(
    scope: TransactionScope,
    teamId: string,
    id: string,
    actorUserId: string | null,
    now: Date,
  ): Promise<Drill | null> {
    const rows = await scope.run<DrillRow>(
      `UPDATE "drill_definitions"
          SET "status" = 'archived', "updated_by" = $3, "updated_at" = $4,
              "version" = "version" + 1
        WHERE "id" = $1 AND "team_id" = $2 AND "status" = 'active'
       RETURNING ${DRILL_COLUMNS}`,
      [id, teamId, actorUserId, now.toISOString()],
    );
    const row = rows[0];
    return row === undefined ? null : this.toDrill(row);
  }

  async list(
    scope: TransactionScope,
    teamId: string,
    query: ListDrillsQuery,
  ): Promise<readonly Drill[]> {
    const rows = await scope.run<DrillRow>(
      `SELECT ${DRILL_COLUMNS} FROM "drill_definitions"
        WHERE "team_id" = $1
          AND ($2::text IS NULL OR "category" = $2)
          AND ($3::text IS NULL OR "status" = $3)
          AND ($4::text IS NULL OR $4 = ANY("skill_tags"))
        ORDER BY "name" ASC, "id" ASC
        LIMIT $5 OFFSET $6`,
      [
        teamId,
        query.category,
        query.status,
        query.skillTag,
        query.limit,
        query.offset,
      ],
    );
    return rows.map(row => this.toDrill(row));
  }

  async count(
    scope: TransactionScope,
    teamId: string,
    query: ListDrillsQuery,
  ): Promise<number> {
    const rows = await scope.run<AgendaCountRow>(
      `SELECT COUNT(*)::int AS "count" FROM "drill_definitions"
        WHERE "team_id" = $1
          AND ($2::text IS NULL OR "category" = $2)
          AND ($3::text IS NULL OR "status" = $3)
          AND ($4::text IS NULL OR $4 = ANY("skill_tags"))`,
      [teamId, query.category, query.status, query.skillTag],
    );
    return rows[0]?.count ?? 0;
  }

  private toDrill(row: DrillRow): Drill {
    return {
      id: row.id,
      teamId: row.team_id,
      seasonId: row.season_id,
      name: row.name,
      category: parseDrillCategory(row.category),
      objective: row.objective,
      instructions: row.instructions,
      equipment: coalesceStrings(row.equipment),
      intensity: parseDrillIntensity(row.intensity),
      defaultDurationMinutes: row.default_duration_minutes,
      skillTags: coalesceStrings(row.skill_tags),
      safetyNotes: row.safety_notes,
      mediaUrl: row.media_url,
      status: parseDrillStatus(row.status),
      createdBy: row.created_by,
      updatedBy: row.updated_by,
      createdAt: toDate(row.created_at),
      updatedAt: toDate(row.updated_at),
      version: row.version,
    };
  }
}
