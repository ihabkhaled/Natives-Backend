import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { toAchievement } from '../lib/standings.mapper';
import {
  ACHIEVEMENT_COLUMNS,
  LIST_MAX_LIMIT,
} from '../model/standings.constants';
import type {
  AchievementRow,
  StandingsCountRow,
} from '../model/standings.rows';
import type {
  Achievement,
  AchievementListFilter,
  AchievementStatusChange,
  NewAchievement,
  PageRequest,
} from '../model/standings.types';

/**
 * Persistence for team and player achievements. Data access only: parameterized
 * SQL, static column lists, optimistic-version-guarded approval writes, and
 * bounded, deterministically ordered reads with allow-listed filters.
 */
@Injectable()
export class AchievementRepository {
  async insert(
    scope: TransactionScope,
    achievement: NewAchievement,
  ): Promise<Achievement> {
    const rows = await scope.run<AchievementRow>(
      `INSERT INTO "team_achievements"
        ("id", "team_id", "season_id", "competition_id", "membership_id",
         "category", "title", "description", "achieved_on",
         "evidence_reference", "visibility", "status", "source",
         "import_reference", "created_by", "created_at", "updated_at")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'draft', $12,
               $13, $14, $15, $15)
       RETURNING ${ACHIEVEMENT_COLUMNS}`,
      this.insertParameters(achievement),
    );
    const row = rows[0];
    if (row === undefined) {
      throw new Error('Expected a returned row from the achievement write');
    }
    return toAchievement(row);
  }

  async findForWrite(
    scope: TransactionScope,
    teamId: string,
    achievementId: string,
  ): Promise<Achievement | null> {
    const rows = await scope.run<AchievementRow>(
      `SELECT ${ACHIEVEMENT_COLUMNS} FROM "team_achievements"
        WHERE "id" = $1 AND "team_id" = $2`,
      [achievementId, teamId],
    );
    const row = rows[0];
    return row === undefined ? null : toAchievement(row);
  }

  async findByImportReference(
    scope: TransactionScope,
    teamId: string,
    reference: string,
  ): Promise<Achievement | null> {
    const rows = await scope.run<AchievementRow>(
      `SELECT ${ACHIEVEMENT_COLUMNS} FROM "team_achievements"
        WHERE "team_id" = $1 AND "import_reference" = $2`,
      [teamId, reference],
    );
    const row = rows[0];
    return row === undefined ? null : toAchievement(row);
  }

  async applyStatusChange(
    scope: TransactionScope,
    change: AchievementStatusChange,
  ): Promise<Achievement | null> {
    const rows = await scope.run<AchievementRow>(
      `UPDATE "team_achievements"
          SET "status" = $4, "approved_by" = $5, "approved_at" = $6,
              "rejected_at" = $7, "archived_at" = $8, "updated_at" = $9,
              "record_version" = "record_version" + 1
        WHERE "id" = $1 AND "team_id" = $2 AND "record_version" = $3
       RETURNING ${ACHIEVEMENT_COLUMNS}`,
      [
        change.id,
        change.teamId,
        change.expectedRecordVersion,
        change.toStatus,
        change.approvedBy,
        this.instant(change.approvedAt),
        this.instant(change.rejectedAt),
        this.instant(change.archivedAt),
        change.now.toISOString(),
      ],
    );
    const row = rows[0];
    return row === undefined ? null : toAchievement(row);
  }

  async listForScope(
    scope: TransactionScope,
    teamId: string,
    filter: AchievementListFilter,
    page: PageRequest,
  ): Promise<readonly Achievement[]> {
    const rows = await scope.run<AchievementRow>(
      `SELECT ${ACHIEVEMENT_COLUMNS} FROM "team_achievements"
        WHERE ${this.predicate()}
        ORDER BY "achieved_on" DESC, "id" ASC
        LIMIT $7 OFFSET $8`,
      [
        ...this.filterParameters(teamId, filter),
        Math.min(page.limit, LIST_MAX_LIMIT),
        page.offset,
      ],
    );
    return rows.map(row => toAchievement(row));
  }

  async countForScope(
    scope: TransactionScope,
    teamId: string,
    filter: AchievementListFilter,
  ): Promise<number> {
    const rows = await scope.run<StandingsCountRow>(
      `SELECT COUNT(*)::int AS "count" FROM "team_achievements"
        WHERE ${this.predicate()}`,
      this.filterParameters(teamId, filter),
    );
    return Number(rows[0]?.count ?? 0);
  }

  private predicate(): string {
    return `"team_id" = $1
          AND ($2::uuid IS NULL OR "season_id" = $2)
          AND ($3::uuid IS NULL OR "competition_id" = $3)
          AND ($4::text IS NULL OR "category" = $4)
          AND ($5::text IS NULL OR "status" = $5)
          AND ($6::uuid IS NULL OR "membership_id" = $6)`;
  }

  private filterParameters(
    teamId: string,
    filter: AchievementListFilter,
  ): readonly unknown[] {
    return [
      teamId,
      filter.seasonId,
      filter.competitionId,
      filter.category,
      filter.status,
      filter.membershipId,
    ];
  }

  private insertParameters(achievement: NewAchievement): readonly unknown[] {
    return [
      achievement.id,
      achievement.teamId,
      achievement.seasonId,
      achievement.competitionId,
      achievement.membershipId,
      achievement.category,
      achievement.title,
      achievement.description,
      achievement.achievedOn,
      achievement.evidenceReference,
      achievement.visibility,
      achievement.source,
      achievement.importReference,
      achievement.createdBy,
      achievement.now.toISOString(),
    ];
  }

  private instant(value: Date | null): string | null {
    return value === null ? null : value.toISOString();
  }
}
