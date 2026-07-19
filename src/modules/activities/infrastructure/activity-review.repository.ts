import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { toActivitySubmission } from '../lib/activity.mapper';
import { ACTIVITY_SUBMISSION_COLUMNS } from '../model/activities.constants';
import type {
  AbuseCountsRow,
  ActivitySubmissionRow,
  CountRow,
  IdRow,
} from '../model/activity.rows';
import type {
  AbuseCounts,
  AbuseProbeWindow,
  ActivitySubmission,
  ReviewClaimChange,
  ReviewDecisionChange,
  ReviewQueueQuery,
  ReviewReversalChange,
} from '../model/activity.types';

/**
 * Persistence for the reviewer workflow (401). Data access only: parameterized
 * SQL through the caller's transaction, static column lists, optimistic-version-
 * guarded transitions, and bounded/deterministically-ordered queue reads. The
 * anti-abuse probes are all bounded aggregate counts, never row dumps.
 */
@Injectable()
export class ActivityReviewRepository {
  async listQueue(
    scope: TransactionScope,
    teamId: string,
    query: ReviewQueueQuery,
  ): Promise<readonly ActivitySubmission[]> {
    const rows = await scope.run<ActivitySubmissionRow>(
      `SELECT ${ACTIVITY_SUBMISSION_COLUMNS} FROM "activity_submissions"
        WHERE "team_id" = $1 AND "deleted_at" IS NULL
          AND "status" = ANY($2::text[])
          AND ($3::uuid IS NULL OR "activity_type_id" = $3)
          AND ($4::uuid IS NULL OR "membership_id" = $4)
        ORDER BY "submitted_at" ASC NULLS LAST, "created_at" ASC, "id" ASC
        LIMIT $5 OFFSET $6`,
      [
        teamId,
        query.statuses,
        query.activityTypeId,
        query.membershipId,
        query.page.limit,
        query.page.offset,
      ],
    );
    return rows.map(row => toActivitySubmission(row));
  }

  async countQueue(
    scope: TransactionScope,
    teamId: string,
    query: ReviewQueueQuery,
  ): Promise<number> {
    const rows = await scope.run<CountRow>(
      `SELECT COUNT(*)::int AS "count" FROM "activity_submissions"
        WHERE "team_id" = $1 AND "deleted_at" IS NULL
          AND "status" = ANY($2::text[])
          AND ($3::uuid IS NULL OR "activity_type_id" = $3)
          AND ($4::uuid IS NULL OR "membership_id" = $4)`,
      [teamId, query.statuses, query.activityTypeId, query.membershipId],
    );
    return rows[0]?.count ?? 0;
  }

  async claimForReview(
    scope: TransactionScope,
    change: ReviewClaimChange,
  ): Promise<ActivitySubmission | null> {
    const rows = await scope.run<ActivitySubmissionRow>(
      `UPDATE "activity_submissions"
          SET "status" = 'under_review', "reviewer_user_id" = $4,
              "review_started_at" = $5, "updated_at" = $5,
              "record_version" = "record_version" + 1
        WHERE "id" = $1 AND "team_id" = $2 AND "record_version" = $3
          AND "deleted_at" IS NULL AND "status" = 'submitted'
       RETURNING ${ACTIVITY_SUBMISSION_COLUMNS}`,
      [
        change.id,
        change.teamId,
        change.expectedRecordVersion,
        change.reviewerUserId,
        change.now.toISOString(),
      ],
    );
    const row = rows[0];
    return row === undefined ? null : toActivitySubmission(row);
  }

