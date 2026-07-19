import type { FeedbackStatus } from '../model/feedback.enums';
import { FEEDBACK_STATUS_VALUES } from '../model/feedback.enums';
import type {
  CoachFeedbackRow,
  CoachFeedbackSummaryRow,
  FeedbackAcknowledgementRow,
} from '../model/feedback.rows';
import type {
  CoachFeedback,
  FeedbackAcknowledgement,
  FeedbackSummary,
} from '../model/feedback.types';
import { parseEnumValue, toDate, toNullableDate } from './development.helpers';

export function toCoachFeedback(row: CoachFeedbackRow): CoachFeedback {
  return {
    id: row.id,
    familyId: row.family_id,
    teamId: row.team_id,
    seasonId: row.season_id,
    membershipId: row.membership_id,
    authorUserId: row.author_user_id,
    status: parseFeedbackStatus(row.status),
    revision: row.revision,
    recordVersion: row.record_version,
    positiveFrisbee: row.positive_frisbee,
    frisbeeImprovement: row.frisbee_improvement,
    positiveMental: row.positive_mental,
    mentalImprovement: row.mental_improvement,
    teamRole: row.team_role,
    recommendedPosition: row.recommended_position,
    summary: row.summary,
    coachNote: row.coach_note,
    submittedAt: toNullableDate(row.submitted_at),
    submittedBy: row.submitted_by,
    publishedAt: toNullableDate(row.published_at),
    publishedBy: row.published_by,
    supersededAt: toNullableDate(row.superseded_at),
    supersededById: row.superseded_by_id,
    createdBy: row.created_by,
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  };
}

export function toFeedbackSummary(
  row: CoachFeedbackSummaryRow,
): FeedbackSummary {
  return {
    id: row.id,
    familyId: row.family_id,
    teamId: row.team_id,
    membershipId: row.membership_id,
    authorUserId: row.author_user_id,
    status: parseFeedbackStatus(row.status),
    revision: row.revision,
    recordVersion: row.record_version,
    createdAt: toDate(row.created_at),
    publishedAt: toNullableDate(row.published_at),
  };
}

export function toFeedbackAcknowledgement(
  row: FeedbackAcknowledgementRow,
): FeedbackAcknowledgement {
  return {
    id: row.id,
    feedbackId: row.feedback_id,
    membershipId: row.membership_id,
    userId: row.user_id,
    acknowledgedAt: toDate(row.acknowledged_at),
    clarificationRequested: row.clarification_requested,
    clarificationNote: row.clarification_note,
  };
}

function parseFeedbackStatus(raw: string): FeedbackStatus {
  return parseEnumValue(FEEDBACK_STATUS_VALUES, raw, 'feedback status');
}
