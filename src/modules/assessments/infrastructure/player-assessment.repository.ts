import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import {
  toPlayerAssessment,
  toPlayerAssessmentContext,
  toPlayerAssessmentSummary,
  toPlayerAssessmentValue,
  toTemplateMetricBound,
} from '../lib/player-assessments.mapper';
import type { CountRow } from '../model/assessments.rows';
import type { PageRequest } from '../model/assessments.types';
import {
  PLAYER_ASSESSMENT_COLUMNS,
  PLAYER_ASSESSMENT_VALUE_COLUMNS,
} from '../model/player-assessments.constants';
import type {
  ContextHeadRow,
  PlayerAssessmentRow,
  PlayerAssessmentValueRow,
  TemplateMetricBoundRow,
} from '../model/player-assessments.rows';
import type {
  AssessmentSupersede,
  AssessmentTransition,
  NewPlayerAssessment,
  NewPlayerAssessmentValue,
  OwnPublishedResult,
  PlayerAssessment,
  PlayerAssessmentContext,
  PlayerAssessmentDetail,
  PlayerAssessmentSummaryPage,
  PlayerAssessmentValue,
  RevisionHistory,
  TemplateMetricBound,
} from '../model/player-assessments.types';

/**
 * Persistence for the per-player assessment aggregate and its values. Data access
 * only: parameterized SQL through the caller's transaction scope, static column
 * lists, optimistic-version guarded transitions, bounded/ordered reads. Numeric
 * values are stored NULL when not evaluated (null-not-zero); published rows are
 * never mutated in place — corrections supersede and insert a new revision.
 */
@Injectable()
export class PlayerAssessmentRepository {
  async loadContext(
    scope: TransactionScope,
    teamId: string,
    periodId: string,
  ): Promise<PlayerAssessmentContext | null> {
    const heads = await scope.run<ContextHeadRow>(
      `SELECT t."id" AS "template_id", per."season_id" AS "season_id"
         FROM "assessment_periods" per
         JOIN "assessment_templates" t ON t."id" = per."template_id"
        WHERE per."id" = $1 AND per."team_id" = $2 AND per."status" = 'active'
          AND t."status" = 'published'`,
      [periodId, teamId],
    );
    const head = heads[0];
    if (head === undefined) {
      return null;
    }
    const metrics = await scope.run<TemplateMetricBoundRow>(
      `SELECT tm."metric_definition_id", tm."required",
              s."minimum_value", s."maximum_value"
         FROM "assessment_template_metrics" tm
         JOIN "assessment_metric_definitions" m
           ON m."id" = tm."metric_definition_id"
         JOIN "assessment_scales" s ON s."id" = m."scale_id"
        WHERE tm."template_id" = $1
        ORDER BY tm."sort_order" ASC, tm."metric_definition_id" ASC`,
      [head.template_id],
    );
    return toPlayerAssessmentContext(head, metrics);
  }

  async liveExists(
    scope: TransactionScope,
    periodId: string,
    membershipId: string,
    evaluatorUserId: string,
  ): Promise<boolean> {
    const rows = await scope.run<CountRow>(
      `SELECT COUNT(*)::int AS "count" FROM "player_assessments"
        WHERE "period_id" = $1 AND "membership_id" = $2
          AND "evaluator_user_id" = $3 AND "superseded_at" IS NULL`,
      [periodId, membershipId, evaluatorUserId],
    );
    return (rows[0]?.count ?? 0) > 0;
  }

  async loadTemplateBounds(
    scope: TransactionScope,
    templateId: string,
  ): Promise<readonly TemplateMetricBound[]> {
    const rows = await scope.run<TemplateMetricBoundRow>(
      `SELECT tm."metric_definition_id", tm."required",
              s."minimum_value", s."maximum_value"
         FROM "assessment_template_metrics" tm
         JOIN "assessment_metric_definitions" m
           ON m."id" = tm."metric_definition_id"
         JOIN "assessment_scales" s ON s."id" = m."scale_id"
        WHERE tm."template_id" = $1
        ORDER BY tm."sort_order" ASC, tm."metric_definition_id" ASC`,
      [templateId],
    );
    return rows.map(row => toTemplateMetricBound(row));
  }

