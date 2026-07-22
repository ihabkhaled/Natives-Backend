import type { AuditInput, DomainEventInput } from '@modules/platform';
import { AuditOutcome } from '@modules/platform';

import {
  isAppealTarget,
  isApproveTarget,
  isCompleteTarget,
  isExpungeTarget,
  isMinuteTarget,
  isResolveTarget,
  isRespondTarget,
  isReviewTarget,
} from '../domain/governance.state-machine';
import {
  CASE_OPENED_ACTION,
  CASE_RESOLVED_EVENT,
  DISCIPLINE_RESOURCE_TYPE,
  GOVERNANCE_EVENT_VERSION,
  MEETING_RESOURCE_TYPE,
  RULE_PUBLISHED_ACTION,
  RULE_PUBLISHED_EVENT,
  RULE_RESOURCE_TYPE,
  TASK_RESOURCE_TYPE,
} from '../model/governance.constants';
import type {
  DisciplineAction,
  DisciplineStatus,
  MeetingStatus,
  TaskStatus,
} from '../model/governance.enums';
import type {
  AppointmentContent,
  DisciplineCase,
  DisciplineContent,
  DisciplineStatusChange,
  DisciplineTransitionCommand,
  GovernanceMeeting,
  GovernanceTask,
  MeetingContent,
  MeetingStatusChange,
  MeetingTransitionCommand,
  NewDisciplineCase,
  NewGovernanceAppointment,
  NewGovernanceMeeting,
  NewGovernancePosition,
  NewGovernanceTask,
  NewRuleAcknowledgement,
  NewTeamRule,
  PositionContent,
  RuleContent,
  TaskContent,
  TaskStatusChange,
  TeamRule,
} from '../model/governance.types';

// --- Rules -------------------------------------------------------------------

export function buildNewRule(
  id: string,
  teamId: string,
  content: RuleContent,
  version: number,
  actorUserId: string,
  now: Date,
): NewTeamRule {
  return {
    id,
    teamId,
    ruleKey: content.ruleKey,
    version,
    category: content.category,
    title: content.title,
    body: content.body,
    audience: content.audience,
    requiresAcknowledgement: content.requiresAcknowledgement,
    effectiveFrom: now,
    ownerUserId: content.ownerUserId,
    createdBy: actorUserId,
  };
}

export function buildAcknowledgement(
  id: string,
  rule: TeamRule,
  membershipId: string,
  now: Date,
): NewRuleAcknowledgement {
  return {
    id,
    teamId: rule.teamId,
    ruleId: rule.ruleId,
    membershipId,
    ruleVersion: rule.version,
    now,
  };
}

// --- Discipline --------------------------------------------------------------

export function buildNewCase(
  id: string,
  teamId: string,
  content: DisciplineContent,
  actorUserId: string,
  retentionExpiresAt: Date,
  now: Date,
): NewDisciplineCase {
  return {
    id,
    teamId,
    membershipId: content.membershipId,
    ruleId: content.ruleId,
    severity: content.severity,
    factSummary: content.factSummary,
    evidenceReference: content.evidenceReference,
    privateNotes: content.privateNotes,
    action: content.action,
    dueDate: content.dueDate,
    openedBy: actorUserId,
    retentionExpiresAt,
    now,
  };
}

export function buildCaseStatusChange(
  existing: DisciplineCase,
  target: DisciplineStatus,
  action: DisciplineAction,
  actorUserId: string,
  command: DisciplineTransitionCommand,
  now: Date,
): DisciplineStatusChange {
  const responding = isRespondTarget(target);
  const reviewing = isReviewTarget(target);
  const resolving = isResolveTarget(target);
  const appealing = isAppealTarget(target);
  return {
    id: existing.caseId,
    teamId: existing.teamId,
    expectedRecordVersion: command.expectedRecordVersion,
    toStatus: target,
    action,
    memberResponse: responding ? command.note : existing.memberResponse,
    appealReason: appealing ? command.note : existing.appealReason,
    resolution: resolving ? command.note : existing.resolution,
    reviewedBy: reviewing ? actorUserId : existing.reviewedBy,
    resolvedBy: resolving ? actorUserId : existing.resolvedBy,
    respondedAt: responding ? now : existing.respondedAt,
    reviewedAt: reviewing ? now : existing.reviewedAt,
    appealedAt: appealing ? now : existing.appealedAt,
    resolvedAt: resolving ? now : existing.resolvedAt,
    expungedAt: isExpungeTarget(target) ? now : existing.expungedAt,
    now,
  };
}

