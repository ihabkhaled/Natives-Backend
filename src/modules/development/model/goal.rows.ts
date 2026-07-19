/** Raw `development_goals` row as returned by the database driver. */
export interface DevelopmentGoalRow {
  readonly id: string;
  readonly team_id: string;
  readonly season_id: string | null;
  readonly membership_id: string;
  readonly feedback_id: string | null;
  readonly metric_definition_id: string | null;
  readonly owner_user_id: string | null;
  readonly title: string;
  readonly description: string | null;
  readonly measurable_target: string | null;
  readonly target_value: string | null;
  readonly baseline_value: string | null;
  readonly progress_value: string | null;
  readonly progress_note: string | null;
  readonly evidence: string | null;
  readonly status: string;
  readonly due_date: string | null;
  readonly completed_at: string | Date | null;
  readonly review_note: string | null;
  readonly reviewed_at: string | Date | null;
  readonly reviewed_by: string | null;
  readonly record_version: number;
  readonly created_by: string | null;
  readonly created_at: string | Date;
  readonly updated_at: string | Date;
  readonly deleted_at: string | Date | null;
}

/** Raw `development_goal_actions` (action-plan step) row. */
export interface GoalActionRow {
  readonly id: string;
  readonly goal_id: string;
  readonly description: string;
  readonly sort_order: number;
  readonly done: boolean;
  readonly due_date: string | null;
  readonly created_at: string | Date;
}

/** A single overdue active goal row surfaced for reminders. */
export interface GoalReminderRow {
  readonly id: string;
  readonly team_id: string;
  readonly season_id: string | null;
  readonly membership_id: string;
  readonly reminder_user_id: string | null;
  readonly due_date: string | null;
}
