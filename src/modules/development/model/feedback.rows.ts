/** Raw `coach_feedback` row as returned by the database driver. */
export interface CoachFeedbackRow {
  readonly id: string;
  readonly family_id: string;
  readonly team_id: string;
  readonly season_id: string | null;
  readonly membership_id: string;
  readonly author_user_id: string;
  readonly status: string;
  readonly revision: number;
  readonly record_version: number;
  readonly positive_frisbee: string | null;
  readonly frisbee_improvement: string | null;
  readonly positive_mental: string | null;
  readonly mental_improvement: string | null;
  readonly team_role: string | null;
  readonly recommended_position: string | null;
  readonly summary: string | null;
  readonly coach_note: string | null;
  readonly submitted_at: string | Date | null;
  readonly submitted_by: string | null;
  readonly published_at: string | Date | null;
  readonly published_by: string | null;
  readonly superseded_at: string | Date | null;
  readonly superseded_by_id: string | null;
  readonly created_by: string | null;
  readonly created_at: string | Date;
  readonly updated_at: string | Date;
}

/**
 * The bounded team-list projection row: identifiers + workflow status only, with
 * no free-text field selected, so the private coach note is never even read.
 */
export interface CoachFeedbackSummaryRow {
  readonly id: string;
  readonly family_id: string;
  readonly team_id: string;
  readonly membership_id: string;
  readonly author_user_id: string;
  readonly status: string;
  readonly revision: number;
  readonly record_version: number;
  readonly created_at: string | Date;
  readonly published_at: string | Date | null;
}

/** Raw `feedback_acknowledgements` row. */
export interface FeedbackAcknowledgementRow {
  readonly id: string;
  readonly feedback_id: string;
  readonly membership_id: string;
  readonly user_id: string;
  readonly acknowledged_at: string | Date;
  readonly clarification_requested: boolean;
  readonly clarification_note: string | null;
  readonly created_at: string | Date;
}

/** A single unacknowledged published feedback row surfaced for reminders. */
export interface FeedbackReminderRow {
  readonly id: string;
  readonly team_id: string;
  readonly season_id: string | null;
  readonly membership_id: string;
  readonly reminder_user_id: string;
  readonly published_at: string | Date | null;
}
