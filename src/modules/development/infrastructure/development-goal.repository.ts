import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { toDevelopmentGoal, toGoalAction } from '../lib/goal.mapper';
import {
  DEVELOPMENT_GOAL_COLUMNS,
  GOAL_ACTION_COLUMNS,
  REMINDER_SCAN_MAX,
} from '../model/development.constants';
import type { CountRow } from '../model/development.rows';
import type { PageRequest } from '../model/development.types';
import type {
  DevelopmentGoalRow,
  GoalActionRow,
  GoalReminderRow,
} from '../model/goal.rows';
import type {
  DevelopmentGoal,
  GoalAction,
  GoalContentUpdate,
  GoalReview,
  GoalStatusChange,
  NewDevelopmentGoal,
  NewGoalAction,
} from '../model/goal.types';

/**
 * Persistence for the development-goal aggregate and its action-plan steps. Data
 * access only: parameterized SQL through the caller's transaction scope, static
 * column lists, optimistic-version-guarded writes, soft-delete-aware and
 * bounded/ordered reads. Numeric fields store NULL when not measured
 * (null-not-zero). Action steps are a replace-all child collection.
 */
@Injectable()
export class DevelopmentGoalRepository {
  async insertGoal(
    scope: TransactionScope,
    goal: NewDevelopmentGoal,
  ): Promise<DevelopmentGoal> {
    const rows = await scope.run<DevelopmentGoalRow>(
      `INSERT INTO "development_goals"
        ("id", "team_id", "season_id", "membership_id", "feedback_id",
         "metric_definition_id", "owner_user_id", "title", "description",
         "measurable_target", "target_value", "baseline_value",
         "progress_value", "progress_note", "evidence", "status", "due_date",
         "created_by", "created_at", "updated_at")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
               $15, $16, $17, $18, $19, $19)
       RETURNING ${DEVELOPMENT_GOAL_COLUMNS}`,
      this.insertParameters(goal),
    );
    return toDevelopmentGoal(this.requireRow(rows));
  }

  async insertActions(
    scope: TransactionScope,
    actions: readonly NewGoalAction[],
  ): Promise<void> {
    if (actions.length === 0) {
      return;
    }
    await scope.run(
      `INSERT INTO "development_goal_actions"
        ("id", "goal_id", "description", "sort_order", "done", "due_date",
         "created_at")
       SELECT input."id", input."goal_id", input."description",
              input."sort_order", input."done", input."due_date",
              input."created_at"
         FROM jsonb_to_recordset($1::jsonb) AS input(
           "id" uuid, "goal_id" uuid, "description" text, "sort_order" integer,
           "done" boolean, "due_date" date, "created_at" timestamptz)`,
      [JSON.stringify(actions.map(action => this.actionRecord(action)))],
    );
  }

  async clearActions(scope: TransactionScope, goalId: string): Promise<void> {
    await scope.run(
      `DELETE FROM "development_goal_actions" WHERE "goal_id" = $1`,
      [goalId],
    );
  }

  async findForWrite(
    scope: TransactionScope,
    teamId: string,
    goalId: string,
  ): Promise<DevelopmentGoal | null> {
    const rows = await scope.run<DevelopmentGoalRow>(
      `SELECT ${DEVELOPMENT_GOAL_COLUMNS} FROM "development_goals"
        WHERE "id" = $1 AND "team_id" = $2 AND "deleted_at" IS NULL`,
      [goalId, teamId],
    );
    const row = rows[0];
    return row === undefined ? null : toDevelopmentGoal(row);
  }

  async findActions(
    scope: TransactionScope,
    goalId: string,
  ): Promise<readonly GoalAction[]> {
    const rows = await scope.run<GoalActionRow>(
      `SELECT ${GOAL_ACTION_COLUMNS} FROM "development_goal_actions"
        WHERE "goal_id" = $1
        ORDER BY "sort_order" ASC, "id" ASC`,
      [goalId],
    );
    return rows.map(row => toGoalAction(row));
  }

