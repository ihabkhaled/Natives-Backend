import type { ErrorMessageKey } from '@core/errors/error.types';

// --- API surface -------------------------------------------------------------

export const GOVERNANCE_API_TAG = 'governance';
export const RULES_ROUTE = 'teams/:teamId/rules';
export const DISCIPLINE_ROUTE = 'teams/:teamId/discipline-cases';
export const POSITIONS_ROUTE = 'teams/:teamId/governance/positions';
export const MEETINGS_ROUTE = 'teams/:teamId/governance/meetings';
export const TASKS_ROUTE = 'teams/:teamId/governance/tasks';

export const TEAM_ID_PARAM = 'teamId';
export const RULE_ID_PARAM = 'ruleId';
export const CASE_ID_PARAM = 'caseId';
export const POSITION_ID_PARAM = 'positionId';
export const MEETING_ID_PARAM = 'meetingId';
export const TASK_ID_PARAM = 'taskId';

export const RULE_ITEM_ROUTE = ':ruleId';
export const RULE_ACK_ROUTE = ':ruleId/acknowledgement';
export const CASE_ITEM_ROUTE = ':caseId';
export const CASE_TRANSITION_ROUTE = ':caseId/transition';
export const POSITION_ITEM_ROUTE = ':positionId';
export const POSITION_APPOINTMENT_ROUTE = ':positionId/appointment';
export const MEETING_ITEM_ROUTE = ':meetingId';
export const MEETING_TRANSITION_ROUTE = ':meetingId/transition';
export const TASK_ITEM_ROUTE = ':taskId';
export const TASK_TRANSITION_ROUTE = ':taskId/transition';

// --- Pagination --------------------------------------------------------------

export const LIST_DEFAULT_LIMIT = 20;
export const LIST_MAX_LIMIT = 100;
export const LIST_MIN_LIMIT = 1;
export const LIST_DEFAULT_OFFSET = 0;

// --- Field bounds ------------------------------------------------------------

export const TITLE_MIN_LENGTH = 2;
export const TITLE_MAX_LENGTH = 200;
export const BODY_MIN_LENGTH = 2;
export const BODY_MAX_LENGTH = 20_000;
export const TEXT_MAX_LENGTH = 5000;
export const REFERENCE_MAX_LENGTH = 400;
export const KEY_MIN_LENGTH = 2;
export const KEY_MAX_LENGTH = 60;
export const REASON_MIN_LENGTH = 3;
export const REASON_MAX_LENGTH = 2000;
export const RECORD_VERSION_MIN = 1;
export const DECISIONS_MAX = 40;
export const DECISION_TEXT_MAX_LENGTH = 500;

/** Discipline cases carry a long, configurable retention window by default. */
export const DISCIPLINE_RETENTION_DAYS_DEFAULT = 1095;
export const MILLISECONDS_PER_DAY = 86_400_000;

export const FIRST_RULE_VERSION = 1;

/** The legacy below-70%-attendance concern is an eligibility SIGNAL, not punishment. */
export const ATTENDANCE_ELIGIBILITY_THRESHOLD = 0.7;

// --- Seeded governance titles (configurable, permission-free) ----------------

export const GOVERNANCE_TITLE_SEEDS: readonly {
  readonly key: string;
  readonly title: string;
}[] = [
  { key: 'team_captain', title: 'Team Captain' },
  { key: 'team_coach', title: 'Team Coach' },
  { key: 'board_member', title: 'Board Member' },
  { key: 'finance_manager', title: 'Finance Manager' },
  { key: 'social_media_manager', title: 'Social Media Manager' },
  { key: 'spirit_captain', title: 'Spirit Captain' },
];

// --- Error messages ----------------------------------------------------------

export const RULE_NOT_FOUND_MESSAGE = 'The requested rule was not found';
export const RULE_NOT_FOUND_MESSAGE_KEY: ErrorMessageKey =
  'errors.governance.ruleNotFound';
export const CASE_NOT_FOUND_MESSAGE =
  'The requested discipline case was not found';
export const CASE_NOT_FOUND_MESSAGE_KEY: ErrorMessageKey =
  'errors.governance.caseNotFound';
export const POSITION_NOT_FOUND_MESSAGE =
  'The requested governance position was not found';
export const POSITION_NOT_FOUND_MESSAGE_KEY: ErrorMessageKey =
  'errors.governance.positionNotFound';
export const MEETING_NOT_FOUND_MESSAGE =
  'The requested governance meeting was not found';
export const MEETING_NOT_FOUND_MESSAGE_KEY: ErrorMessageKey =
  'errors.governance.meetingNotFound';
export const TASK_NOT_FOUND_MESSAGE =
  'The requested governance task was not found';
export const TASK_NOT_FOUND_MESSAGE_KEY: ErrorMessageKey =
  'errors.governance.taskNotFound';
