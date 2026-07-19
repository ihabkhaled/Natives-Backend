import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import {
  toCoachFeedback,
  toFeedbackAcknowledgement,
  toFeedbackSummary,
} from '../lib/feedback.mapper';
import {
  COACH_FEEDBACK_COLUMNS,
  COACH_FEEDBACK_SUMMARY_COLUMNS,
  FEEDBACK_ACKNOWLEDGEMENT_COLUMNS,
  REMINDER_SCAN_MAX,
} from '../model/development.constants';
import type { CountRow } from '../model/development.rows';
import type { PageRequest } from '../model/development.types';
import type {
  CoachFeedbackRow,
  CoachFeedbackSummaryRow,
  FeedbackAcknowledgementRow,
  FeedbackReminderRow,
} from '../model/feedback.rows';
import type {
  CoachFeedback,
  FeedbackAcknowledgement,
  FeedbackSummary,
  FeedbackSupersede,
  FeedbackTransition,
  NewCoachFeedback,
  NewFeedbackAcknowledgement,
  OwnFeedbackResult,
} from '../model/feedback.types';

/**
 * Persistence for the coach-feedback aggregate, its player acknowledgement, and
 * the reminder scan. Data access only: parameterized SQL through the caller's
 * transaction scope, static column lists, optimistic-version-guarded transitions,
 * and bounded/ordered reads. The private coach note is never SELECTed by the
 * broad team list or the reminder scan; published rows are never mutated in place
 * — corrections supersede and insert a new revision.
 */
@Injectable()
export class CoachFeedbackRepository {
  async insertFeedback(
    scope: TransactionScope,
    feedback: NewCoachFeedback,
  ): Promise<CoachFeedback> {
    const rows = await scope.run<CoachFeedbackRow>(
      `INSERT INTO "coach_feedback"
        ("id", "family_id", "team_id", "season_id", "membership_id",
         "author_user_id", "status", "revision", "positive_frisbee",
         "frisbee_improvement", "positive_mental", "mental_improvement",
         "team_role", "recommended_position", "summary", "coach_note",
         "submitted_at", "submitted_by", "published_at", "published_by",
         "created_by", "created_at", "updated_at")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
               $15, $16, $17, $18, $19, $20, $21, $22, $22)
       RETURNING ${COACH_FEEDBACK_COLUMNS}`,
      this.insertParameters(feedback),
    );
    return toCoachFeedback(this.requireRow(rows));
  }

  async findForWrite(
    scope: TransactionScope,
    teamId: string,
    feedbackId: string,
  ): Promise<CoachFeedback | null> {
    const rows = await scope.run<CoachFeedbackRow>(
      `SELECT ${COACH_FEEDBACK_COLUMNS} FROM "coach_feedback"
        WHERE "id" = $1 AND "team_id" = $2`,
      [feedbackId, teamId],
    );
    const row = rows[0];
    return row === undefined ? null : toCoachFeedback(row);
  }

  async updateDraftFields(
    scope: TransactionScope,
    feedback: NewCoachFeedback,
    feedbackId: string,
    expectedRecordVersion: number,
  ): Promise<CoachFeedback | null> {
    const rows = await scope.run<CoachFeedbackRow>(
      `UPDATE "coach_feedback"
          SET "positive_frisbee" = $4, "frisbee_improvement" = $5,
              "positive_mental" = $6, "mental_improvement" = $7,
              "team_role" = $8, "recommended_position" = $9, "summary" = $10,
              "coach_note" = $11, "updated_at" = $12,
              "record_version" = "record_version" + 1
        WHERE "id" = $1 AND "team_id" = $2 AND "status" = 'draft'
          AND "record_version" = $3 AND "superseded_at" IS NULL
       RETURNING ${COACH_FEEDBACK_COLUMNS}`,
      this.updateParameters(feedback, feedbackId, expectedRecordVersion),
    );
    const row = rows[0];
    return row === undefined ? null : toCoachFeedback(row);
  }

  async applyTransition(
    scope: TransactionScope,
    transition: FeedbackTransition,
  ): Promise<CoachFeedback | null> {
    const rows = await scope.run<CoachFeedbackRow>(
      `UPDATE "coach_feedback"
          SET "status" = $3, "updated_at" = $4,
              "record_version" = "record_version" + 1,
              "submitted_at" = COALESCE($5, "submitted_at"),
              "submitted_by" = COALESCE($6, "submitted_by"),
              "published_at" = COALESCE($7, "published_at"),
              "published_by" = COALESCE($8, "published_by")
        WHERE "id" = $1 AND "team_id" = $2 AND "record_version" = $9
          AND "superseded_at" IS NULL
       RETURNING ${COACH_FEEDBACK_COLUMNS}`,
      this.transitionParameters(transition),
    );
    const row = rows[0];
    return row === undefined ? null : toCoachFeedback(row);
  }

