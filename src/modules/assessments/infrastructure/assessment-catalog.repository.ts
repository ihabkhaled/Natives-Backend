import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import {
  CATEGORY_COLUMNS,
  METRIC_COLUMNS,
  PERIOD_COLUMNS,
  SCALE_COLUMNS,
  TEMPLATE_COLUMNS,
} from '../model/assessments.constants';
import type {
  CategoryRow,
  CategoryWeightRow,
  CountRow,
  IdRow,
  MetricRow,
  PeriodRow,
  ScaleRow,
  TemplateMetricRow,
  TemplateRow,
} from '../model/assessments.rows';
import type {
  AssessmentCategoryPage,
  AssessmentMetric,
  AssessmentMetricPage,
  AssessmentPeriod,
  AssessmentPeriodPage,
  AssessmentScalePage,
  AssessmentTemplate,
  AssessmentTemplatePage,
  CategoryWeightInput,
  MetricArchive,
  NewMetric,
  NewPeriod,
  NewTemplate,
  PageRequest,
  TemplateMetricInput,
  TemplatePublish,
} from '../model/assessments.types';
import {
  toAssessmentCategory,
  toAssessmentMetric,
  toAssessmentPeriod,
  toAssessmentScale,
  toAssessmentTemplate,
} from '../lib/assessments.helpers';

@Injectable()
export class AssessmentCatalogRepository {
  async listCategories(
    scope: TransactionScope,
    page: PageRequest,
  ): Promise<AssessmentCategoryPage> {
    const rows = await scope.run<CategoryRow>(
      `SELECT ${CATEGORY_COLUMNS} FROM "assessment_metric_categories"
        WHERE "status" = 'active'
        ORDER BY "sort_order" ASC, "category_key" ASC, "id" ASC
        LIMIT $1 OFFSET $2`,
      [page.limit, page.offset],
    );
    const total = await this.count(scope, 'assessment_metric_categories');
    return this.page(rows.map(toAssessmentCategory), total, page);
  }

  async listScales(
    scope: TransactionScope,
    page: PageRequest,
  ): Promise<AssessmentScalePage> {
    const rows = await scope.run<ScaleRow>(
      `SELECT ${SCALE_COLUMNS} FROM "assessment_scales"
        WHERE "status" = 'active'
        ORDER BY "scale_key" ASC, "scale_version" DESC, "id" ASC
        LIMIT $1 OFFSET $2`,
      [page.limit, page.offset],
    );
    const total = await this.count(scope, 'assessment_scales');
    return this.page(rows.map(toAssessmentScale), total, page);
  }

  async listMetrics(
    scope: TransactionScope,
    teamId: string,
    page: PageRequest,
  ): Promise<AssessmentMetricPage> {
    const where = this.currentMetricPredicate();
    const rows = await scope.run<MetricRow>(
      `SELECT ${this.qualifyMetricColumns()} FROM "assessment_metric_definitions" m
        WHERE ${where}
        ORDER BY m."definition_key" ASC, m."definition_version" DESC, m."id" ASC
        LIMIT $2 OFFSET $3`,
      [teamId, page.limit, page.offset],
    );
    const totals = await scope.run<CountRow>(
      `SELECT COUNT(*)::int AS "count"
         FROM "assessment_metric_definitions" m WHERE ${where}`,
      [teamId],
    );
    return this.page(
      rows.map(toAssessmentMetric),
      totals[0]?.count ?? 0,
      page,
    );
  }

  async metricKeyExists(
    scope: TransactionScope,
    teamId: string,
    key: string,
  ): Promise<boolean> {
    const rows = await scope.run<IdRow>(
      `SELECT "id" FROM "assessment_metric_definitions"
        WHERE "team_id" = $1 AND "definition_key" = $2 LIMIT 1`,
      [teamId, key],
    );
    return rows.length > 0;
  }

  async referencesExist(
    scope: TransactionScope,
    categoryId: string,
    scaleId: string,
  ): Promise<boolean> {
    const rows = await scope.run<CountRow>(
      `SELECT (
         (SELECT COUNT(*) FROM "assessment_metric_categories"
           WHERE "id" = $1 AND "status" = 'active') +
         (SELECT COUNT(*) FROM "assessment_scales"
           WHERE "id" = $2 AND "status" = 'active')
       )::int AS "count"`,
      [categoryId, scaleId],
    );
    return rows[0]?.count === 2;
  }

