import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { toComparison } from '../lib/migration.mapper';
import {
  COMPARISON_COLUMNS,
  COMPARISON_UPSERT_SQL,
  LIST_MAX_LIMIT,
} from '../model/migration.constants';
import type { ComparisonRow, MigrationCountRow } from '../model/migration.rows';
import type {
  ComparisonListFilter,
  ComparisonSignOff,
  ComparisonUpsert,
  FormulaComparison,
  PageRequest,
} from '../model/migration.types';

/**
 * Persistence for formula comparisons. Data access only: parameterized SQL,
 * static column lists, optimistic-version-guarded sign-off writes, and bounded
 * reads. A comparison is upserted per (workbook, metric, subject) so re-running
 * the comparison converges rather than piling up duplicate rows.
 */
@Injectable()
export class FormulaComparisonRepository {
  async upsert(
    scope: TransactionScope,
    comparison: ComparisonUpsert,
  ): Promise<FormulaComparison> {
    const rows = await scope.run<ComparisonRow>(COMPARISON_UPSERT_SQL, [
      comparison.id,
      comparison.teamId,
      comparison.workbookType,
      comparison.metric,
      comparison.subjectRef,
      comparison.legacyValue,
      comparison.targetValue,
      comparison.difference,
      comparison.classification,
      comparison.legacyRuleVersion,
      comparison.targetRuleVersion,
      comparison.artifactChecksum,
      comparison.now.toISOString(),
    ]);
    const row = rows[0];
    if (row === undefined) {
      throw new Error('Expected a returned row from the comparison write');
    }
    return toComparison(row);
  }

  async findForWrite(
    scope: TransactionScope,
    teamId: string,
    comparisonId: string,
  ): Promise<FormulaComparison | null> {
    const rows = await scope.run<ComparisonRow>(
      `SELECT ${COMPARISON_COLUMNS} FROM "formula_comparisons"
        WHERE "id" = $1 AND "team_id" = $2`,
      [comparisonId, teamId],
    );
    const row = rows[0];
    return row === undefined ? null : toComparison(row);
  }

  async signOff(
    scope: TransactionScope,
    signOff: ComparisonSignOff,
  ): Promise<FormulaComparison | null> {
    const rows = await scope.run<ComparisonRow>(
      `UPDATE "formula_comparisons"
          SET "signed_off" = true, "signed_off_by_name" = $4,
              "signed_off_at" = $5, "updated_at" = $5,
              "record_version" = "record_version" + 1
        WHERE "id" = $1 AND "team_id" = $2 AND "record_version" = $3
          AND "signed_off" = false
       RETURNING ${COMPARISON_COLUMNS}`,
      [
        signOff.id,
        signOff.teamId,
        signOff.expectedRecordVersion,
        signOff.signedOffByName,
        signOff.now.toISOString(),
      ],
    );
    const row = rows[0];
    return row === undefined ? null : toComparison(row);
  }

  async listForScope(
    scope: TransactionScope,
    teamId: string,
    filter: ComparisonListFilter,
    page: PageRequest,
  ): Promise<readonly FormulaComparison[]> {
    const rows = await scope.run<ComparisonRow>(
      `SELECT ${COMPARISON_COLUMNS} FROM "formula_comparisons"
        WHERE "team_id" = $1
          AND ($2::text IS NULL OR "workbook_type" = $2)
          AND ($3::text IS NULL OR "classification" = $3)
          AND ($4::boolean IS NULL OR "signed_off" = $4)
        ORDER BY "workbook_type" ASC, "metric" ASC, "id" ASC
        LIMIT $5 OFFSET $6`,
      [
        teamId,
        filter.workbookType,
        filter.classification,
        filter.signedOff,
        Math.min(page.limit, LIST_MAX_LIMIT),
        page.offset,
      ],
    );
    return rows.map(row => toComparison(row));
  }

  async countForScope(
    scope: TransactionScope,
    teamId: string,
    filter: ComparisonListFilter,
  ): Promise<number> {
    const rows = await scope.run<MigrationCountRow>(
      `SELECT COUNT(*)::int AS "count" FROM "formula_comparisons"
        WHERE "team_id" = $1
          AND ($2::text IS NULL OR "workbook_type" = $2)
          AND ($3::text IS NULL OR "classification" = $3)
          AND ($4::boolean IS NULL OR "signed_off" = $4)`,
      [teamId, filter.workbookType, filter.classification, filter.signedOff],
    );
    return Number(rows[0]?.count ?? 0);
  }
}
