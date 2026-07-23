import {
  APPOINTMENT_STATUS_VALUES,
  DISCIPLINE_ACTION_VALUES,
  DISCIPLINE_SEVERITY_VALUES,
  DISCIPLINE_STATUS_VALUES,
  GOVERNANCE_POSITION_STATUS_VALUES,
  MEETING_RECURRENCE_VALUES,
  MEETING_STATUS_VALUES,
  MEETING_VISIBILITY_VALUES,
  RULE_AUDIENCE_VALUES,
  RULE_CATEGORY_VALUES,
  RULE_STATUS_VALUES,
  TASK_PRIORITY_VALUES,
  TASK_STATUS_VALUES,
} from '../model/governance.enums';
import type {
  AckRow,
  AppointmentRow,
  DisciplineCaseRow,
  GovernanceMembershipRow,
  MeetingRow,
  PositionRow,
  RuleRow,
  TaskRow,
} from '../model/governance.rows';
import type {
  DisciplineCase,
  GovernanceAppointment,
  GovernanceMeeting,
  GovernanceMembershipRef,
  GovernancePosition,
  GovernanceTask,
  RuleAcknowledgement,
  TeamRule,
} from '../model/governance.types';
import {
  parseEnumValue,
  toCalendarDay,
  toDate,
  toDecisions,
  toNullableCalendarDay,
  toNullableDate,
  toNumber,
} from './governance.helpers';

export function toMembershipRef(
  row: GovernanceMembershipRow | undefined,
): GovernanceMembershipRef | null {
  return row === undefined
    ? null
    : { membershipId: row.id, userId: row.user_id };
}

export function toTeamRule(row: RuleRow): TeamRule {
  return {
    ruleId: row.id,
    teamId: row.team_id,
    ruleKey: row.rule_key,
    version: toNumber(row.version),
    category: parseEnumValue(RULE_CATEGORY_VALUES, row.category, 'category'),
    title: row.title,
    body: row.body,
    audience: parseEnumValue(RULE_AUDIENCE_VALUES, row.audience, 'audience'),
    requiresAcknowledgement: row.requires_acknowledgement,
    effectiveFrom: toDate(row.effective_from),
    status: parseEnumValue(RULE_STATUS_VALUES, row.status, 'rule status'),
    ownerUserId: row.owner_user_id,
    createdBy: row.created_by,
    archivedAt: toNullableDate(row.archived_at),
    createdAt: toDate(row.created_at),
  };
}

export function toAcknowledgement(row: AckRow): RuleAcknowledgement {
  return {
    acknowledgementId: row.id,
    teamId: row.team_id,
    ruleId: row.rule_id,
    membershipId: row.membership_id,
    ruleVersion: toNumber(row.rule_version),
    acknowledgedAt: toDate(row.acknowledged_at),
  };
}

export function toDisciplineCase(row: DisciplineCaseRow): DisciplineCase {
  return {
    caseId: row.id,
    teamId: row.team_id,
    membershipId: row.membership_id,
    ruleId: row.rule_id,
    severity: parseEnumValue(
      DISCIPLINE_SEVERITY_VALUES,
      row.severity,
      'severity',
    ),
    factSummary: row.fact_summary,
    evidenceReference: row.evidence_reference,
    privateNotes: row.private_notes,
    status: parseEnumValue(DISCIPLINE_STATUS_VALUES, row.status, 'case status'),
    action: parseEnumValue(DISCIPLINE_ACTION_VALUES, row.action, 'action'),
    dueDate: toNullableCalendarDay(row.due_date),
    memberResponse: row.member_response,
    appealReason: row.appeal_reason,
    resolution: row.resolution,
    openedBy: row.opened_by,
    reviewedBy: row.reviewed_by,
    resolvedBy: row.resolved_by,
    recordVersion: toNumber(row.record_version),
    respondedAt: toNullableDate(row.responded_at),
    reviewedAt: toNullableDate(row.reviewed_at),
    appealedAt: toNullableDate(row.appealed_at),
    resolvedAt: toNullableDate(row.resolved_at),
    expungedAt: toNullableDate(row.expunged_at),
    retentionExpiresAt: toDate(row.retention_expires_at),
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  };
}

export function toPosition(row: PositionRow): GovernancePosition {
  return {
    positionId: row.id,
    teamId: row.team_id,
    positionKey: row.position_key,
    title: row.title,
    responsibilities: row.responsibilities,
    status: parseEnumValue(
      GOVERNANCE_POSITION_STATUS_VALUES,
      row.status,
      'position status',
    ),
    createdBy: row.created_by,
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  };
}

export function toAppointment(row: AppointmentRow): GovernanceAppointment {
  return {
    appointmentId: row.id,
    teamId: row.team_id,
    positionId: row.position_id,
    membershipId: row.membership_id,
    acting: row.acting,
    startsOn: toCalendarDay(row.starts_on),
    endsOn: toNullableCalendarDay(row.ends_on),
    status: parseEnumValue(
      APPOINTMENT_STATUS_VALUES,
      row.status,
      'appointment status',
    ),
    createdBy: row.created_by,
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  };
}

export function toMeeting(row: MeetingRow): GovernanceMeeting {
  return {
    meetingId: row.id,
    teamId: row.team_id,
    title: row.title,
    scheduledAt: toDate(row.scheduled_at),
    agenda: row.agenda,
    minutes: row.minutes,
    decisions: toDecisions(row.decisions),
    visibility: parseEnumValue(
      MEETING_VISIBILITY_VALUES,
      row.visibility,
      'visibility',
    ),
    status: parseEnumValue(MEETING_STATUS_VALUES, row.status, 'meeting status'),
    recurrence: parseEnumValue(
      MEETING_RECURRENCE_VALUES,
      row.recurrence,
      'recurrence',
    ),
    recordVersion: toNumber(row.record_version),
    createdBy: row.created_by,
    minutesApprovedBy: row.minutes_approved_by,
    minutesApprovedAt: toNullableDate(row.minutes_approved_at),
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  };
}

export function toTask(row: TaskRow): GovernanceTask {
  return {
    taskId: row.id,
    teamId: row.team_id,
    meetingId: row.meeting_id,
    title: row.title,
    description: row.description,
    ownerMembershipId: row.owner_membership_id,
    dueDate: toNullableCalendarDay(row.due_date),
    priority: parseEnumValue(TASK_PRIORITY_VALUES, row.priority, 'priority'),
    status: parseEnumValue(TASK_STATUS_VALUES, row.status, 'task status'),
    dependsOnTaskId: row.depends_on_task_id,
    recordVersion: toNumber(row.record_version),
    createdBy: row.created_by,
    completedAt: toNullableDate(row.completed_at),
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  };
}