  async findMetricForWrite(
    scope: TransactionScope,
    teamId: string,
    metricId: string,
  ): Promise<AssessmentMetric | null> {
    const rows = await scope.run<MetricRow>(
      `SELECT ${METRIC_COLUMNS} FROM "assessment_metric_definitions"
        WHERE "id" = $1 AND "team_id" = $2`,
      [metricId, teamId],
    );
    const row = rows[0];
    return row === undefined ? null : toAssessmentMetric(row);
  }

  async insertMetric(
    scope: TransactionScope,
    metric: NewMetric,
  ): Promise<AssessmentMetric> {
    const rows = await scope.run<MetricRow>(
      `INSERT INTO "assessment_metric_definitions"
        ("id", "family_id", "team_id", "category_id", "scale_id",
         "definition_key", "name", "definition", "direction", "guidance",
         "applicability", "tags", "definition_version", "created_by",
         "created_at")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
               $14, $15)
       RETURNING ${METRIC_COLUMNS}`,
      this.metricParameters(metric),
    );
    return toAssessmentMetric(this.requireRow(rows));
  }

  async metricInUse(
    scope: TransactionScope,
    metricId: string,
  ): Promise<boolean> {
    const rows = await scope.run<IdRow>(
      `SELECT "template_id" AS "id" FROM "assessment_template_metrics"
        WHERE "metric_definition_id" = $1 LIMIT 1`,
      [metricId],
    );
    return rows.length > 0;
  }

  async archiveMetric(
    scope: TransactionScope,
    archive: MetricArchive,
  ): Promise<AssessmentMetric | null> {
    const rows = await scope.run<MetricRow>(
      `UPDATE "assessment_metric_definitions"
          SET "status" = 'archived', "archived_by" = $3, "archived_at" = $4,
              "record_version" = "record_version" + 1
        WHERE "id" = $1 AND "team_id" = $2 AND "status" = 'active'
          AND "record_version" = $5
       RETURNING ${METRIC_COLUMNS}`,
      [
        archive.id,
        archive.teamId,
        archive.archivedBy,
        archive.now.toISOString(),
        archive.expectedRecordVersion,
      ],
    );
    const row = rows[0];
    return row === undefined ? null : toAssessmentMetric(row);
  }

  async templateKeyExists(
    scope: TransactionScope,
    teamId: string,
    key: string,
  ): Promise<boolean> {
    const rows = await scope.run<IdRow>(
      `SELECT "id" FROM "assessment_templates"
        WHERE "team_id" = $1 AND "template_key" = $2 LIMIT 1`,
      [teamId, key],
    );
    return rows.length > 0;
  }

  async templateReferencesExist(
    scope: TransactionScope,
    teamId: string,
    weights: readonly CategoryWeightInput[],
    metrics: readonly TemplateMetricInput[],
  ): Promise<boolean> {
    const categoryIds = weights.map(weight => weight.categoryId);
    const metricIds = metrics.map(metric => metric.metricDefinitionId);
    const rows = await scope.run<CountRow>(
      `SELECT (
         (SELECT COUNT(*) FROM "assessment_metric_categories"
           WHERE "id" = ANY($1::uuid[]) AND "status" = 'active') +
         (SELECT COUNT(*) FROM "assessment_metric_definitions"
           WHERE "id" = ANY($2::uuid[]) AND "status" = 'active'
             AND ("team_id" IS NULL OR "team_id" = $3))
       )::int AS "count"`,
      [categoryIds, metricIds, teamId],
    );
    return rows[0]?.count === categoryIds.length + metricIds.length;
  }

  async findTemplateForWrite(
    scope: TransactionScope,
    teamId: string,
    templateId: string,
  ): Promise<AssessmentTemplate | null> {
    const rows = await scope.run<TemplateRow>(
      `SELECT ${TEMPLATE_COLUMNS} FROM "assessment_templates"
        WHERE "id" = $1 AND "team_id" = $2`,
      [templateId, teamId],
    );
    const row = rows[0];
    if (row === undefined) {
      return null;
    }
    const relations = await this.loadTemplateRelations(scope, [row.id]);
    return toAssessmentTemplate(row, relations.weights, relations.metrics);
  }

