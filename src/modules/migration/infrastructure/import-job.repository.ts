import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { toImportJob, toRowResult } from '../lib/migration.mapper';
import {
  IMPORT_JOB_COLUMNS,
  LIST_MAX_LIMIT,
  RESULTS_MAX_LIMIT,
  ROW_RESULT_COLUMNS,
} from '../model/migration.constants';
import type {
  ImportJobRow,
  MigrationCountRow,
  RowResultRow,
} from '../model/migration.rows';
import type {
  ImportJob,
  ImportListFilter,
  ImportReconciliation,
  NewImportJob,
  NewRowResult,
  PageRequest,
  RowResult,
} from '../model/migration.types';

/**
 * Persistence for import jobs and their per-row results. Data access only:
 * parameterized SQL, static column lists, optimistic-version-guarded
 * reconciliation writes, and bounded reads. The committed-source unique index
 * (source hash + mapper, non-dry-run) enforces idempotency at the database
 * level, so a re-committed workbook cannot double-import.
 */
@Injectable()
export class ImportJobRepository {
  async insert(scope: TransactionScope, job: NewImportJob): Promise<ImportJob> {
    const rows = await scope.run<ImportJobRow>(
      `INSERT INTO "import_jobs"
        ("id", "team_id", "season_id", "workbook_type", "mapper_version",
         "source_hash", "source_name", "dry_run", "reversal_of_job_id",
         "requested_by", "created_at", "updated_at")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)
       RETURNING ${IMPORT_JOB_COLUMNS}`,
      [
        job.id,
        job.teamId,
        job.seasonId,
        job.workbookType,
        job.mapperVersion,
        job.sourceHash,
        job.sourceName,
        job.dryRun,
        job.reversalOfJobId,
        job.requestedBy,
        job.now.toISOString(),
      ],
    );
    const row = rows[0];
    if (row === undefined) {
      throw new Error('Expected a returned row from the import job write');
    }
    return toImportJob(row);
  }

  async findForWrite(
    scope: TransactionScope,
    teamId: string,
    jobId: string,
  ): Promise<ImportJob | null> {
    const rows = await scope.run<ImportJobRow>(
      `SELECT ${IMPORT_JOB_COLUMNS} FROM "import_jobs"
        WHERE "id" = $1 AND "team_id" = $2`,
      [jobId, teamId],
    );
    const row = rows[0];
    return row === undefined ? null : toImportJob(row);
  }

  async findCommittedBySource(
    scope: TransactionScope,
    teamId: string,
    sourceHash: string,
    mapperVersion: string,
  ): Promise<ImportJob | null> {
    const rows = await scope.run<ImportJobRow>(
      `SELECT ${IMPORT_JOB_COLUMNS} FROM "import_jobs"
        WHERE "team_id" = $1 AND "source_hash" = $2 AND "mapper_version" = $3
          AND "dry_run" = false
        LIMIT 1`,
      [teamId, sourceHash, mapperVersion],
    );
    const row = rows[0];
    return row === undefined ? null : toImportJob(row);
  }

  async reconcile(
    scope: TransactionScope,
    reconciliation: ImportReconciliation,
  ): Promise<ImportJob | null> {
    const rows = await scope.run<ImportJobRow>(
      `UPDATE "import_jobs"
          SET "status" = $4, "received_rows" = $5, "staged_rows" = $6,
              "committed_rows" = $7, "skipped_rows" = $8, "error_rows" = $9,
              "quarantined_rows" = $10,
              "committed_at" = CASE WHEN $11 THEN $13 ELSE "committed_at" END,
              "reversed_at" = CASE WHEN $12 THEN $13 ELSE "reversed_at" END,
              "updated_at" = $13, "record_version" = "record_version" + 1
        WHERE "id" = $1 AND "team_id" = $2 AND "record_version" = $3
       RETURNING ${IMPORT_JOB_COLUMNS}`,
      [
        reconciliation.id,
        reconciliation.teamId,
        reconciliation.expectedRecordVersion,
        reconciliation.status,
        reconciliation.receivedRows,
        reconciliation.stagedRows,
        reconciliation.committedRows,
        reconciliation.skippedRows,
        reconciliation.errorRows,
        reconciliation.quarantinedRows,
        reconciliation.committed,
        reconciliation.reversed,
        reconciliation.now.toISOString(),
      ],
    );
    const row = rows[0];
    return row === undefined ? null : toImportJob(row);
  }

  async insertRowResults(
    scope: TransactionScope,
    results: readonly NewRowResult[],
  ): Promise<void> {
    for (const result of results) {
      await scope.run(
        `INSERT INTO "import_row_results"
          ("id", "team_id", "job_id", "row_ref", "outcome", "action",
           "entity_ref", "message_key", "created_at")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          result.id,
          result.teamId,
          result.jobId,
          result.rowRef,
          result.outcome,
          result.action,
          result.entityRef,
          result.messageKey,
          result.now.toISOString(),
        ],
      );
    }
  }

  async listResults(
    scope: TransactionScope,
    jobId: string,
  ): Promise<readonly RowResult[]> {
    const rows = await scope.run<RowResultRow>(
      `SELECT ${ROW_RESULT_COLUMNS} FROM "import_row_results"
        WHERE "job_id" = $1
        ORDER BY "row_ref" ASC, "id" ASC
        LIMIT $2`,
      [jobId, RESULTS_MAX_LIMIT],
    );
    return rows.map(row => toRowResult(row));
  }

  async listForScope(
    scope: TransactionScope,
    teamId: string,
    filter: ImportListFilter,
    page: PageRequest,
  ): Promise<readonly ImportJob[]> {
    const rows = await scope.run<ImportJobRow>(
      `SELECT ${IMPORT_JOB_COLUMNS} FROM "import_jobs"
        WHERE "team_id" = $1
          AND ($2::text IS NULL OR "workbook_type" = $2)
          AND ($3::text IS NULL OR "status" = $3)
        ORDER BY "created_at" DESC, "id" ASC
        LIMIT $4 OFFSET $5`,
      [
        teamId,
        filter.workbookType,
        filter.status,
        Math.min(page.limit, LIST_MAX_LIMIT),
        page.offset,
      ],
    );
    return rows.map(row => toImportJob(row));
  }

  async countForScope(
    scope: TransactionScope,
    teamId: string,
    filter: ImportListFilter,
  ): Promise<number> {
    const rows = await scope.run<MigrationCountRow>(
      `SELECT COUNT(*)::int AS "count" FROM "import_jobs"
        WHERE "team_id" = $1
          AND ($2::text IS NULL OR "workbook_type" = $2)
          AND ($3::text IS NULL OR "status" = $3)`,
      [teamId, filter.workbookType, filter.status],
    );
    return Number(rows[0]?.count ?? 0);
  }
}