  async insertAssessment(
    scope: TransactionScope,
    assessment: NewPlayerAssessment,
  ): Promise<PlayerAssessment> {
    const rows = await scope.run<PlayerAssessmentRow>(
      `INSERT INTO "player_assessments"
        ("id", "family_id", "team_id", "season_id", "period_id", "template_id",
         "membership_id", "evaluator_user_id", "status", "revision", "summary",
         "reviewed_at", "reviewed_by", "published_at", "published_by",
         "created_by", "created_at", "updated_at")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
               $15, $16, $17, $17)
       RETURNING ${PLAYER_ASSESSMENT_COLUMNS}`,
      this.assessmentParameters(assessment),
    );
    return toPlayerAssessment(this.requireRow(rows));
  }

  async insertValues(
    scope: TransactionScope,
    values: readonly NewPlayerAssessmentValue[],
  ): Promise<void> {
    if (values.length === 0) {
      return;
    }
    await scope.run(
      `INSERT INTO "player_assessment_metric_values"
        ("id", "assessment_id", "metric_definition_id", "numeric_value",
         "text_value", "note", "confidence", "observation_count", "created_at")
       SELECT input."id", input."assessment_id", input."metric_definition_id",
              input."numeric_value", input."text_value", input."note",
              input."confidence", input."observation_count", input."created_at"
         FROM jsonb_to_recordset($1::jsonb) AS input(
           "id" uuid, "assessment_id" uuid, "metric_definition_id" uuid,
           "numeric_value" numeric, "text_value" text, "note" text,
           "confidence" integer, "observation_count" integer,
           "created_at" timestamptz)`,
      [JSON.stringify(values.map(value => this.valueRecord(value)))],
    );
  }

  async clearValues(
    scope: TransactionScope,
    assessmentId: string,
  ): Promise<void> {
    await scope.run(
      `DELETE FROM "player_assessment_metric_values"
        WHERE "assessment_id" = $1`,
      [assessmentId],
    );
  }

  async findForWrite(
    scope: TransactionScope,
    teamId: string,
    assessmentId: string,
  ): Promise<PlayerAssessment | null> {
    const rows = await scope.run<PlayerAssessmentRow>(
      `SELECT ${PLAYER_ASSESSMENT_COLUMNS} FROM "player_assessments"
        WHERE "id" = $1 AND "team_id" = $2`,
      [assessmentId, teamId],
    );
    const row = rows[0];
    return row === undefined ? null : toPlayerAssessment(row);
  }

  async findDetail(
    scope: TransactionScope,
    teamId: string,
    assessmentId: string,
  ): Promise<PlayerAssessmentDetail | null> {
    const assessment = await this.findForWrite(scope, teamId, assessmentId);
    if (assessment === null) {
      return null;
    }
    const values = await this.findValues(scope, assessmentId);
    return { assessment, values };
  }

  async findValues(
    scope: TransactionScope,
    assessmentId: string,
  ): Promise<readonly PlayerAssessmentValue[]> {
    const rows = await scope.run<PlayerAssessmentValueRow>(
      `SELECT ${PLAYER_ASSESSMENT_VALUE_COLUMNS}
         FROM "player_assessment_metric_values"
        WHERE "assessment_id" = $1
        ORDER BY "metric_definition_id" ASC`,
      [assessmentId],
    );
    return rows.map(row => toPlayerAssessmentValue(row));
  }