  async applyDecision(
    scope: TransactionScope,
    change: ReviewDecisionChange,
  ): Promise<ActivitySubmission | null> {
    const rows = await scope.run<ActivitySubmissionRow>(
      `UPDATE "activity_submissions"
          SET "status" = $4, "review_note" = $5,
              "reviewer_user_id" = COALESCE("reviewer_user_id", $6),
              "reviewed_at" = $7, "reviewed_by" = $6, "updated_at" = $7,
              "record_version" = "record_version" + 1
        WHERE "id" = $1 AND "team_id" = $2 AND "record_version" = $3
          AND "deleted_at" IS NULL
          AND "status" IN ('submitted', 'under_review')
       RETURNING ${ACTIVITY_SUBMISSION_COLUMNS}`,
      [
        change.id,
        change.teamId,
        change.expectedRecordVersion,
        change.toStatus,
        change.reviewNote,
        change.reviewerUserId,
        change.now.toISOString(),
      ],
    );
    const row = rows[0];
    return row === undefined ? null : toActivitySubmission(row);
  }

  async applyReversal(
    scope: TransactionScope,
    change: ReviewReversalChange,
  ): Promise<ActivitySubmission | null> {
    const rows = await scope.run<ActivitySubmissionRow>(
      `UPDATE "activity_submissions"
          SET "status" = 'reversed', "reversal_reason" = $4,
              "reversed_at" = $5, "reversed_by" = $6, "updated_at" = $5,
              "record_version" = "record_version" + 1
        WHERE "id" = $1 AND "team_id" = $2 AND "record_version" = $3
          AND "deleted_at" IS NULL AND "status" = 'approved'
       RETURNING ${ACTIVITY_SUBMISSION_COLUMNS}`,
      [
        change.id,
        change.teamId,
        change.expectedRecordVersion,
        change.reversalReason,
        change.now.toISOString(),
        change.actorUserId,
      ],
    );
    const row = rows[0];
    return row === undefined ? null : toActivitySubmission(row);
  }

  async abuseCounts(
    scope: TransactionScope,
    membershipId: string,
    submissionId: string,
    performedOn: string,
    window: AbuseProbeWindow,
  ): Promise<AbuseCounts> {
    const rows = await scope.run<AbuseCountsRow>(
      `SELECT
         (SELECT COUNT(*) FROM "activity_submissions"
           WHERE "membership_id" = $1 AND "performed_on" = $3
             AND "id" <> $2 AND "deleted_at" IS NULL
             AND "status" NOT IN ('withdrawn', 'rejected', 'reversed'))::int
           AS "same_day",
         (SELECT COUNT(*) FROM "activity_submissions"
           WHERE "membership_id" = $1 AND "deleted_at" IS NULL
             AND "performed_on" BETWEEN $4 AND $5
             AND "status" NOT IN ('withdrawn', 'rejected', 'reversed'))::int
           AS "window_count",
         (SELECT COALESCE(MAX("pairings"), 0) FROM (
            SELECT COUNT(*) AS "pairings" FROM "activity_buddies" b
              JOIN "activity_submissions" s ON s."id" = b."submission_id"
             WHERE s."membership_id" = $1 AND s."deleted_at" IS NULL
               AND s."performed_on" >= $6
               AND s."status" NOT IN ('withdrawn', 'rejected', 'reversed')
             GROUP BY b."membership_id") AS "g")::int AS "buddy_repeat"`,
      [
        membershipId,
        submissionId,
        performedOn,
        window.windowFrom,
        window.windowTo,
        window.buddyFrom,
      ],
    );
    return this.toCounts(rows[0]);
  }

  private toCounts(row: AbuseCountsRow | undefined): AbuseCounts {
    return {
      sameDay: row?.same_day ?? 0,
      windowCount: row?.window_count ?? 0,
      buddyRepeat: row?.buddy_repeat ?? 0,
    };
  }

  async isReviewerCreditedBuddy(
    scope: TransactionScope,
    submissionId: string,
    reviewerUserId: string,
  ): Promise<boolean> {
    const rows = await scope.run<IdRow>(
      `SELECT b."id" FROM "activity_buddies" b
         JOIN "memberships" m ON m."id" = b."membership_id"
        WHERE b."submission_id" = $1 AND m."user_id" = $2
          AND m."deleted_at" IS NULL
        LIMIT 1`,
      [submissionId, reviewerUserId],
    );
    return rows.length > 0;
  }
}