// --- Positions, appointments -------------------------------------------------

export function buildNewPosition(
  id: string,
  teamId: string,
  content: PositionContent,
  actorUserId: string,
  now: Date,
): NewGovernancePosition {
  return {
    id,
    teamId,
    positionKey: content.positionKey,
    title: content.title,
    responsibilities: content.responsibilities,
    createdBy: actorUserId,
    now,
  };
}

export function buildNewAppointment(
  id: string,
  teamId: string,
  positionId: string,
  content: AppointmentContent,
  actorUserId: string,
  now: Date,
): NewGovernanceAppointment {
  return {
    id,
    teamId,
    positionId,
    membershipId: content.membershipId,
    acting: content.acting,
    startsOn: content.startsOn,
    endsOn: content.endsOn,
    createdBy: actorUserId,
    now,
  };
}

// --- Meetings ----------------------------------------------------------------

export function buildNewMeeting(
  id: string,
  teamId: string,
  content: MeetingContent,
  actorUserId: string,
  now: Date,
): NewGovernanceMeeting {
  return {
    id,
    teamId,
    title: content.title,
    scheduledAt: content.scheduledAt,
    agenda: content.agenda,
    visibility: content.visibility,
    recurrence: content.recurrence,
    createdBy: actorUserId,
    now,
  };
}

export function buildMeetingStatusChange(
  existing: GovernanceMeeting,
  target: MeetingStatus,
  actorUserId: string,
  command: MeetingTransitionCommand,
  now: Date,
): MeetingStatusChange {
  const minuting = isMinuteTarget(target);
  const approving = isApproveTarget(target);
  return {
    id: existing.meetingId,
    teamId: existing.teamId,
    expectedRecordVersion: command.expectedRecordVersion,
    toStatus: target,
    minutes: minuting ? command.minutes : existing.minutes,
    decisions: minuting ? command.decisions : existing.decisions,
    minutesApprovedBy: approving ? actorUserId : existing.minutesApprovedBy,
    minutesApprovedAt: approving ? now : existing.minutesApprovedAt,
    now,
  };
}

// --- Tasks -------------------------------------------------------------------

export function buildNewTask(
  id: string,
  teamId: string,
  content: TaskContent,
  actorUserId: string,
  now: Date,
): NewGovernanceTask {
  return {
    id,
    teamId,
    meetingId: content.meetingId,
    title: content.title,
    description: content.description,
    ownerMembershipId: content.ownerMembershipId,
    dueDate: content.dueDate,
    priority: content.priority,
    dependsOnTaskId: content.dependsOnTaskId,
    createdBy: actorUserId,
    now,
  };
}

export function buildTaskStatusChange(
  existing: GovernanceTask,
  target: TaskStatus,
  ownerMembershipId: string | null,
  command: { readonly expectedRecordVersion: number },
  now: Date,
): TaskStatusChange {
  return {
    id: existing.taskId,
    teamId: existing.teamId,
    expectedRecordVersion: command.expectedRecordVersion,
    toStatus: target,
    ownerMembershipId: ownerMembershipId ?? existing.ownerMembershipId,
    completedAt: isCompleteTarget(target) ? now : existing.completedAt,
    now,
  };
}

// --- Audit -------------------------------------------------------------------

export function buildRuleAudit(
  actorUserId: string,
  rule: TeamRule,
): AuditInput {
  return {
    actorUserId,
    action: RULE_PUBLISHED_ACTION,
    resourceType: RULE_RESOURCE_TYPE,
    resourceId: rule.ruleId,
    teamId: rule.teamId,
    seasonId: null,
    correlationId: null,
    outcome: AuditOutcome.Success,
    diff: {
      ruleKey: rule.ruleKey,
      version: rule.version,
      category: rule.category,
      audience: rule.audience,
    },
  };
}

