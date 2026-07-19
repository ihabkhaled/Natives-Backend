import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { toActivityEvidence } from '../lib/activity.mapper';
import { ACTIVITY_EVIDENCE_COLUMNS } from '../model/activities.constants';
import type {
  ActivityEvidenceRow,
  CountRow,
  EvidenceCountRow,
} from '../model/activity.rows';
import type {
  ActivityEvidence,
  NewActivityEvidence,
} from '../model/activity.types';

/**
 * Persistence for activity evidence: metadata + a PRIVATE storage reference only.
 * The full row (including the reference) is read exclusively through the
 * reviewer-scoped list; member surfaces never select this table. Evidence is a
 * replace-all child collection of an editable submission.
 */
@Injectable()
export class ActivityEvidenceRepository {
  async insertMany(
    scope: TransactionScope,
    items: readonly NewActivityEvidence[],
  ): Promise<void> {
    if (items.length === 0) {
      return;
    }
    await scope.run(
      `INSERT INTO "activity_evidence"
        ("id", "submission_id", "kind", "storage_reference", "content_type",
         "byte_size", "description", "created_by", "created_at")
       SELECT input."id", input."submission_id", input."kind",
              input."storage_reference", input."content_type", input."byte_size",
              input."description", input."created_by", input."created_at"
         FROM jsonb_to_recordset($1::jsonb) AS input(
           "id" uuid, "submission_id" uuid, "kind" text,
           "storage_reference" text, "content_type" text, "byte_size" bigint,
           "description" text, "created_by" uuid, "created_at" timestamptz)`,
      [JSON.stringify(items.map(item => this.record(item)))],
    );
  }

  async clearForSubmission(
    scope: TransactionScope,
    submissionId: string,
  ): Promise<void> {
    await scope.run(
      `DELETE FROM "activity_evidence" WHERE "submission_id" = $1`,
      [submissionId],
    );
  }

  async listForSubmission(
    scope: TransactionScope,
    submissionId: string,
  ): Promise<readonly ActivityEvidence[]> {
    const rows = await scope.run<ActivityEvidenceRow>(
      `SELECT ${ACTIVITY_EVIDENCE_COLUMNS} FROM "activity_evidence"
        WHERE "submission_id" = $1
        ORDER BY "created_at" ASC, "id" ASC`,
      [submissionId],
    );
    return rows.map(row => toActivityEvidence(row));
  }

  async countForSubmission(
    scope: TransactionScope,
    submissionId: string,
  ): Promise<number> {
    const rows = await scope.run<CountRow>(
      `SELECT COUNT(*)::int AS "count" FROM "activity_evidence"
        WHERE "submission_id" = $1`,
      [submissionId],
    );
    return rows[0]?.count ?? 0;
  }

  async countsBySubmission(
    scope: TransactionScope,
    submissionIds: readonly string[],
  ): Promise<ReadonlyMap<string, number>> {
    const counts = new Map<string, number>();
    if (submissionIds.length === 0) {
      return counts;
    }
    const rows = await scope.run<EvidenceCountRow>(
      `SELECT "submission_id", COUNT(*)::int AS "count"
         FROM "activity_evidence"
        WHERE "submission_id" = ANY($1::uuid[])
        GROUP BY "submission_id"`,
      [submissionIds],
    );
    for (const row of rows) {
      counts.set(row.submission_id, row.count);
    }
    return counts;
  }

  private record(item: NewActivityEvidence): Readonly<Record<string, unknown>> {
    return {
      id: item.id,
      submission_id: item.submissionId,
      kind: item.item.kind,
      storage_reference: item.item.storageReference,
      content_type: item.item.contentType,
      byte_size: item.item.byteSize,
      description: item.item.description,
      created_by: item.createdBy,
      created_at: item.now.toISOString(),
    };
  }
}
