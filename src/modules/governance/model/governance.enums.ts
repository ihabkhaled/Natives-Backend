/**
 * Enumerations for team rules, discipline, and governance (UN-602, UN-603).
 * Every enum ships a `*_VALUES` tuple so mappers can validate a raw database
 * string against the closed set.
 */

export enum RuleCategory {
  Conduct = 'conduct',
  Attendance = 'attendance',
  Safety = 'safety',
  Finance = 'finance',
  Spirit = 'spirit',
  General = 'general',
}

export const RULE_CATEGORY_VALUES: readonly RuleCategory[] =
  Object.values(RuleCategory);

export enum RuleAudience {
  Team = 'team',
  Players = 'players',
  Staff = 'staff',
  Public = 'public',
}

export const RULE_AUDIENCE_VALUES: readonly RuleAudience[] =
  Object.values(RuleAudience);

export enum RuleStatus {
  Active = 'active',
  Archived = 'archived',
}

export const RULE_STATUS_VALUES: readonly RuleStatus[] =
  Object.values(RuleStatus);

/** How serious a discipline case is. Never derived automatically from a metric. */
export enum DisciplineSeverity {
  Concern = 'concern',
  Minor = 'minor',
  Major = 'major',
  Critical = 'critical',
}

export const DISCIPLINE_SEVERITY_VALUES: readonly DisciplineSeverity[] =
  Object.values(DisciplineSeverity);

/** Lifecycle of a discipline case. */
export enum DisciplineStatus {
  Open = 'open',
  Notified = 'notified',
  Acknowledged = 'acknowledged',
  Responded = 'responded',
  UnderReview = 'under_review',
  Resolved = 'resolved',
  Appealed = 'appealed',
  Expunged = 'expunged',
}

export const DISCIPLINE_STATUS_VALUES: readonly DisciplineStatus[] =
  Object.values(DisciplineStatus);

/** The verbs the discipline transition endpoint accepts. */
export enum DisciplineTransition {
  Notify = 'notify',
  Acknowledge = 'acknowledge',
  Respond = 'respond',
  Review = 'review',
  Resolve = 'resolve',
  Appeal = 'appeal',
  Expunge = 'expunge',
}

export const DISCIPLINE_TRANSITION_VALUES: readonly DisciplineTransition[] =
  Object.values(DisciplineTransition);

/** The corrective action attached to a case. */
export enum DisciplineAction {
  None = 'none',
  Warning = 'warning',
  Suspension = 'suspension',
  Probation = 'probation',
  Expulsion = 'expulsion',
  CorrectivePlan = 'corrective_plan',
}

export const DISCIPLINE_ACTION_VALUES: readonly DisciplineAction[] =
  Object.values(DisciplineAction);

export enum GovernancePositionStatus {
  Active = 'active',
  Archived = 'archived',
}

export const GOVERNANCE_POSITION_STATUS_VALUES: readonly GovernancePositionStatus[] =
  Object.values(GovernancePositionStatus);

export enum AppointmentStatus {
  Active = 'active',
  Ended = 'ended',
}

export const APPOINTMENT_STATUS_VALUES: readonly AppointmentStatus[] =
  Object.values(AppointmentStatus);

export enum MeetingVisibility {
  Public = 'public',
  Team = 'team',
  Staff = 'staff',
  Board = 'board',
}

export const MEETING_VISIBILITY_VALUES: readonly MeetingVisibility[] =
  Object.values(MeetingVisibility);

export enum MeetingStatus {
  Scheduled = 'scheduled',
  Held = 'held',
  Minuted = 'minuted',
  Approved = 'approved',
  Cancelled = 'cancelled',
}

export const MEETING_STATUS_VALUES: readonly MeetingStatus[] =
  Object.values(MeetingStatus);

export enum MeetingTransition {
  Hold = 'hold',
  Minute = 'minute',
  Approve = 'approve',
  Cancel = 'cancel',
}

export const MEETING_TRANSITION_VALUES: readonly MeetingTransition[] =
  Object.values(MeetingTransition);

export enum MeetingRecurrence {
  None = 'none',
  Weekly = 'weekly',
  Monthly = 'monthly',
  Quarterly = 'quarterly',
}

export const MEETING_RECURRENCE_VALUES: readonly MeetingRecurrence[] =
  Object.values(MeetingRecurrence);

export enum TaskPriority {
  Low = 'low',
  Normal = 'normal',
  High = 'high',
  Urgent = 'urgent',
}

export const TASK_PRIORITY_VALUES: readonly TaskPriority[] =
  Object.values(TaskPriority);

export enum TaskStatus {
  Open = 'open',
  InProgress = 'in_progress',
  Blocked = 'blocked',
  Completed = 'completed',
  Cancelled = 'cancelled',
}

export const TASK_STATUS_VALUES: readonly TaskStatus[] =
  Object.values(TaskStatus);

export enum TaskTransition {
  Start = 'start',
  Block = 'block',
  Complete = 'complete',
  Cancel = 'cancel',
  Reopen = 'reopen',
}

export const TASK_TRANSITION_VALUES: readonly TaskTransition[] =
  Object.values(TaskTransition);

/** The audience a governance view is rendered for. */
export enum GovernanceAudience {
  Public = 'public',
  Team = 'team',
  Staff = 'staff',
  Board = 'board',
}

export const GOVERNANCE_AUDIENCE_VALUES: readonly GovernanceAudience[] =
  Object.values(GovernanceAudience);
