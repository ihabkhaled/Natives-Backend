import type { GoalStatus } from '../model/goal.enums';
import { GOAL_STATUS_VALUES } from '../model/goal.enums';
import type { DevelopmentGoalRow, GoalActionRow } from '../model/goal.rows';
import type { DevelopmentGoal, GoalAction } from '../model/goal.types';
import {
  parseEnumValue,
  toDate,
  toNullableDate,
  toNullableNumber,
} from './development.helpers';

export function toDevelopmentGoal(row: DevelopmentGoalRow): DevelopmentGoal {
  return {
    id: row.id,
    teamId: row.team_id,
    seasonId: row.season_id,
    membershipId: row.membership_id,
    feedbackId: row.feedback_id,
    metricDefinitionId: row.metric_definition_id,
    ownerUserId: row.owner_user_id,
    title: row.title,
    description: row.description,
    measurableTarget: row.measurable_target,
    targetValue: toNullableNumber(row.target_value),
    baselineValue: toNullableNumber(row.baseline_value),
    progressValue: toNullableNumber(row.progress_value),
    progressNote: row.progress_note,
    evidence: row.evidence,
    status: parseGoalStatus(row.status),
    dueDate: row.due_date,
    completedAt: toNullableDate(row.completed_at),
    reviewNote: row.review_note,
    reviewedAt: toNullableDate(row.reviewed_at),
    reviewedBy: row.reviewed_by,
    recordVersion: row.record_version,
    createdBy: row.created_by,
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  };
}

export function toGoalAction(row: GoalActionRow): GoalAction {
  return {
    description: row.description,
    sortOrder: row.sort_order,
    done: row.done,
    dueDate: row.due_date,
  };
}

function parseGoalStatus(raw: string): GoalStatus {
  return parseEnumValue(GOAL_STATUS_VALUES, raw, 'goal status');
}