  async updateDraft(
    scope: TransactionScope,
    assessmentId: string,
    teamId: string,
    summary: string | null,
    expectedRecordVersion: number,
    now: Date,
  ): Promise<PlayerAssessment | null> {
    const rows = await scope.run<PlayerAssessmentRow>(
      `UPDATE "player_assessments"
          SET "summary" = $4, "updated_at" = $5,
              "record_version" = "record_version" + 1
        WHERE "id" = $1 AND "team_id" = $2 AND "status" = 'draft'
          AND "record_version" = $3 AND "superseded_at" IS NULL
       RETURNING ${PLAYER_ASSESSMENT_COLUMNS}`,
      [assessmentId, teamId, expectedRecordVersion, summary, now.toISOString()],
    );
    const row = rows[0];
    return row === undefined ? null : toPlayerAssessment(row);
  }

  async applyTransition(
    scope: TransactionScope,
    transition: AssessmentTransition,
  ): Promise<PlayerAssessment | null> {
    const rows = await scope.run<PlayerAssessmentRow>(
      `UPDATE "player_assessments"
          SET "status" = $3, "updated_at" = $4,
              "record_version" = "record_version" + 1,
              "submitted_at" = COALESCE($5, "submitted_at"),
              "submitted_by" = COALESCE($6, "submitted_by"),
              "reviewed_at" = COALESCE($7, "reviewed_at"),
              "reviewed_by" = COALESCE($8, "reviewed_by"),
              "published_at" = COALESCE($9, "published_at"),
              "published_by" = COALESCE($10, "published_by")
        WHERE "id" = $1 AND "team_id" = $2 AND "record_version" = $11
          AND "superseded_at" IS NULL
       RETURNING ${PLAYER_ASSESSMENT_COLUMNS}`,
      this.transitionParameters(transition),
    );
    const row = rows[0];
    return row === undefined ? null : toPlayerAssessment(row);
  }

  async supersede(
    scope: TransactionScope,
    supersede: AssessmentSupersede,
  ): Promise<boolean> {
    const rows = await scope.run<PlayerAssessmentRow>(
      `UPDATE "player_assessments"
          SET "superseded_at" = $3, "superseded_by_id" = $2,
              "updated_at" = $3
        WHERE "id" = $1 AND "superseded_at" IS NULL
          AND "status" IN ('published', 'revised')
       RETURNING "id"`,
      [supersede.id, supersede.supersededById, supersede.now.toISOString()],
    );
    return rows.length > 0;
  }

  async listForTeam(
    scope: TransactionScope,
    teamId: string,
    page: PageRequest,
  ): Promise<PlayerAssessmentSummaryPage> {
    const rows = await scope.run<PlayerAssessmentRow>(
      `SELECT ${PLAYER_ASSESSMENT_COLUMNS} FROM "player_assessments"
        WHERE "team_id" = $1
        ORDER BY "created_at" DESC, "id" ASC
        LIMIT $2 OFFSET $3`,
      [teamId, page.limit, page.offset],
    );
    const totals = await scope.run<CountRow>(
      `SELECT COUNT(*)::int AS "count" FROM "player_assessments"
        WHERE "team_id" = $1`,
      [teamId],
    );
    return {
      items: rows.map(row => toPlayerAssessmentSummary(row)),
      total: totals[0]?.count ?? 0,
      limit: page.limit,
      offset: page.offset,
    };
  }

  async listRevisions(
    scope: TransactionScope,
    teamId: string,
    familyId: string,
  ): Promise<RevisionHistory> {
    const rows = await scope.run<PlayerAssessmentRow>(
      `SELECT ${PLAYER_ASSESSMENT_COLUMNS} FROM "player_assessments"
        WHERE "team_id" = $1 AND "family_id" = $2
        ORDER BY "revision" ASC, "id" ASC`,
      [teamId, familyId],
    );
    return { items: rows.map(row => toPlayerAssessmentSummary(row)) };
  }

