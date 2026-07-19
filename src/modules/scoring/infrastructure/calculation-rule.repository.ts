import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { toCalculationRule } from '../lib/scoring.mapper';
import {
  CALCULATION_RULE_COLUMNS,
  LIST_MAX_LIMIT,
} from '../model/scoring.constants';
import { CalculationRuleStatus } from '../model/scoring.enums';
import type { CalculationRuleRow, CountRow } from '../model/scoring.rows';
import type {
  CalculationRule,
  NewCalculationRule,
  PageRequest,
  RuleContentUpdate,
  RuleStatusChange,
} from '../model/scoring.types';

/**
 * Persistence for the calculation-rule aggregate. Data access only: parameterized
 * SQL through the caller's transaction scope, static column lists, optimistic-
 * version-guarded writes, and bounded/ordered reads. Component weights are stored
 * as a jsonb array. A team admin only ever reaches team-owned rules for writes;
 * reads additionally surface the seeded global candidates (team_id IS NULL).
 */
@Injectable()
export class CalculationRuleRepository {
  async insert(
    scope: TransactionScope,
    rule: NewCalculationRule,
  ): Promise<CalculationRule> {
    const rows = await scope.run<CalculationRuleRow>(
      `INSERT INTO "calculation_rules"
        ("id", "team_id", "season_id", "rule_key", "version", "name",
         "description", "status", "scale_min", "scale_max", "min_components",
         "components", "effective_from", "effective_to", "created_by",
         "created_at", "updated_at")
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft', $8, $9, $10,
               $11::jsonb, $12, $13, $14, $15, $15)
       RETURNING ${CALCULATION_RULE_COLUMNS}`,
      this.insertParameters(rule),
    );
    return toCalculationRule(this.requireRow(rows));
  }

  async nextVersion(
    scope: TransactionScope,
    teamId: string,
    ruleKey: string,
  ): Promise<number> {
    const rows = await scope.run<CountRow>(
      `SELECT COALESCE(MAX("version"), 0)::int AS "count"
         FROM "calculation_rules"
        WHERE "team_id" = $1 AND "rule_key" = $2`,
      [teamId, ruleKey],
    );
    return (rows[0]?.count ?? 0) + 1;
  }

  async findForWrite(
    scope: TransactionScope,
    teamId: string,
    ruleId: string,
  ): Promise<CalculationRule | null> {
    const rows = await scope.run<CalculationRuleRow>(
      `SELECT ${CALCULATION_RULE_COLUMNS} FROM "calculation_rules"
        WHERE "id" = $1 AND "team_id" = $2`,
      [ruleId, teamId],
    );
    const row = rows[0];
    return row === undefined ? null : toCalculationRule(row);
  }

  async findVisible(
    scope: TransactionScope,
    teamId: string,
    ruleId: string,
  ): Promise<CalculationRule | null> {
    const rows = await scope.run<CalculationRuleRow>(
      `SELECT ${CALCULATION_RULE_COLUMNS} FROM "calculation_rules"
        WHERE "id" = $1 AND ("team_id" = $2 OR "team_id" IS NULL)`,
      [ruleId, teamId],
    );
    const row = rows[0];
    return row === undefined ? null : toCalculationRule(row);
  }

  async updateContent(
    scope: TransactionScope,
    update: RuleContentUpdate,
  ): Promise<CalculationRule | null> {
    const rows = await scope.run<CalculationRuleRow>(
      `UPDATE "calculation_rules"
          SET "rule_key" = $4, "name" = $5, "description" = $6,
              "season_id" = $7, "scale_min" = $8, "scale_max" = $9,
              "min_components" = $10, "components" = $11::jsonb,
              "effective_from" = $12, "effective_to" = $13, "updated_at" = $14,
              "record_version" = "record_version" + 1
        WHERE "id" = $1 AND "team_id" = $2 AND "record_version" = $3
          AND "status" = 'draft'
       RETURNING ${CALCULATION_RULE_COLUMNS}`,
      this.updateParameters(update),
    );
    const row = rows[0];
    return row === undefined ? null : toCalculationRule(row);
  }

  async applyStatusChange(
    scope: TransactionScope,
    change: RuleStatusChange,
  ): Promise<CalculationRule | null> {
    const rows = await scope.run<CalculationRuleRow>(
      `UPDATE "calculation_rules"
          SET "status" = $4, "published_by" = $5, "published_at" = $6,
              "retired_at" = $7, "updated_at" = $8,
              "record_version" = "record_version" + 1
        WHERE "id" = $1 AND "team_id" = $2 AND "record_version" = $3
       RETURNING ${CALCULATION_RULE_COLUMNS}`,
      this.statusParameters(change),
    );
    const row = rows[0];
    return row === undefined ? null : toCalculationRule(row);
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
         UPDATE "calculation_rules"
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
  ): Promise<readonly CalculationRule[]> {
    const rows = await scope.run<CalculationRuleRow>(
      `SELECT ${CALCULATION_RULE_COLUMNS} FROM "calculation_rules"
        WHERE "team_id" = $1 OR "team_id" IS NULL
        ORDER BY "team_id" NULLS LAST, "rule_key" ASC, "version" DESC, "id" ASC
        LIMIT $2 OFFSET $3`,
      [teamId, Math.min(page.limit, LIST_MAX_LIMIT), page.offset],
    );
    return rows.map(row => toCalculationRule(row));
  }

  async countForTeam(scope: TransactionScope, teamId: string): Promise<number> {
    const rows = await scope.run<CountRow>(
      `SELECT COUNT(*)::int AS "count" FROM "calculation_rules"
        WHERE "team_id" = $1 OR "team_id" IS NULL`,
      [teamId],
    );
    return rows[0]?.count ?? 0;
  }

  async listPublishedForTeam(
    scope: TransactionScope,
    teamId: string,
  ): Promise<readonly CalculationRule[]> {
    const rows = await scope.run<CalculationRuleRow>(
      `SELECT ${CALCULATION_RULE_COLUMNS} FROM "calculation_rules"
        WHERE ("team_id" = $1 OR "team_id" IS NULL) AND "status" = $2
        ORDER BY "team_id" NULLS LAST, "version" DESC, "id" ASC
        LIMIT ${LIST_MAX_LIMIT}`,
      [teamId, CalculationRuleStatus.Published],
    );
    return rows.map(row => toCalculationRule(row));
  }

  private insertParameters(rule: NewCalculationRule): readonly unknown[] {
    return [
      rule.id,
      rule.teamId,
      rule.content.seasonId,
      rule.content.ruleKey,
      rule.version,
      rule.content.name,
      rule.content.description,
      rule.content.scaleMin,
      rule.content.scaleMax,
      rule.content.minComponents,
      JSON.stringify(rule.content.components),
      rule.content.effectiveFrom,
      rule.content.effectiveTo,
      rule.createdBy,
      rule.now.toISOString(),
    ];
  }

  private updateParameters(update: RuleContentUpdate): readonly unknown[] {
    return [
      update.id,
      update.teamId,
      update.expectedRecordVersion,
      update.content.ruleKey,
      update.content.name,
      update.content.description,
      update.content.seasonId,
      update.content.scaleMin,
      update.content.scaleMax,
      update.content.minComponents,
      JSON.stringify(update.content.components),
      update.content.effectiveFrom,
      update.content.effectiveTo,
      update.now.toISOString(),
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

  private requireRow(rows: readonly CalculationRuleRow[]): CalculationRuleRow {
    const row = rows[0];
    if (row === undefined) {
      throw new Error(
        'Expected a returned row from the calculation rule write',
      );
    }
    return row;
  }
}
