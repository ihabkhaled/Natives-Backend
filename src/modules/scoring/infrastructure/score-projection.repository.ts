import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { toScoreProjection } from '../lib/scoring.mapper';
import {
  LIST_MAX_LIMIT,
  SCORE_PROJECTION_COLUMNS,
} from '../model/scoring.constants';
import { ScoreConfidence } from '../model/scoring.enums';
import type { CountRow, ScoreProjectionRow } from '../model/scoring.rows';
import type {
  CalculationRule,
  ComputedProjection,
  PageRequest,
  ProjectionTarget,
  ScoreProjection,
} from '../model/scoring.types';

/**
 * Persistence for performance-score projections. Data access only: parameterized
 * SQL, static columns, bounded/ordered reads. A projection is a rebuildable cache
 * keyed uniquely by (membership_id, rule_id): a rebuild upserts in place so it is
 * idempotent and equals a clean recompute. Missing overall values are stored NULL,
 * never zero. No projection total is ever hand-edited — only recomputed.
 */
@Injectable()
export class ScoreProjectionRepository {
  async upsertReady(
    scope: TransactionScope,
    projection: ComputedProjection,
  ): Promise<void> {
    await scope.run(
      `INSERT INTO "performance_score_projections"
        ("id", "team_id", "season_id", "membership_id", "period_id", "rule_id",
         "rule_key", "rule_version", "status", "overall_value",
         "overall_numerator", "overall_denominator", "included_count",
         "excluded_count", "completeness", "confidence", "explanation",
         "source_hash", "error", "computed_at", "created_at", "updated_at")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'ready', $9, $10, $11, $12, $13,
               $14, $15, $16::jsonb, $17, NULL, $18, $18, $18)
       ON CONFLICT ("membership_id", "rule_id") DO UPDATE SET
         "season_id" = EXCLUDED."season_id", "period_id" = EXCLUDED."period_id",
         "rule_key" = EXCLUDED."rule_key",
         "rule_version" = EXCLUDED."rule_version", "status" = 'ready',
         "overall_value" = EXCLUDED."overall_value",
         "overall_numerator" = EXCLUDED."overall_numerator",
         "overall_denominator" = EXCLUDED."overall_denominator",
         "included_count" = EXCLUDED."included_count",
         "excluded_count" = EXCLUDED."excluded_count",
         "completeness" = EXCLUDED."completeness",
         "confidence" = EXCLUDED."confidence",
         "explanation" = EXCLUDED."explanation",
         "source_hash" = EXCLUDED."source_hash", "error" = NULL,
         "computed_at" = EXCLUDED."computed_at",
         "updated_at" = EXCLUDED."updated_at",
         "record_version" = "performance_score_projections"."record_version" + 1`,
      this.readyParameters(projection),
    );
  }

  async upsertFailed(
    scope: TransactionScope,
    target: ProjectionTarget,
    rule: CalculationRule,
    error: string,
    now: Date,
  ): Promise<void> {
    await scope.run(
      `INSERT INTO "performance_score_projections"
        ("id", "team_id", "season_id", "membership_id", "period_id", "rule_id",
         "rule_key", "rule_version", "status", "included_count",
         "excluded_count", "completeness", "confidence", "error", "created_at",
         "updated_at")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'failed', 0, 0, 0, $9, $10, $11,
               $11)
       ON CONFLICT ("membership_id", "rule_id") DO UPDATE SET
         "status" = 'failed', "error" = EXCLUDED."error",
         "confidence" = EXCLUDED."confidence",
         "updated_at" = EXCLUDED."updated_at",
         "record_version" = "performance_score_projections"."record_version" + 1`,
      [
        target.id,
        target.teamId,
        target.seasonId,
        target.membershipId,
        target.periodId,
        rule.ruleId,
        rule.ruleKey,
        rule.version,
        ScoreConfidence.None,
        error,
        now.toISOString(),
      ],
    );
  }