export function buildAcknowledgementAudit(
  action: string,
  actorUserId: string,
  rule: TeamRule,
  membershipId: string,
): AuditInput {
  return {
    actorUserId,
    action,
    resourceType: RULE_RESOURCE_TYPE,
    resourceId: rule.ruleId,
    teamId: rule.teamId,
    seasonId: null,
    correlationId: null,
    outcome: AuditOutcome.Success,
    diff: { membershipId, ruleVersion: rule.version },
  };
}

/**
 * Audit a discipline case. The diff carries CLASSIFICATIONS only — status,
 * severity, action — and never the fact summary, private notes, member
 * response, or resolution text. Discipline detail lives on the restricted case
 * row, out of the broadly-readable audit log.
 */
export function buildCaseAudit(
  action: string,
  actorUserId: string,
  disciplineCase: DisciplineCase,
): AuditInput {
  return {
    actorUserId,
    action,
    resourceType: DISCIPLINE_RESOURCE_TYPE,
    resourceId: disciplineCase.caseId,
    teamId: disciplineCase.teamId,
    seasonId: null,
    correlationId: null,
    outcome: AuditOutcome.Success,
    diff: {
      membershipId: disciplineCase.membershipId,
      status: disciplineCase.status,
      severity: disciplineCase.severity,
      action: disciplineCase.action,
    },
  };
}

export function buildOpenedCaseAudit(
  actorUserId: string,
  disciplineCase: DisciplineCase,
): AuditInput {
  return buildCaseAudit(CASE_OPENED_ACTION, actorUserId, disciplineCase);
}

export function buildGovernanceAudit(
  action: string,
  resourceType: string,
  actorUserId: string,
  teamId: string,
  resourceId: string,
  diff: AuditInput['diff'],
): AuditInput {
  return {
    actorUserId,
    action,
    resourceType,
    resourceId,
    teamId,
    seasonId: null,
    correlationId: null,
    outcome: AuditOutcome.Success,
    diff,
  };
}

export function buildMeetingAudit(
  action: string,
  actorUserId: string,
  meeting: GovernanceMeeting,
): AuditInput {
  return buildGovernanceAudit(
    action,
    MEETING_RESOURCE_TYPE,
    actorUserId,
    meeting.teamId,
    meeting.meetingId,
    {
      status: meeting.status,
      visibility: meeting.visibility,
      recurrence: meeting.recurrence,
    },
  );
}

export function buildTaskAudit(
  action: string,
  actorUserId: string,
  task: GovernanceTask,
): AuditInput {
  return buildGovernanceAudit(
    action,
    TASK_RESOURCE_TYPE,
    actorUserId,
    task.teamId,
    task.taskId,
    { status: task.status, priority: task.priority },
  );
}

// --- Domain events -----------------------------------------------------------

export function buildRulePublishedEvent(
  rule: TeamRule,
  actorUserId: string,
): DomainEventInput {
  return {
    aggregateType: RULE_RESOURCE_TYPE,
    aggregateId: rule.ruleId,
    eventType: RULE_PUBLISHED_EVENT,
    eventVersion: GOVERNANCE_EVENT_VERSION,
    actorUserId,
    teamId: rule.teamId,
    seasonId: null,
    correlationId: null,
    causationId: null,
    payload: {
      ruleKey: rule.ruleKey,
      version: rule.version,
      audience: rule.audience,
      requiresAcknowledgement: rule.requiresAcknowledgement,
    },
  };
}

/**
 * `governance.case.resolved` carries the classification only — never the
 * resolution text — so a downstream notifier can announce that a case closed
 * without leaking the confidential outcome.
 */
export function buildCaseResolvedEvent(
  disciplineCase: DisciplineCase,
  actorUserId: string,
): DomainEventInput {
  return {
    aggregateType: DISCIPLINE_RESOURCE_TYPE,
    aggregateId: disciplineCase.caseId,
    eventType: CASE_RESOLVED_EVENT,
    eventVersion: GOVERNANCE_EVENT_VERSION,
    actorUserId,
    teamId: disciplineCase.teamId,
    seasonId: null,
    correlationId: null,
    causationId: null,
    payload: {
      membershipId: disciplineCase.membershipId,
      action: disciplineCase.action,
      severity: disciplineCase.severity,
    },
  };
}
