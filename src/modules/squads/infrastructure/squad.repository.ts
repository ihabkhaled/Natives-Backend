import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { toSquad } from '../lib/squads.mapper';
import { LIST_MAX_LIMIT, SQUAD_COLUMNS } from '../model/squads.constants';
import type { CountRow, SquadRow } from '../model/squads.rows';
import type {
  NewSquad,
  PageRequest,
  Squad,
  SquadStatusChange,
} from '../model/squads.types';

/**
 * Persistence for the squad aggregate. Data access only: parameterized SQL
 * through the caller's transaction scope, static column lists, optimistic-version-
 * guarded writes, and bounded/ordered reads. Soft-deleted rows are excluded.
 */
@Injectable()
export class SquadRepository {
  async insert(scope: TransactionScope, squad: NewSquad): Promise<Squad> {
    const rows = await scope.run<SquadRow>(
      `INSERT INTO "squads"
        ("id", "team_id", "season_id", "competition_id", "name", "status",
         "attendance_threshold_pct", "policy_version", "selection_deadline",
         "notes", "created_by", "created_at", "updated_at")
       VALUES ($1, $2, $3, $4, $5, 'draft', $6, $7, $8, $9, $10, $11, $11)
       RETURNING ${SQUAD_COLUMNS}`,
      this.insertParameters(squad),
    );
    return toSquad(this.requireRow(rows));
  }

  async findForWrite(
    scope: TransactionScope,
    teamId: string,
    squadId: string,
  ): Promise<Squad | null> {
    const rows = await scope.run<SquadRow>(
      `SELECT ${SQUAD_COLUMNS} FROM "squads"
        WHERE "id" = $1 AND "team_id" = $2 AND "deleted_at" IS NULL`,
      [squadId, teamId],
    );
    const row = rows[0];
    return row === undefined ? null : toSquad(row);
  }

  async applyStatusChange(
    scope: TransactionScope,
    change: SquadStatusChange,
  ): Promise<Squad | null> {
    const rows = await scope.run<SquadRow>(
      `UPDATE "squads"
          SET "status" = $4,
              "revision" = "revision" + CASE WHEN $5 THEN 1 ELSE 0 END,
              "published_by" = $6, "published_at" = $7, "locked_at" = $8,
              "archived_at" = $9, "updated_at" = $10,
              "record_version" = "record_version" + 1
        WHERE "id" = $1 AND "team_id" = $2 AND "record_version" = $3
          AND "deleted_at" IS NULL
       RETURNING ${SQUAD_COLUMNS}`,
      this.statusParameters(change),
    );
    const row = rows[0];
    return row === undefined ? null : toSquad(row);
  }

  async listForScope(
    scope: TransactionScope,
    teamId: string,
    seasonId: string | null,
    page: PageRequest,
  ): Promise<readonly Squad[]> {
    const rows = await scope.run<SquadRow>(
      `SELECT ${SQUAD_COLUMNS} FROM "squads"
        WHERE "team_id" = $1 AND ($2::uuid IS NULL OR "season_id" = $2)
          AND "deleted_at" IS NULL
        ORDER BY "created_at" DESC, "id" ASC
        LIMIT $3 OFFSET $4`,
      [teamId, seasonId, Math.min(page.limit, LIST_MAX_LIMIT), page.offset],
    );
    return rows.map(row => toSquad(row));
  }

  async countForScope(
    scope: TransactionScope,
    teamId: string,
    seasonId: string | null,
  ): Promise<number> {
    const rows = await scope.run<CountRow>(
      `SELECT COUNT(*)::int AS "count" FROM "squads"
        WHERE "team_id" = $1 AND ($2::uuid IS NULL OR "season_id" = $2)
          AND "deleted_at" IS NULL`,
      [teamId, seasonId],
    );
    return rows[0]?.count ?? 0;
  }

  private insertParameters(squad: NewSquad): readonly unknown[] {
    const { content } = squad;
    return [
      squad.id,
      squad.teamId,
      content.seasonId,
      content.competitionId,
      content.name,
      content.attendanceThresholdPct,
      squad.policyVersion,
      content.selectionDeadline,
      content.notes,
      squad.createdBy,
      squad.now.toISOString(),
    ];
  }

  private statusParameters(change: SquadStatusChange): readonly unknown[] {
    return [
      change.id,
      change.teamId,
      change.expectedRecordVersion,
      change.toStatus,
      change.bumpRevision,
      change.publishedBy,
      change.publishedAt === null ? null : change.publishedAt.toISOString(),
      change.lockedAt === null ? null : change.lockedAt.toISOString(),
      change.archivedAt === null ? null : change.archivedAt.toISOString(),
      change.now.toISOString(),
    ];
  }

  private requireRow(rows: readonly SquadRow[]): SquadRow {
    const row = rows[0];
    if (row === undefined) {
      throw new Error('Expected a returned row from the squad write');
    }
    return row;
  }
}