  async insertTemplate(
    scope: TransactionScope,
    template: NewTemplate,
    weights: readonly CategoryWeightInput[],
    metrics: readonly TemplateMetricInput[],
  ): Promise<AssessmentTemplate> {
    const rows = await scope.run<TemplateRow>(
      `INSERT INTO "assessment_templates"
        ("id", "family_id", "team_id", "season_id", "template_key", "name",
         "cohort", "evaluator_roles", "score_version", "template_version",
         "created_by", "created_at")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING ${TEMPLATE_COLUMNS}`,
      this.templateParameters(template),
    );
    await this.insertTemplateRelations(scope, template.id, weights, metrics);
    return toAssessmentTemplate(this.requireRow(rows), [], []);
  }

  async publishTemplate(
    scope: TransactionScope,
    publish: TemplatePublish,
  ): Promise<AssessmentTemplate | null> {
    const rows = await scope.run<TemplateRow>(
      `UPDATE "assessment_templates"
          SET "status" = 'published', "published_by" = $3,
              "published_at" = $4, "record_version" = "record_version" + 1
        WHERE "id" = $1 AND "team_id" = $2 AND "status" = 'draft'
          AND "record_version" = $5
       RETURNING ${TEMPLATE_COLUMNS}`,
      [
        publish.id,
        publish.teamId,
        publish.publishedBy,
        publish.now.toISOString(),
        publish.expectedRecordVersion,
      ],
    );
    const row = rows[0];
    if (row === undefined) {
      return null;
    }
    const relations = await this.loadTemplateRelations(scope, [row.id]);
    return toAssessmentTemplate(row, relations.weights, relations.metrics);
  }

  async listTemplates(
    scope: TransactionScope,
    teamId: string,
    page: PageRequest,
  ): Promise<AssessmentTemplatePage> {
    const rows = await scope.run<TemplateRow>(
      `SELECT ${TEMPLATE_COLUMNS} FROM "assessment_templates"
        WHERE "team_id" = $1
        ORDER BY "template_key" ASC, "template_version" DESC, "id" ASC
        LIMIT $2 OFFSET $3`,
      [teamId, page.limit, page.offset],
    );
    const totals = await scope.run<CountRow>(
      `SELECT COUNT(*)::int AS "count" FROM "assessment_templates"
        WHERE "team_id" = $1`,
      [teamId],
    );
    const relations = await this.loadTemplateRelations(
      scope,
      rows.map(row => row.id),
    );
    const items = rows.map(row =>
      toAssessmentTemplate(row, relations.weights, relations.metrics),
    );
    return this.page(items, totals[0]?.count ?? 0, page);
  }

  async publishedTemplateExists(
    scope: TransactionScope,
    teamId: string,
    templateId: string,
  ): Promise<boolean> {
    const rows = await scope.run<IdRow>(
      `SELECT "id" FROM "assessment_templates"
        WHERE "id" = $1 AND "team_id" = $2 AND "status" = 'published'`,
      [templateId, teamId],
    );
    return rows.length > 0;
  }

  async insertPeriod(
    scope: TransactionScope,
    period: NewPeriod,
  ): Promise<AssessmentPeriod> {
    const rows = await scope.run<PeriodRow>(
      `INSERT INTO "assessment_periods"
        ("id", "team_id", "season_id", "template_id", "name", "cohort",
         "starts_on", "ends_on", "created_by", "created_at")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING ${PERIOD_COLUMNS}`,
      [
        period.id,
        period.teamId,
        period.seasonId,
        period.templateId,
        period.name,
        period.cohort,
        period.startsOn,
        period.endsOn,
        period.createdBy,
        period.now.toISOString(),
      ],
    );
    return toAssessmentPeriod(this.requireRow(rows));
  }

  async listPeriods(
    scope: TransactionScope,
    teamId: string,
    page: PageRequest,
  ): Promise<AssessmentPeriodPage> {
    const rows = await scope.run<PeriodRow>(
      `SELECT ${PERIOD_COLUMNS} FROM "assessment_periods"
        WHERE "team_id" = $1
        ORDER BY "starts_on" ASC, "ends_on" ASC, "id" ASC
        LIMIT $2 OFFSET $3`,
      [teamId, page.limit, page.offset],
    );
    const totals = await scope.run<CountRow>(
      `SELECT COUNT(*)::int AS "count" FROM "assessment_periods"
        WHERE "team_id" = $1`,
      [teamId],
    );
    return this.page(
      rows.map(toAssessmentPeriod),
      totals[0]?.count ?? 0,
      page,
    );
  }