  async updateContent(
    scope: TransactionScope,
    update: GoalContentUpdate,
  ): Promise<DevelopmentGoal | null> {
    const rows = await scope.run<DevelopmentGoalRow>(
      `UPDATE "development_goals"
          SET "feedback_id" = $4, "metric_definition_id" = $5,
              "owner_user_id" = $6, "title" = $7, "description" = $8,
              "measurable_target" = $9, "target_value" = $10,
              "baseline_value" = $11, "progress_value" = $12,
              "progress_note" = $13, "evidence" = $14, "due_date" = $15,
              "updated_at" = $16, "record_version" = "record_version" + 1
        WHERE "id" = $1 AND "team_id" = $2 AND "record_version" = $3
          AND "deleted_at" IS NULL
       RETURNING ${DEVELOPMENT_GOAL_COLUMNS}`,
      this.updateParameters(update),
    );
    const row = rows[0];
    return row === undefined ? null : toDevelopmentGoal(row);
  }

  async applyReview(
    scope: TransactionScope,
    review: GoalReview,
  ): Promise<DevelopmentGoal | null> {
    const rows = await scope.run<DevelopmentGoalRow>(
      `UPDATE "development_goals"
          SET "review_note" = $4, "progress_value" = $5, "progress_note" = $6,
              "evidence" = $7, "reviewed_at" = $9, "reviewed_by" = $8,
              "updated_at" = $9, "record_version" = "record_version" + 1
        WHERE "id" = $1 AND "team_id" = $2 AND "record_version" = $3
          AND "deleted_at" IS NULL
       RETURNING ${DEVELOPMENT_GOAL_COLUMNS}`,
      this.reviewParameters(review),
    );
    const row = rows[0];
    return row === undefined ? null : toDevelopmentGoal(row);
  }

  async applyStatusChange(
    scope: TransactionScope,
    change: GoalStatusChange,
  ): Promise<DevelopmentGoal | null> {
    const rows = await scope.run<DevelopmentGoalRow>(
      `UPDATE "development_goals"
          SET "status" = $4, "completed_at" = $5, "updated_at" = $6,
              "record_version" = "record_version" + 1
        WHERE "id" = $1 AND "team_id" = $2 AND "record_version" = $3
          AND "deleted_at" IS NULL
       RETURNING ${DEVELOPMENT_GOAL_COLUMNS}`,
      this.statusParameters(change),
    );
    const row = rows[0];
    return row === undefined ? null : toDevelopmentGoal(row);
  }

  async listForTeam(
    scope: TransactionScope,
    teamId: string,
    page: PageRequest,
  ): Promise<readonly DevelopmentGoal[]> {
    const rows = await scope.run<DevelopmentGoalRow>(
      `SELECT ${DEVELOPMENT_GOAL_COLUMNS} FROM "development_goals"
        WHERE "team_id" = $1 AND "deleted_at" IS NULL
        ORDER BY "created_at" DESC, "id" ASC
        LIMIT $2 OFFSET $3`,
      [teamId, page.limit, page.offset],
    );
    return rows.map(row => toDevelopmentGoal(row));
  }

  async countForTeam(scope: TransactionScope, teamId: string): Promise<number> {
    const rows = await scope.run<CountRow>(
      `SELECT COUNT(*)::int AS "count" FROM "development_goals"
        WHERE "team_id" = $1 AND "deleted_at" IS NULL`,
      [teamId],
    );
    return rows[0]?.count ?? 0;
  }

  async listForMember(
    scope: TransactionScope,
    teamId: string,
    userId: string,
    page: PageRequest,
  ): Promise<readonly DevelopmentGoal[]> {
    const rows = await scope.run<DevelopmentGoalRow>(
      `SELECT ${this.qualified()} FROM "development_goals" g
         JOIN "memberships" m ON m."id" = g."membership_id"
        WHERE g."team_id" = $1 AND m."user_id" = $2 AND g."deleted_at" IS NULL
        ORDER BY g."created_at" DESC, g."id" ASC
        LIMIT $3 OFFSET $4`,
      [teamId, userId, page.limit, page.offset],
    );
    return rows.map(row => toDevelopmentGoal(row));
  }

  async countForMember(
    scope: TransactionScope,
    teamId: string,
    userId: string,
  ): Promise<number> {
    const rows = await scope.run<CountRow>(
      `SELECT COUNT(*)::int AS "count" FROM "development_goals" g
         JOIN "memberships" m ON m."id" = g."membership_id"
        WHERE g."team_id" = $1 AND m."user_id" = $2 AND g."deleted_at" IS NULL`,
      [teamId, userId],
    );
    return rows[0]?.count ?? 0;
  }