  async supersede(
    scope: TransactionScope,
    supersede: FeedbackSupersede,
  ): Promise<boolean> {
    const rows = await scope.run<CoachFeedbackRow>(
      `UPDATE "coach_feedback"
          SET "superseded_at" = $3, "superseded_by_id" = $2, "updated_at" = $3
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
  ): Promise<readonly FeedbackSummary[]> {
    const rows = await scope.run<CoachFeedbackSummaryRow>(
      `SELECT ${COACH_FEEDBACK_SUMMARY_COLUMNS} FROM "coach_feedback"
        WHERE "team_id" = $1
        ORDER BY "created_at" DESC, "id" ASC
        LIMIT $2 OFFSET $3`,
      [teamId, page.limit, page.offset],
    );
    return rows.map(row => toFeedbackSummary(row));
  }

  async countForTeam(scope: TransactionScope, teamId: string): Promise<number> {
    const rows = await scope.run<CountRow>(
      `SELECT COUNT(*)::int AS "count" FROM "coach_feedback"
        WHERE "team_id" = $1`,
      [teamId],
    );
    return rows[0]?.count ?? 0;
  }

  async listRevisions(
    scope: TransactionScope,
    teamId: string,
    familyId: string,
  ): Promise<readonly FeedbackSummary[]> {
    const rows = await scope.run<CoachFeedbackSummaryRow>(
      `SELECT ${COACH_FEEDBACK_SUMMARY_COLUMNS} FROM "coach_feedback"
        WHERE "team_id" = $1 AND "family_id" = $2
        ORDER BY "revision" ASC, "id" ASC`,
      [teamId, familyId],
    );
    return rows.map(row => toFeedbackSummary(row));
  }

  async listOwnShared(
    scope: TransactionScope,
    teamId: string,
    userId: string,
    page: PageRequest,
  ): Promise<OwnFeedbackResult> {
    const rows = await scope.run<CoachFeedbackRow>(
      `SELECT ${this.qualified()} FROM "coach_feedback" cf
         JOIN "memberships" m ON m."id" = cf."membership_id"
        WHERE cf."team_id" = $1 AND m."user_id" = $2
          AND cf."status" IN ('published', 'revised')
          AND cf."superseded_at" IS NULL
        ORDER BY cf."published_at" DESC, cf."id" ASC
        LIMIT $3 OFFSET $4`,
      [teamId, userId, page.limit, page.offset],
    );
    const feedback = rows.map(row => toCoachFeedback(row));
    return this.assembleOwn(scope, teamId, userId, feedback);
  }

  async findOwnedShared(
    scope: TransactionScope,
    teamId: string,
    feedbackId: string,
    userId: string,
  ): Promise<CoachFeedback | null> {
    const rows = await scope.run<CoachFeedbackRow>(
      `SELECT ${this.qualified()} FROM "coach_feedback" cf
         JOIN "memberships" m ON m."id" = cf."membership_id"
        WHERE cf."id" = $1 AND cf."team_id" = $2 AND m."user_id" = $3
          AND cf."status" IN ('published', 'revised')
          AND cf."superseded_at" IS NULL`,
      [feedbackId, teamId, userId],
    );
    const row = rows[0];
    return row === undefined ? null : toCoachFeedback(row);
  }

  async insertAcknowledgement(
    scope: TransactionScope,
    acknowledgement: NewFeedbackAcknowledgement,
  ): Promise<FeedbackAcknowledgement> {
    const rows = await scope.run<FeedbackAcknowledgementRow>(
      `INSERT INTO "feedback_acknowledgements"
        ("id", "feedback_id", "membership_id", "user_id", "acknowledged_at",
         "clarification_requested", "clarification_note", "created_at")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $5)
       RETURNING ${FEEDBACK_ACKNOWLEDGEMENT_COLUMNS}`,
      this.acknowledgementParameters(acknowledgement),
    );
    return toFeedbackAcknowledgement(this.requireAck(rows));
  }

  async findAcknowledgement(
    scope: TransactionScope,
    feedbackId: string,
  ): Promise<FeedbackAcknowledgement | null> {
    const rows = await scope.run<FeedbackAcknowledgementRow>(
      `SELECT ${FEEDBACK_ACKNOWLEDGEMENT_COLUMNS}
         FROM "feedback_acknowledgements" WHERE "feedback_id" = $1`,
      [feedbackId],
    );
    const row = rows[0];
    return row === undefined ? null : toFeedbackAcknowledgement(row);
  }

  async listReminders(
    scope: TransactionScope,
    teamId: string,
  ): Promise<readonly FeedbackReminderRow[]> {
    return scope.run<FeedbackReminderRow>(
      `SELECT cf."id", cf."team_id", cf."season_id", cf."membership_id",
              m."user_id" AS "reminder_user_id", cf."published_at"
         FROM "coach_feedback" cf
         JOIN "memberships" m ON m."id" = cf."membership_id"
    LEFT JOIN "feedback_acknowledgements" a ON a."feedback_id" = cf."id"
        WHERE cf."team_id" = $1
          AND cf."status" IN ('published', 'revised')
          AND cf."superseded_at" IS NULL AND a."id" IS NULL
        ORDER BY cf."published_at" ASC, cf."id" ASC
        LIMIT $2`,
      [teamId, REMINDER_SCAN_MAX],
    );
  }

  private async assembleOwn(
    scope: TransactionScope,
    teamId: string,
    userId: string,
    feedback: readonly CoachFeedback[],
  ): Promise<OwnFeedbackResult> {
    const acknowledgements = await this.acknowledgementsFor(
      scope,
      feedback.map(item => item.id),
    );
    const total = await this.countOwnShared(scope, teamId, userId);
    return { feedback, acknowledgements, total };
  }

  private async acknowledgementsFor(
    scope: TransactionScope,
    feedbackIds: readonly string[],
  ): Promise<ReadonlyMap<string, FeedbackAcknowledgement>> {
    const map = new Map<string, FeedbackAcknowledgement>();
    if (feedbackIds.length === 0) {
      return map;
    }
    const rows = await scope.run<FeedbackAcknowledgementRow>(
      `SELECT ${FEEDBACK_ACKNOWLEDGEMENT_COLUMNS}
         FROM "feedback_acknowledgements"
        WHERE "feedback_id" = ANY($1::uuid[])`,
      [feedbackIds],
    );
    for (const row of rows) {
      map.set(row.feedback_id, toFeedbackAcknowledgement(row));
    }
    return map;
  }

  private async countOwnShared(
    scope: TransactionScope,
    teamId: string,
    userId: string,
  ): Promise<number> {
    const rows = await scope.run<CountRow>(
      `SELECT COUNT(*)::int AS "count" FROM "coach_feedback" cf
         JOIN "memberships" m ON m."id" = cf."membership_id"
        WHERE cf."team_id" = $1 AND m."user_id" = $2
          AND cf."status" IN ('published', 'revised')
          AND cf."superseded_at" IS NULL`,
      [teamId, userId],
    );
    return rows[0]?.count ?? 0;
  }

  private qualified(): string {
    return COACH_FEEDBACK_COLUMNS.split(',')
      .map(column => `cf.${column.trim()}`)
      .join(', ');
  }

  private insertParameters(feedback: NewCoachFeedback): readonly unknown[] {
    return [
      feedback.id,
      feedback.familyId,
      feedback.teamId,
      feedback.seasonId,
      feedback.membershipId,
      feedback.authorUserId,
      feedback.status,
      feedback.revision,
      feedback.fields.positiveFrisbee,
      feedback.fields.frisbeeImprovement,
      feedback.fields.positiveMental,
      feedback.fields.mentalImprovement,
      feedback.fields.teamRole,
      feedback.fields.recommendedPosition,
      feedback.fields.summary,
      feedback.fields.coachNote,
      feedback.submittedAt === null ? null : feedback.submittedAt.toISOString(),
      feedback.submittedBy,
      feedback.publishedAt === null ? null : feedback.publishedAt.toISOString(),
      feedback.publishedBy,
      feedback.createdBy,
      feedback.now.toISOString(),
    ];
  }

  private updateParameters(
    feedback: NewCoachFeedback,
    feedbackId: string,
    expectedRecordVersion: number,
  ): readonly unknown[] {
    return [
      feedbackId,
      feedback.teamId,
      expectedRecordVersion,
      feedback.fields.positiveFrisbee,
      feedback.fields.frisbeeImprovement,
      feedback.fields.positiveMental,
      feedback.fields.mentalImprovement,
      feedback.fields.teamRole,
      feedback.fields.recommendedPosition,
      feedback.fields.summary,
      feedback.fields.coachNote,
      feedback.now.toISOString(),
    ];
  }

  private transitionParameters(
    transition: FeedbackTransition,
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
      transition.publishedAt === null
        ? null
        : transition.publishedAt.toISOString(),
      transition.publishedBy,
      transition.expectedRecordVersion,
    ];
  }

  private acknowledgementParameters(
    acknowledgement: NewFeedbackAcknowledgement,
  ): readonly unknown[] {
    return [
      acknowledgement.id,
      acknowledgement.feedbackId,
      acknowledgement.membershipId,
      acknowledgement.userId,
      acknowledgement.now.toISOString(),
      acknowledgement.clarificationRequested,
      acknowledgement.clarificationNote,
    ];
  }

  private requireRow(rows: readonly CoachFeedbackRow[]): CoachFeedbackRow {
    const row = rows[0];
    if (row === undefined) {
      throw new Error('Expected a returned row from the coach feedback write');
    }
    return row;
  }

  private requireAck(
    rows: readonly FeedbackAcknowledgementRow[],
  ): FeedbackAcknowledgementRow {
    const row = rows[0];
    if (row === undefined) {
      throw new Error('Expected a returned row from the acknowledgement write');
    }
    return row;
  }
}