  private currentMetricPredicate(): string {
    return `(m."team_id" IS NULL OR m."team_id" = $1)
      AND m."status" = 'active'
      AND NOT EXISTS (
        SELECT 1 FROM "assessment_metric_definitions" newer
         WHERE newer."family_id" = m."family_id"
           AND newer."definition_version" > m."definition_version"
           AND newer."status" = 'active'
      )`;
  }

  private qualifyMetricColumns(): string {
    return METRIC_COLUMNS.split(', ')
      .map(column => `m.${column}`)
      .join(', ');
  }

  private metricParameters(metric: NewMetric): readonly unknown[] {
    return [
      metric.id,
      metric.familyId,
      metric.teamId,
      metric.categoryId,
      metric.scaleId,
      metric.key,
      metric.name,
      metric.definition,
      metric.direction,
      metric.guidance,
      metric.applicability,
      metric.tags,
      metric.version,
      metric.createdBy,
      metric.now.toISOString(),
    ];
  }

  private templateParameters(template: NewTemplate): readonly unknown[] {
    return [
      template.id,
      template.familyId,
      template.teamId,
      template.seasonId,
      template.key,
      template.name,
      template.cohort,
      template.evaluatorRoles,
      template.scoreVersion,
      template.version,
      template.createdBy,
      template.now.toISOString(),
    ];
  }

  private async insertTemplateRelations(
    scope: TransactionScope,
    templateId: string,
    weights: readonly CategoryWeightInput[],
    metrics: readonly TemplateMetricInput[],
  ): Promise<void> {
    await scope.run(
      `INSERT INTO "assessment_template_category_weights"
        ("template_id", "category_id", "weight_percentage")
       SELECT $1, input."category_id", input."weight"
         FROM unnest($2::uuid[], $3::integer[]) AS input("category_id", "weight")`,
      [
        templateId,
        weights.map(weight => weight.categoryId),
        weights.map(weight => weight.weightPercentage),
      ],
    );
    await scope.run(
      `INSERT INTO "assessment_template_metrics"
        ("template_id", "metric_definition_id", "required", "sort_order")
       SELECT $1, input."metric_id", input."required", input."sort_order"
         FROM unnest($2::uuid[], $3::boolean[], $4::integer[])
           AS input("metric_id", "required", "sort_order")`,
      [
        templateId,
        metrics.map(metric => metric.metricDefinitionId),
        metrics.map(metric => metric.required),
        metrics.map(metric => metric.sortOrder),
      ],
    );
  }

  private async loadTemplateRelations(
    scope: TransactionScope,
    templateIds: readonly string[],
  ): Promise<{
    readonly weights: readonly CategoryWeightRow[];
    readonly metrics: readonly TemplateMetricRow[];
  }> {
    if (templateIds.length === 0) {
      return { weights: [], metrics: [] };
    }
    const weights = await scope.run<CategoryWeightRow>(
      `SELECT "template_id", "category_id", "weight_percentage"
         FROM "assessment_template_category_weights"
        WHERE "template_id" = ANY($1::uuid[])
        ORDER BY "template_id" ASC, "category_id" ASC`,
      [templateIds],
    );
    const metrics = await scope.run<TemplateMetricRow>(
      `SELECT "template_id", "metric_definition_id", "required", "sort_order"
         FROM "assessment_template_metrics"
        WHERE "template_id" = ANY($1::uuid[])
        ORDER BY "template_id" ASC, "sort_order" ASC, "metric_definition_id" ASC`,
      [templateIds],
    );
    return { weights, metrics };
  }

  private async count(
    scope: TransactionScope,
    table: string,
  ): Promise<number> {
    const statement =
      table === 'assessment_metric_categories'
        ? `SELECT COUNT(*)::int AS "count"
             FROM "assessment_metric_categories" WHERE "status" = 'active'`
        : `SELECT COUNT(*)::int AS "count"
             FROM "assessment_scales" WHERE "status" = 'active'`;
    const rows = await scope.run<CountRow>(statement);
    return rows[0]?.count ?? 0;
  }

  private page<TItem>(
    items: readonly TItem[],
    total: number,
    page: PageRequest,
  ): {
    readonly items: readonly TItem[];
    readonly total: number;
    readonly limit: number;
    readonly offset: number;
  } {
    return { items, total, limit: page.limit, offset: page.offset };
  }

  private requireRow<TRow>(rows: readonly TRow[]): TRow {
    const row = rows[0];
    if (row === undefined) {
      throw new Error('Expected a returned row from the assessment write');
    }
    return row;
  }
}

