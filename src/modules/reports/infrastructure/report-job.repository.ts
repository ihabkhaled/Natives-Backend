import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { toReportJob } from '../lib/reports.mapper';
import { LIST_MAX_LIMIT, REPORT_JOB_COLUMNS } from '../model/reports.constants';
import type {
  ReportCountRow,
  ReportIdRow,
  ReportJobRow,
} from '../model/reports.rows';
import type {
  NewReportJob,
  PageRequest,
  ReportCompletion,
  ReportJob,
  ReportListFilter,
} from '../model/reports.types';

/**
 * Persistence for report jobs. Data access only: parameterized SQL, static
 * column lists, optimistic-version-guarded completion writes, and bounded reads.
 * The request-hash unique index enforces idempotency at the database level, so a
 * concurrent re-request cannot create a second job for the same inputs.
 */
@Injectable()
export class ReportJobRepository {
  async insert(scope: TransactionScope, job: NewReportJob): Promise<ReportJob> {
    const rows = await scope.run<ReportJobRow>(
      `INSERT INTO "report_jobs"
        ("id", "team_id", "season_id", "template", "format", "privacy_class",
         "parameters", "request_hash", "calculation_version", "snapshot_at",
         "expires_at", "requested_by", "created_at", "updated_at")
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11, $12, $10,
               $10)
       RETURNING ${REPORT_JOB_COLUMNS}`,
      [
        job.id,
        job.teamId,
        job.seasonId,
        job.template,
        job.format,
        job.privacyClass,
        JSON.stringify(job.parameters),
        job.requestHash,
        job.calculationVersion,
        job.snapshotAt.toISOString(),
        job.expiresAt.toISOString(),
        job.requestedBy,
      ],
    );
    const row = rows[0];
    if (row === undefined) {
      throw new Error('Expected a returned row from the report job write');
    }
    return toReportJob(row);
  }

  async findForWrite(
    scope: TransactionScope,
    teamId: string,
    jobId: string,
  ): Promise<ReportJob | null> {
    const rows = await scope.run<ReportJobRow>(
      `SELECT ${REPORT_JOB_COLUMNS} FROM "report_jobs"
        WHERE "id" = $1 AND "team_id" = $2`,
      [jobId, teamId],
    );
    const row = rows[0];
    return row === undefined ? null : toReportJob(row);
  }

  async findByRequestHash(
    scope: TransactionScope,
    teamId: string,
    requestHash: string,
  ): Promise<ReportJob | null> {
    const rows = await scope.run<ReportJobRow>(
      `SELECT ${REPORT_JOB_COLUMNS} FROM "report_jobs"
        WHERE "team_id" = $1 AND "request_hash" = $2`,
      [teamId, requestHash],
    );
    const row = rows[0];
    return row === undefined ? null : toReportJob(row);
  }

  /** Mark a queued job running (the synchronous part of the async pipeline). */
  async markRunning(
    scope: TransactionScope,
    teamId: string,
    jobId: string,
    now: Date,
  ): Promise<ReportJob | null> {
    const rows = await scope.run<ReportJobRow>(
      `UPDATE "report_jobs"
          SET "status" = 'running', "progress" = 10, "started_at" = $3,
              "updated_at" = $3, "record_version" = "record_version" + 1
        WHERE "id" = $1 AND "team_id" = $2 AND "status" IN ('queued', 'failed')
       RETURNING ${REPORT_JOB_COLUMNS}`,
      [jobId, teamId, now.toISOString()],
    );
    const row = rows[0];
    return row === undefined ? null : toReportJob(row);
  }

  async complete(
    scope: TransactionScope,
    completion: ReportCompletion,
  ): Promise<ReportJob | null> {
    const rows = await scope.run<ReportJobRow>(
      `UPDATE "report_jobs"
          SET "status" = 'completed', "progress" = 100,
              "storage_reference" = $4, "checksum" = $5, "row_count" = $6,
              "completed_at" = $7, "updated_at" = $7,
              "record_version" = "record_version" + 1
        WHERE "id" = $1 AND "team_id" = $2 AND "record_version" = $3
          AND "status" = 'running'
       RETURNING ${REPORT_JOB_COLUMNS}`,
      [
        completion.id,
        completion.teamId,
        completion.expectedRecordVersion,
        completion.storageReference,
        completion.checksum,
        completion.rowCount,
        completion.now.toISOString(),
      ],
    );
    const row = rows[0];
    return row === undefined ? null : toReportJob(row);
  }

  async incrementRetry(
    scope: TransactionScope,
    teamId: string,
    jobId: string,
    now: Date,
  ): Promise<ReportJob | null> {
    const rows = await scope.run<ReportJobRow>(
      `UPDATE "report_jobs"
          SET "status" = 'running', "progress" = 10,
              "retry_count" = "retry_count" + 1, "failure_reason" = NULL,
              "started_at" = $3, "updated_at" = $3,
              "record_version" = "record_version" + 1
        WHERE "id" = $1 AND "team_id" = $2 AND "status" = 'failed'
       RETURNING ${REPORT_JOB_COLUMNS}`,
      [jobId, teamId, now.toISOString()],
    );
    const row = rows[0];
    return row === undefined ? null : toReportJob(row);
  }

  async listForScope(
    scope: TransactionScope,
    teamId: string,
    filter: ReportListFilter,
    page: PageRequest,
  ): Promise<readonly ReportJob[]> {
    const rows = await scope.run<ReportJobRow>(
      `SELECT ${REPORT_JOB_COLUMNS} FROM "report_jobs"
        WHERE "team_id" = $1
          AND ($2::text IS NULL OR "template" = $2)
          AND ($3::text IS NULL OR "status" = $3)
        ORDER BY "created_at" DESC, "id" ASC
        LIMIT $4 OFFSET $5`,
      [
        teamId,
        filter.template,
        filter.status,
        Math.min(page.limit, LIST_MAX_LIMIT),
        page.offset,
      ],
    );
    return rows.map(row => toReportJob(row));
  }

  async countForScope(
    scope: TransactionScope,
    teamId: string,
    filter: ReportListFilter,
  ): Promise<number> {
    const rows = await scope.run<ReportCountRow>(
      `SELECT COUNT(*)::int AS "count" FROM "report_jobs"
        WHERE "team_id" = $1
          AND ($2::text IS NULL OR "template" = $2)
          AND ($3::text IS NULL OR "status" = $3)`,
      [teamId, filter.template, filter.status],
    );
    return Number(rows[0]?.count ?? 0);
  }

  async activeTeamExists(
    scope: TransactionScope,
    teamId: string,
  ): Promise<boolean> {
    const rows = await scope.run<ReportIdRow>(
      `SELECT "id" FROM "teams" WHERE "id" = $1 AND "status" = 'active'`,
      [teamId],
    );
    return rows.length > 0;
  }
}