  async actionsByGoal(
    scope: TransactionScope,
    goalIds: readonly string[],
  ): Promise<ReadonlyMap<string, readonly GoalAction[]>> {
    const grouped = new Map<string, GoalAction[]>();
    if (goalIds.length === 0) {
      return grouped;
    }
    const rows = await scope.run<GoalActionRow>(
      `SELECT ${GOAL_ACTION_COLUMNS} FROM "development_goal_actions"
        WHERE "goal_id" = ANY($1::uuid[])
        ORDER BY "goal_id" ASC, "sort_order" ASC, "id" ASC`,
      [goalIds],
    );
    for (const row of rows) {
      const bucket = grouped.get(row.goal_id) ?? [];
      bucket.push(toGoalAction(row));
      grouped.set(row.goal_id, bucket);
    }
    return grouped;
  }

  async listOverdue(
    scope: TransactionScope,
    teamId: string,
    today: string,
  ): Promise<readonly GoalReminderRow[]> {
    return scope.run<GoalReminderRow>(
      `SELECT g."id", g."team_id", g."season_id", g."membership_id",
              g."owner_user_id" AS "reminder_user_id", g."due_date"
         FROM "development_goals" g
        WHERE g."team_id" = $1 AND g."deleted_at" IS NULL
          AND g."status" = 'active' AND g."due_date" IS NOT NULL
          AND g."due_date" < $2
        ORDER BY g."due_date" ASC, g."id" ASC
        LIMIT $3`,
      [teamId, today, REMINDER_SCAN_MAX],
    );
  }

  private qualified(): string {
    return DEVELOPMENT_GOAL_COLUMNS.split(',')
      .map(column => `g.${column.trim()}`)
      .join(', ');
  }

  private insertParameters(goal: NewDevelopmentGoal): readonly unknown[] {
    return [
      goal.id,
      goal.teamId,
      goal.seasonId,
      goal.membershipId,
      goal.content.feedbackId,
      goal.content.metricDefinitionId,
      goal.content.ownerUserId,
      goal.content.title,
      goal.content.description,
      goal.content.measurableTarget,
      goal.content.targetValue,
      goal.content.baselineValue,
      goal.content.progressValue,
      goal.content.progressNote,
      goal.content.evidence,
      goal.status,
      goal.content.dueDate,
      goal.createdBy,
      goal.now.toISOString(),
    ];
  }

  private updateParameters(update: GoalContentUpdate): readonly unknown[] {
    return [
      update.id,
      update.teamId,
      update.expectedRecordVersion,
      update.content.feedbackId,
      update.content.metricDefinitionId,
      update.content.ownerUserId,
      update.content.title,
      update.content.description,
      update.content.measurableTarget,
      update.content.targetValue,
      update.content.baselineValue,
      update.content.progressValue,
      update.content.progressNote,
      update.content.evidence,
      update.content.dueDate,
      update.now.toISOString(),
    ];
  }

  private reviewParameters(review: GoalReview): readonly unknown[] {
    return [
      review.id,
      review.teamId,
      review.expectedRecordVersion,
      review.reviewNote,
      review.progressValue,
      review.progressNote,
      review.evidence,
      review.reviewedBy,
      review.now.toISOString(),
    ];
  }

  private statusParameters(change: GoalStatusChange): readonly unknown[] {
    return [
      change.id,
      change.teamId,
      change.expectedRecordVersion,
      change.toStatus,
      change.completedAt === null ? null : change.completedAt.toISOString(),
      change.now.toISOString(),
    ];
  }

  private actionRecord(
    action: NewGoalAction,
  ): Readonly<Record<string, unknown>> {
    return {
      id: action.id,
      goal_id: action.goalId,
      description: action.description,
      sort_order: action.sortOrder,
      done: action.done,
      due_date: action.dueDate,
      created_at: action.now.toISOString(),
    };
  }

  private requireRow(rows: readonly DevelopmentGoalRow[]): DevelopmentGoalRow {
    const row = rows[0];
    if (row === undefined) {
      throw new Error(
        'Expected a returned row from the development goal write',
      );
    }
    return row;
  }
}