export const GOVERNANCE_SCOPE_NOT_FOUND_MESSAGE =
  'The team or member scope was not found';
export const GOVERNANCE_SCOPE_NOT_FOUND_MESSAGE_KEY: ErrorMessageKey =
  'errors.governance.scopeNotFound';
export const GOVERNANCE_VALIDATION_MESSAGE =
  'The governance request failed a domain validation rule';
export const GOVERNANCE_VALIDATION_MESSAGE_KEY: ErrorMessageKey =
  'errors.governance.validation';
export const GOVERNANCE_INVALID_TRANSITION_MESSAGE =
  'The record cannot make this lifecycle transition';
export const GOVERNANCE_INVALID_TRANSITION_MESSAGE_KEY: ErrorMessageKey =
  'errors.governance.invalidTransition';
export const GOVERNANCE_VERSION_CONFLICT_MESSAGE =
  'The record was modified concurrently';
export const GOVERNANCE_VERSION_CONFLICT_MESSAGE_KEY: ErrorMessageKey =
  'errors.governance.versionConflict';
export const SEPARATION_OF_DUTIES_MESSAGE =
  'The reviewer of a discipline case cannot be the person who opened it';
export const SEPARATION_OF_DUTIES_MESSAGE_KEY: ErrorMessageKey =
  'errors.governance.separationOfDuties';
export const DISCIPLINE_FORBIDDEN_MESSAGE =
  'You are not permitted to read this discipline case';
export const DISCIPLINE_FORBIDDEN_MESSAGE_KEY: ErrorMessageKey =
  'errors.governance.disciplineForbidden';

// --- Audit actions / resources ----------------------------------------------

export const RULE_RESOURCE_TYPE = 'team_rule';
export const DISCIPLINE_RESOURCE_TYPE = 'discipline_case';
export const POSITION_RESOURCE_TYPE = 'governance_position';
export const APPOINTMENT_RESOURCE_TYPE = 'governance_appointment';
export const MEETING_RESOURCE_TYPE = 'governance_meeting';
export const TASK_RESOURCE_TYPE = 'governance_task';

export const RULE_PUBLISHED_ACTION = 'governance.rule.published';
export const RULE_ACKNOWLEDGED_ACTION = 'governance.rule.acknowledged';
export const CASE_OPENED_ACTION = 'governance.case.opened';
export const CASE_TRANSITIONED_ACTION = 'governance.case.transitioned';
export const POSITION_CREATED_ACTION = 'governance.position.created';
export const APPOINTMENT_RECORDED_ACTION = 'governance.appointment.recorded';
export const MEETING_CREATED_ACTION = 'governance.meeting.created';
export const MEETING_TRANSITIONED_ACTION = 'governance.meeting.transitioned';
export const TASK_CREATED_ACTION = 'governance.task.created';
export const TASK_TRANSITIONED_ACTION = 'governance.task.transitioned';

// --- Domain events -----------------------------------------------------------

export const GOVERNANCE_EVENT_VERSION = 1;
export const RULE_PUBLISHED_EVENT = 'governance.rule.published.v1';
export const CASE_RESOLVED_EVENT = 'governance.case.resolved.v1';

// --- Static column lists (never SELECT *) ------------------------------------

export const RULE_COLUMNS = `"id", "team_id", "rule_key", "version", "category",
  "title", "body", "audience", "requires_acknowledgement", "effective_from",
  "status", "owner_user_id", "created_by", "archived_at", "created_at"`;

export const ACK_COLUMNS = `"id", "team_id", "rule_id", "membership_id",
  "rule_version", "acknowledged_at"`;

export const CASE_COLUMNS = `"id", "team_id", "membership_id", "rule_id",
  "severity", "fact_summary", "evidence_reference", "private_notes", "status",
  "action", "due_date", "member_response", "appeal_reason", "resolution",
  "opened_by", "reviewed_by", "resolved_by", "record_version", "responded_at",
  "reviewed_at", "appealed_at", "resolved_at", "expunged_at",
  "retention_expires_at", "created_at", "updated_at"`;

export const POSITION_COLUMNS = `"id", "team_id", "position_key", "title",
  "responsibilities", "status", "created_by", "created_at", "updated_at"`;

export const APPOINTMENT_COLUMNS = `"id", "team_id", "position_id",
  "membership_id", "acting", "starts_on", "ends_on", "status", "created_by",
  "created_at", "updated_at"`;

export const MEETING_COLUMNS = `"id", "team_id", "title", "scheduled_at",
  "agenda", "minutes", "decisions", "visibility", "status", "recurrence",
  "record_version", "created_by", "minutes_approved_by", "minutes_approved_at",
  "created_at", "updated_at"`;

export const TASK_COLUMNS = `"id", "team_id", "meeting_id", "title",
  "description", "owner_membership_id", "due_date", "priority", "status",
  "depends_on_task_id", "record_version", "created_by", "completed_at",
  "created_at", "updated_at"`;
