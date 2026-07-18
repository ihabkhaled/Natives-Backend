import type { ErrorMessageKey } from '@core/errors/error.types';

export const PLAYER_ASSESSMENTS_ROUTE = 'teams/:teamId/player-assessments';
export const MY_ASSESSMENTS_ROUTE = 'teams/:teamId/my-assessments';
export const ASSESSMENT_ID_PARAM = 'assessmentId';
export const ASSESSMENT_DETAIL_ROUTE = ':assessmentId';
export const ASSESSMENT_VALUES_ROUTE = ':assessmentId/values';
export const ASSESSMENT_SUBMIT_ROUTE = ':assessmentId/submit';
export const ASSESSMENT_REVIEW_ROUTE = ':assessmentId/review';
export const ASSESSMENT_PUBLISH_ROUTE = ':assessmentId/publish';
export const ASSESSMENT_CORRECT_ROUTE = ':assessmentId/correct';
export const ASSESSMENT_REVISIONS_ROUTE = ':assessmentId/revisions';

export const SUMMARY_MAX_LENGTH = 4000;
export const NOTE_MAX_LENGTH = 2000;
export const REASON_MIN_LENGTH = 3;
export const REASON_MAX_LENGTH = 2000;
export const TEXT_VALUE_MAX_LENGTH = 2000;
export const METRIC_VALUES_MAX_ITEMS = 200;
export const CONFIDENCE_MIN = 0;
export const CONFIDENCE_MAX = 5;
export const OBSERVATION_MIN = 0;
export const OBSERVATION_MAX = 100_000;
export const NUMERIC_VALUE_MIN = -1_000_000;
export const NUMERIC_VALUE_MAX = 1_000_000;
export const RECORD_VERSION_MIN = 1;
export const FIRST_REVISION = 1;

export const PLAYER_ASSESSMENT_NOT_FOUND_MESSAGE =
  'The requested player assessment was not found';
export const PLAYER_ASSESSMENT_NOT_FOUND_MESSAGE_KEY: ErrorMessageKey =
  'errors.assessments.playerAssessmentNotFound';
export const ASSESSMENT_INVALID_TRANSITION_MESSAGE =
  'The player assessment cannot make this workflow transition';
export const ASSESSMENT_INVALID_TRANSITION_MESSAGE_KEY: ErrorMessageKey =
  'errors.assessments.invalidTransition';
export const ASSESSMENT_INCOMPLETE_MESSAGE =
  'The assessment is missing required metric values';
export const ASSESSMENT_INCOMPLETE_MESSAGE_KEY: ErrorMessageKey =
  'errors.assessments.incomplete';
export const ASSESSMENT_SELF_APPROVAL_MESSAGE =
  'An evaluator may not review or approve their own assessment';
export const ASSESSMENT_SELF_APPROVAL_MESSAGE_KEY: ErrorMessageKey =
  'errors.assessments.selfApprovalForbidden';

export const PLAYER_ASSESSMENT_RESOURCE_TYPE = 'player_assessment';
export const PLAYER_ASSESSMENT_AGGREGATE = 'player_assessment';
export const PLAYER_ASSESSMENT_CREATED_ACTION = 'assessment.player.created';
export const PLAYER_ASSESSMENT_UPDATED_ACTION = 'assessment.player.updated';
export const PLAYER_ASSESSMENT_SUBMITTED_ACTION = 'assessment.player.submitted';
export const PLAYER_ASSESSMENT_REVIEWED_ACTION = 'assessment.player.reviewed';
export const PLAYER_ASSESSMENT_PUBLISHED_ACTION = 'assessment.player.published';
export const PLAYER_ASSESSMENT_REVISED_ACTION = 'assessment.player.revised';

export const PLAYER_ASSESSMENT_EVENT_VERSION = 1;
export const ASSESSMENT_SUBMITTED_EVENT = 'assessment.submitted.v1';
export const ASSESSMENT_PUBLISHED_EVENT = 'assessment.published.v1';
export const ASSESSMENT_REVISED_EVENT = 'assessment.revised.v1';

export const PLAYER_ASSESSMENT_COLUMNS = `"id", "family_id", "team_id",
  "season_id", "period_id", "template_id", "membership_id",
  "evaluator_user_id", "status", "revision", "summary", "record_version",
  "submitted_at", "submitted_by", "reviewed_at", "reviewed_by", "published_at",
  "published_by", "superseded_at", "superseded_by_id", "created_by",
  "created_at", "updated_at"`;

export const PLAYER_ASSESSMENT_VALUE_COLUMNS = `"id", "assessment_id",
  "metric_definition_id", "numeric_value", "text_value", "note", "confidence",
  "observation_count", "created_at"`;
