import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { toActivitySubmission } from '../lib/activity.mapper';
import { ACTIVITY_SUBMISSION_COLUMNS } from '../model/activities.constants';
import type {
  ActivitySubmissionRow,
  CountRow,
  IdRow,
} from '../model/activity.rows';
import type {
  ActivitySubmission,
  NewActivitySubmission,
  PageRequest,
  SubmissionContentUpdate,
  SubmissionStatusChange,
} from '../model/activity.types';

/**
 * Persistence for the activity-submission aggregate. Data access only:
 * parameterized SQL through the caller's transaction, static column lists,
 * optimistic-version-guarded writes, soft-delete-aware bounded/ordered reads.
 * Duration and quantity persist NULL when not measured (null-not-zero).
 */
@Injectable()
export class ActivitySubmissionRepository {
  async insert(
    scope: TransactionScope,
    submission: NewActivitySubmission,
  ): Promise<ActivitySubmission> {
    const rows = await scope.run<ActivitySubmissionRow>(
      `INSERT INTO "activity_submissions"
        ("id", "team_id", "season_id", "membership_id", "activity_type_id",
         "submitter_user_id", "status", "performed_on", "duration_minutes",
         "quantity", "notes", "created_by", "created_at", "updated_at")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $6, $12, $12)
       RETURNING ${ACTIVITY_SUBMISSION_COLUMNS}`,
      [
        submission.id,
        submission.teamId,
        submission.content.seasonId,
        submission.membershipId,
        submission.content.activityTypeId,
        submission.submitterUserId,
        submission.status,
        submission.content.performedOn,
        submission.content.durationMinutes,
        submission.content.quantity,
        submission.content.notes,
        submission.now.toISOString(),
      ],
    );
    return toActivitySubmission(this.requireRow(rows));
  }

  async existsLiveForMember(
    scope: TransactionScope,
    membershipId: string,
    activityTypeId: string,
    performedOn: string,
    excludeSubmissionId: string | null,
  ): Promise<boolean> {
    const rows = await scope.run<IdRow>(
      `SELECT "id" FROM "activity_submissions"
        WHERE "membership_id" = $1 AND "activity_type_id" = $2
          AND "performed_on" = $3 AND "deleted_at" IS NULL
          AND "status" NOT IN ('withdrawn', 'rejected', 'reversed')
          AND ($4::uuid IS NULL OR "id" <> $4)
        LIMIT 1`,
      [membershipId, activityTypeId, performedOn, excludeSubmissionId],
    );
    return rows.length > 0;
  }

  async findForWrite(
    scope: TransactionScope,
    teamId: string,
    submissionId: string,
  ): Promise<ActivitySubmission | null> {
    const rows = await scope.run<ActivitySubmissionRow>(
      `SELECT ${ACTIVITY_SUBMISSION_COLUMNS} FROM "activity_submissions"
        WHERE "id" = $1 AND "team_id" = $2 AND "deleted_at" IS NULL`,
      [submissionId, teamId],
    );
    const row = rows[0];
    return row === undefined ? null : toActivitySubmission(row);
  }

  async updateContent(
    scope: TransactionScope,
    update: SubmissionContentUpdate,
  ): Promise<ActivitySubmission | null> {
    const rows = await scope.run<ActivitySubmissionRow>(
      `UPDATE "activity_submissions"
          SET "activity_type_id" = $4, "season_id" = $5, "performed_on" = $6,
              "duration_minutes" = $7, "quantity" = $8, "notes" = $9,
              "updated_at" = $10, "record_version" = "record_version" + 1
        WHERE "id" = $1 AND "team_id" = $2 AND "record_version" = $3
          AND "deleted_at" IS NULL
       RETURNING ${ACTIVITY_SUBMISSION_COLUMNS}`,
      [
        update.id,
        update.teamId,
        update.expectedRecordVersion,
        update.content.activityTypeId,
        update.content.seasonId,
        update.content.performedOn,
        update.content.durationMinutes,
        update.content.quantity,
        update.content.notes,
        update.now.toISOString(),
      ],
    );
    const row = rows[0];
    return row === undefined ? null : toActivitySubmission(row);
  }

  async applyStatusChange(
    scope: TransactionScope,
    change: SubmissionStatusChange,
  ): Promise<ActivitySubmission | null> {
    const rows = await scope.run<ActivitySubmissionRow>(
      `UPDATE "activity_submissions"
          SET "status" = $4,
              "submitted_at" = CASE WHEN $4 = 'submitted' THEN $5
                                    ELSE "submitted_at" END,
              "submitted_by" = CASE WHEN $4 = 'submitted' THEN $6
                                    ELSE "submitted_by" END,
              "withdrawn_at" = CASE WHEN $4 = 'withdrawn' THEN $5
                                    ELSE "withdrawn_at" END,
              "updated_at" = $5, "record_version" = "record_version" + 1
        WHERE "id" = $1 AND "team_id" = $2 AND "record_version" = $3
          AND "deleted_at" IS NULL
       RETURNING ${ACTIVITY_SUBMISSION_COLUMNS}`,
      [
        change.id,
        change.teamId,
        change.expectedRecordVersion,
        change.toStatus,
        change.now.toISOString(),
        change.actorUserId,
      ],
    );
    const row = rows[0];
    return row === undefined ? null : toActivitySubmission(row);
  }

  async listForMember(
    scope: TransactionScope,
    teamId: string,
    userId: string,
    page: PageRequest,
  ): Promise<readonly ActivitySubmission[]> {
    const rows = await scope.run<ActivitySubmissionRow>(
      `SELECT ${ACTIVITY_SUBMISSION_COLUMNS} FROM "activity_submissions"
        WHERE "team_id" = $1 AND "submitter_user_id" = $2
          AND "deleted_at" IS NULL
        ORDER BY "created_at" DESC, "id" ASC
        LIMIT $3 OFFSET $4`,
      [teamId, userId, page.limit, page.offset],
    );
    return rows.map(row => toActivitySubmission(row));
  }

  async countForMember(
    scope: TransactionScope,
    teamId: string,
    userId: string,
  ): Promise<number> {
    const rows = await scope.run<CountRow>(
      `SELECT COUNT(*)::int AS "count" FROM "activity_submissions"
        WHERE "team_id" = $1 AND "submitter_user_id" = $2
          AND "deleted_at" IS NULL`,
      [teamId, userId],
    );
    return rows[0]?.count ?? 0;
  }

  private requireRow(
    rows: readonly ActivitySubmissionRow[],
  ): ActivitySubmissionRow {
    const row = rows[0];
    if (row === undefined) {
      throw new Error(
        'Expected a returned row from the activity submission write',
      );
    }
    return row;
  }
}
