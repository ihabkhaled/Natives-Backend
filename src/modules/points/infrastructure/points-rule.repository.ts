import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { toPointsRule } from '../lib/points.mapper';
import { LIST_MAX_LIMIT, POINTS_RULE_COLUMNS } from '../model/points.constants';
import { PointsRuleStatus } from '../model/points.enums';
import type { CountRow, PointsRuleRow } from '../model/points.rows';
import type {
  NewPointsRule,
  PageRequest,
  PointsRule,
  RuleStatusChange,
} from '../model/points.types';

/**
 * Persistence for the points-rule aggregate. Data access only: parameterized SQL
 * through the caller's transaction scope, static column lists, optimistic-version-
 * guarded writes, and bounded/ordered reads. Point entries are stored as a jsonb
 * array. Reads surface the seeded global candidates (team_id IS NULL) alongside
 * the team's own rules; awarding resolves the single effective PUBLISHED rule.
 */
@Injectable()
export class PointsRuleRepository {
  async insert(
    scope: TransactionScope,
    rule: NewPointsRule,
  ): Promise<PointsRule> {
    const rows = await scope.run<PointsRuleRow>(
      `INSERT INTO "points_rules"
        ("id", "team_id", "season_id", "rule_key", "version", "name",
         "description", "status", "point_entries", "effective_from",
         "effective_to", "created_by", "created_at", "updated_at")
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft', $8::jsonb, $9, $10, $11,
               $12, $12)
       RETURNING ${POINTS_RULE_COLUMNS}`,
      this.insertParameters(rule),
    );
    return toPointsRule(this.requireRow(rows));
  }

  async nextVersion(
    scope: TransactionScope,
    teamId: string,
    ruleKey: string,
  ): Promise<number> {
    const rows = await scope.run<CountRow>(
      `SELECT COALESCE(MAX("version"), 0)::int AS "count"
         FROM "points_rules"
        WHERE "team_id" = $1 AND "rule_key" = $2`,
      [teamId, ruleKey],
    );
    return (rows[0]?.count ?? 0) + 1;
  }

  async findForWrite(
    scope: TransactionScope,
    teamId: string,
    ruleId: string,
  ): Promise<PointsRule | null> {
    const rows = await scope.run<PointsRuleRow>(
      `SELECT ${POINTS_RULE_COLUMNS} FROM "points_rules"
        WHERE "id" = $1 AND "team_id" = $2`,
      [ruleId, teamId],
    );
    const row = rows[0];
    return row === undefined ? null : toPointsRule(row);
  }

  async findPublished(
    scope: TransactionScope,
    teamId: string,
  ): Promise<PointsRule | null> {
    const rows = await scope.run<PointsRuleRow>(
      `SELECT ${POINTS_RULE_COLUMNS} FROM "points_rules"
        WHERE ("team_id" = $1 OR "team_id" IS NULL) AND "status" = $2
        ORDER BY "team_id" NULLS LAST, "version" DESC, "id" ASC
        LIMIT 1`,
      [teamId, PointsRuleStatus.Published],
    );
    const row = rows[0];
    return row === undefined ? null : toPointsRule(row);
  }

  async applyStatusChange(
    scope: TransactionScope,
    change: RuleStatusChange,
  ): Promise<PointsRule | null> {
    const rows = await scope.run<PointsRuleRow>(
      `UPDATE "points_rules"
          SET "status" = $4, "published_by" = $5, "published_at" = $6,
              "retired_at" = $7, "updated_at" = $8,
              "record_version" = "record_version" + 1
        WHERE "id" = $1 AND "team_id" = $2 AND "record_version" = $3
       RETURNING ${POINTS_RULE_COLUMNS}`,
      this.statusParameters(change),
    );
    const row = rows[0];
    return row === undefined ? null : toPointsRule(row);
  }

  async retirePublished(
    scope: TransactionScope,
    teamId: string,
    ruleKey: string,
    exceptRuleId: string,
    now: Date,
  ): Promise<number> {
    const rows = await scope.run<CountRow>(
      `WITH retired AS (
         UPDATE "points_rules"
            SET "status" = 'retired', "retired_at" = $4, "updated_at" = $4,
                "record_version" = "record_version" + 1
          WHERE "team_id" = $1 AND "rule_key" = $2 AND "id" <> $3
            AND "status" = 'published'
          RETURNING 1
       )
       SELECT COUNT(*)::int AS "count" FROM retired`,
      [teamId, ruleKey, exceptRuleId, now.toISOString()],
    );
    return rows[0]?.count ?? 0;
  }

  async listForTeam(
    scope: TransactionScope,
    teamId: string,
    page: PageRequest,
  ): Promise<readonly PointsRule[]> {
    const rows = await scope.run<PointsRuleRow>(
      `SELECT ${POINTS_RULE_COLUMNS} FROM "points_rules"
        WHERE "team_id" = $1 OR "team_id" IS NULL
        ORDER BY "team_id" NULLS LAST, "rule_key" ASC, "version" DESC, "id" ASC
        LIMIT $2 OFFSET $3`,
      [teamId, Math.min(page.limit, LIST_MAX_LIMIT), page.offset],
    );
    return rows.map(row => toPointsRule(row));
  }

  async countForTeam(scope: TransactionScope, teamId: string): Promise<number> {
    const rows = await scope.run<CountRow>(
      `SELECT COUNT(*)::int AS "count" FROM "points_rules"
        WHERE "team_id" = $1 OR "team_id" IS NULL`,
      [teamId],
    );
    return rows[0]?.count ?? 0;
  }

  private insertParameters(rule: NewPointsRule): readonly unknown[] {
    return [
      rule.id,
      rule.teamId,
      rule.content.seasonId,
      rule.content.ruleKey,
      rule.version,
      rule.content.name,
      rule.content.description,
      JSON.stringify(rule.content.pointEntries),
      rule.content.effectiveFrom,
      rule.content.effectiveTo,
      rule.createdBy,
      rule.now.toISOString(),
    ];
  }

  private statusParameters(change: RuleStatusChange): readonly unknown[] {
    return [
      change.id,
      change.teamId,
      change.expectedRecordVersion,
      change.toStatus,
      change.publishedBy,
      change.publishedAt === null ? null : change.publishedAt.toISOString(),
      change.retiredAt === null ? null : change.retiredAt.toISOString(),
      change.now.toISOString(),
    ];
  }

  private requireRow(rows: readonly PointsRuleRow[]): PointsRuleRow {
    const row = rows[0];
    if (row === undefined) {
      throw new Error('Expected a returned row from the points rule write');
    }
    return row;
  }
}
