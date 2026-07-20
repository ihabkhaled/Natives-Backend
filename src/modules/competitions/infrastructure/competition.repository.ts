import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { toCompetition } from '../lib/competitions.mapper';
import {
  COMPETITION_COLUMNS,
  LIST_MAX_LIMIT,
} from '../model/competitions.constants';
import type { CompetitionRow, CountRow } from '../model/competitions.rows';
import type {
  Competition,
  CompetitionStatusChange,
  NewCompetition,
  PageRequest,
} from '../model/competitions.types';

/**
 * Persistence for the competition aggregate. Data access only: parameterized SQL
 * through the caller's transaction scope, static column lists, optimistic-version-
 * guarded writes, and bounded/ordered reads. Soft-deleted rows are excluded.
 */
@Injectable()
export class CompetitionRepository {
  async insert(
    scope: TransactionScope,
    competition: NewCompetition,
  ): Promise<Competition> {
    const rows = await scope.run<CompetitionRow>(
      `INSERT INTO "competitions"
        ("id", "team_id", "season_id", "name", "competition_type", "status",
         "gender_division", "organizer_name", "external_ref", "starts_on",
         "ends_on", "description", "created_by", "created_at", "updated_at")
       VALUES ($1, $2, $3, $4, $5, 'draft', $6, $7, $8, $9, $10, $11, $12, $13,
               $13)
       RETURNING ${COMPETITION_COLUMNS}`,
      this.insertParameters(competition),
    );
    return toCompetition(this.requireRow(rows));
  }

  async findForWrite(
    scope: TransactionScope,
    teamId: string,
    competitionId: string,
  ): Promise<Competition | null> {
    const rows = await scope.run<CompetitionRow>(
      `SELECT ${COMPETITION_COLUMNS} FROM "competitions"
        WHERE "id" = $1 AND "team_id" = $2 AND "deleted_at" IS NULL`,
      [competitionId, teamId],
    );
    const row = rows[0];
    return row === undefined ? null : toCompetition(row);
  }

  async applyStatusChange(
    scope: TransactionScope,
    change: CompetitionStatusChange,
  ): Promise<Competition | null> {
    const rows = await scope.run<CompetitionRow>(
      `UPDATE "competitions"
          SET "status" = $4, "published_by" = $5, "published_at" = $6,
              "activated_at" = $7, "completed_at" = $8, "cancelled_at" = $9,
              "archived_at" = $10, "cancellation_reason" = $11,
              "updated_at" = $12, "record_version" = "record_version" + 1
        WHERE "id" = $1 AND "team_id" = $2 AND "record_version" = $3
          AND "deleted_at" IS NULL
       RETURNING ${COMPETITION_COLUMNS}`,
      this.statusParameters(change),
    );
    const row = rows[0];
    return row === undefined ? null : toCompetition(row);
  }

  async listForScope(
    scope: TransactionScope,
    teamId: string,
    seasonId: string | null,
    page: PageRequest,
  ): Promise<readonly Competition[]> {
    const rows = await scope.run<CompetitionRow>(
      `SELECT ${COMPETITION_COLUMNS} FROM "competitions"
        WHERE "team_id" = $1 AND ($2::uuid IS NULL OR "season_id" = $2)
          AND "deleted_at" IS NULL
        ORDER BY "created_at" DESC, "id" ASC
        LIMIT $3 OFFSET $4`,
      [teamId, seasonId, Math.min(page.limit, LIST_MAX_LIMIT), page.offset],
    );
    return rows.map(row => toCompetition(row));
  }

  async countForScope(
    scope: TransactionScope,
    teamId: string,
    seasonId: string | null,
  ): Promise<number> {
    const rows = await scope.run<CountRow>(
      `SELECT COUNT(*)::int AS "count" FROM "competitions"
        WHERE "team_id" = $1 AND ($2::uuid IS NULL OR "season_id" = $2)
          AND "deleted_at" IS NULL`,
      [teamId, seasonId],
    );
    return rows[0]?.count ?? 0;
  }

  private insertParameters(competition: NewCompetition): readonly unknown[] {
    const { content } = competition;
    return [
      competition.id,
      competition.teamId,
      content.seasonId,
      content.name,
      content.competitionType,
      content.genderDivision,
      content.organizerName,
      content.externalRef,
      content.startsOn,
      content.endsOn,
      content.description,
      competition.createdBy,
      competition.now.toISOString(),
    ];
  }

  private statusParameters(
    change: CompetitionStatusChange,
  ): readonly unknown[] {
    return [
      change.id,
      change.teamId,
      change.expectedRecordVersion,
      change.toStatus,
      change.publishedBy,
      change.publishedAt === null ? null : change.publishedAt.toISOString(),
      change.activatedAt === null ? null : change.activatedAt.toISOString(),
      change.completedAt === null ? null : change.completedAt.toISOString(),
      change.cancelledAt === null ? null : change.cancelledAt.toISOString(),
      change.archivedAt === null ? null : change.archivedAt.toISOString(),
      change.cancellationReason,
      change.now.toISOString(),
    ];
  }

  private requireRow(rows: readonly CompetitionRow[]): CompetitionRow {
    const row = rows[0];
    if (row === undefined) {
      throw new Error('Expected a returned row from the competition write');
    }
    return row;
  }
}