  async listOwnPublished(
    scope: TransactionScope,
    teamId: string,
    userId: string,
    page: PageRequest,
  ): Promise<OwnPublishedResult> {
    const rows = await scope.run<PlayerAssessmentRow>(
      `SELECT ${this.qualified()} FROM "player_assessments" pa
         JOIN "memberships" m ON m."id" = pa."membership_id"
        WHERE pa."team_id" = $1 AND m."user_id" = $2
          AND pa."status" IN ('published', 'revised')
          AND pa."superseded_at" IS NULL
        ORDER BY pa."created_at" DESC, pa."id" ASC
        LIMIT $3 OFFSET $4`,
      [teamId, userId, page.limit, page.offset],
    );
    const totals = await scope.run<CountRow>(
      `SELECT COUNT(*)::int AS "count" FROM "player_assessments" pa
         JOIN "memberships" m ON m."id" = pa."membership_id"
        WHERE pa."team_id" = $1 AND m."user_id" = $2
          AND pa."status" IN ('published', 'revised')
          AND pa."superseded_at" IS NULL`,
      [teamId, userId],
    );
    return {
      assessments: rows.map(row => toPlayerAssessment(row)),
      total: totals[0]?.count ?? 0,
    };
  }

  async valuesByAssessment(
    scope: TransactionScope,
    assessmentIds: readonly string[],
  ): Promise<ReadonlyMap<string, readonly PlayerAssessmentValue[]>> {
    const grouped = new Map<string, PlayerAssessmentValue[]>();
    if (assessmentIds.length === 0) {
      return grouped;
    }
    const rows = await scope.run<PlayerAssessmentValueRow>(
      `SELECT ${PLAYER_ASSESSMENT_VALUE_COLUMNS}
         FROM "player_assessment_metric_values"
        WHERE "assessment_id" = ANY($1::uuid[])
        ORDER BY "assessment_id" ASC, "metric_definition_id" ASC`,
      [assessmentIds],
    );
    for (const row of rows) {
      const bucket = grouped.get(row.assessment_id) ?? [];
      bucket.push(toPlayerAssessmentValue(row));
      grouped.set(row.assessment_id, bucket);
    }
    return grouped;
  }

  private qualified(): string {
    return PLAYER_ASSESSMENT_COLUMNS.split(',')
      .map(column => `pa.${column.trim()}`)
      .join(', ');
  }

  private assessmentParameters(
    assessment: NewPlayerAssessment,
  ): readonly unknown[] {
    return [
      assessment.id,
      assessment.familyId,
      assessment.teamId,
      assessment.seasonId,
      assessment.periodId,
      assessment.templateId,
      assessment.membershipId,
      assessment.evaluatorUserId,
      assessment.status,
      assessment.revision,
      assessment.summary,
      assessment.reviewedAt === null
        ? null
        : assessment.reviewedAt.toISOString(),
      assessment.reviewedBy,
      assessment.publishedAt === null
        ? null
        : assessment.publishedAt.toISOString(),
      assessment.publishedBy,
      assessment.createdBy,
      assessment.now.toISOString(),
    ];
  }

  private transitionParameters(
    transition: AssessmentTransition,
  ): readonly unknown[] {
    return [
      transition.id,
      transition.teamId,
      transition.toStatus,
      transition.now.toISOString(),
      transition.submittedAt === null
        ? null
        : transition.submittedAt.toISOString(),
      transition.submittedBy,
      transition.reviewedAt === null
        ? null
        : transition.reviewedAt.toISOString(),
      transition.reviewedBy,
      transition.publishedAt === null
        ? null
        : transition.publishedAt.toISOString(),
      transition.publishedBy,
      transition.expectedRecordVersion,
    ];
  }

  private valueRecord(
    value: NewPlayerAssessmentValue,
  ): Readonly<Record<string, unknown>> {
    return {
      id: value.id,
      assessment_id: value.assessmentId,
      metric_definition_id: value.metricDefinitionId,
      numeric_value: value.numericValue,
      text_value: value.textValue,
      note: value.note,
      confidence: value.confidence,
      observation_count: value.observationCount,
      created_at: value.now.toISOString(),
    };
  }

  private requireRow(
    rows: readonly PlayerAssessmentRow[],
  ): PlayerAssessmentRow {
    const row = rows[0];
    if (row === undefined) {
      throw new Error(
        'Expected a returned row from the player assessment write',
      );
    }
    return row;
  }
}