  async markStaleForTeamRuleKey(
    scope: TransactionScope,
    teamId: string,
    ruleKey: string,
  ): Promise<number> {
    const rows = await scope.run<CountRow>(
      `WITH stale AS (
         UPDATE "performance_score_projections"
            SET "status" = 'stale',
                "record_version" = "record_version" + 1
          WHERE "team_id" = $1 AND "rule_key" = $2 AND "status" <> 'stale'
          RETURNING 1
       )
       SELECT COUNT(*)::int AS "count" FROM stale`,
      [teamId, ruleKey],
    );
    return rows[0]?.count ?? 0;
  }

  async deleteSupersededForTeam(
    scope: TransactionScope,
    teamId: string,
    keepRuleId: string,
  ): Promise<number> {
    const rows = await scope.run<CountRow>(
      `WITH removed AS (
         DELETE FROM "performance_score_projections"
          WHERE "team_id" = $1 AND "rule_id" <> $2
          RETURNING 1
       )
       SELECT COUNT(*)::int AS "count" FROM removed`,
      [teamId, keepRuleId],
    );
    return rows[0]?.count ?? 0;
  }

  async listForTeam(
    scope: TransactionScope,
    teamId: string,
    page: PageRequest,
  ): Promise<readonly ScoreProjection[]> {
    const rows = await scope.run<ScoreProjectionRow>(
      `SELECT ${SCORE_PROJECTION_COLUMNS} FROM "performance_score_projections"
        WHERE "team_id" = $1
        ORDER BY "overall_value" DESC NULLS LAST, "membership_id" ASC
        LIMIT $2 OFFSET $3`,
      [teamId, Math.min(page.limit, LIST_MAX_LIMIT), page.offset],
    );
    return rows.map(row => toScoreProjection(row));
  }

  async countForTeam(scope: TransactionScope, teamId: string): Promise<number> {
    const rows = await scope.run<CountRow>(
      `SELECT COUNT(*)::int AS "count" FROM "performance_score_projections"
        WHERE "team_id" = $1`,
      [teamId],
    );
    return rows[0]?.count ?? 0;
  }

  async listForMembership(
    scope: TransactionScope,
    teamId: string,
    membershipId: string,
  ): Promise<readonly ScoreProjection[]> {
    const rows = await scope.run<ScoreProjectionRow>(
      `SELECT ${SCORE_PROJECTION_COLUMNS} FROM "performance_score_projections"
        WHERE "team_id" = $1 AND "membership_id" = $2
        ORDER BY "rule_key" ASC, "rule_version" DESC
        LIMIT ${LIST_MAX_LIMIT}`,
      [teamId, membershipId],
    );
    return rows.map(row => toScoreProjection(row));
  }

  async listForUser(
    scope: TransactionScope,
    teamId: string,
    userId: string,
  ): Promise<readonly ScoreProjection[]> {
    const rows = await scope.run<ScoreProjectionRow>(
      `SELECT ${this.qualified()} FROM "performance_score_projections" p
         JOIN "memberships" m ON m."id" = p."membership_id"
        WHERE p."team_id" = $1 AND m."user_id" = $2
        ORDER BY p."rule_key" ASC, p."rule_version" DESC
        LIMIT ${LIST_MAX_LIMIT}`,
      [teamId, userId],
    );
    return rows.map(row => toScoreProjection(row));
  }

  private qualified(): string {
    return SCORE_PROJECTION_COLUMNS.split(',')
      .map(column => `p.${column.trim()}`)
      .join(', ');
  }

  private readyParameters(projection: ComputedProjection): readonly unknown[] {
    return [
      projection.id,
      projection.teamId,
      projection.seasonId,
      projection.membershipId,
      projection.periodId,
      projection.rule.ruleId,
      projection.rule.ruleKey,
      projection.rule.version,
      projection.result.value,
      projection.result.numerator,
      projection.result.denominator,
      projection.result.includedCount,
      projection.result.excludedCount,
      projection.result.completeness,
      projection.result.confidence,
      JSON.stringify(projection.explanation),
      projection.sourceHash,
      projection.now.toISOString(),
    ];
  }
}
