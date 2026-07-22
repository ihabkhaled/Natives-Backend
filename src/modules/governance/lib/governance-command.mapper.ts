import {
  DECISION_TEXT_MAX_LENGTH,
  DECISIONS_MAX,
} from '../model/governance.constants';
import {
  DisciplineAction,
  DisciplineSeverity,
  MeetingRecurrence,
  MeetingVisibility,
  RuleAudience,
  RuleCategory,
  TaskPriority,
} from '../model/governance.enums';
import type {
  AppointmentContent,
  AppointmentContentInput,
  DisciplineContent,
  DisciplineContentInput,
  DisciplineListFilter,
  DisciplineListFilterInput,
  MeetingContent,
  MeetingContentInput,
  MeetingDecision,
  MeetingListFilter,
  MeetingListFilterInput,
  PositionContent,
  PositionContentInput,
  RuleContent,
  RuleContentInput,
  RuleListFilter,
  RuleListFilterInput,
  TaskContent,
  TaskContentInput,
  TaskListFilter,
  TaskListFilterInput,
} from '../model/governance.types';

export function toRuleContent(input: RuleContentInput): RuleContent {
  return {
    ruleKey: input.ruleKey.trim(),
    category: input.category ?? RuleCategory.General,
    title: input.title.trim(),
    body: input.body,
    audience: input.audience ?? RuleAudience.Team,
    requiresAcknowledgement: input.requiresAcknowledgement ?? true,
    ownerUserId: input.ownerUserId ?? null,
  };
}

export function toDisciplineContent(
  input: DisciplineContentInput,
): DisciplineContent {
  return {
    membershipId: input.membershipId,
    ruleId: input.ruleId ?? null,
    severity: input.severity ?? DisciplineSeverity.Concern,
    factSummary: input.factSummary.trim(),
    evidenceReference: input.evidenceReference ?? null,
    privateNotes: input.privateNotes ?? null,
    action: input.action ?? DisciplineAction.None,
    dueDate: input.dueDate ?? null,
  };
}

export function toPositionContent(
  input: PositionContentInput,
): PositionContent {
  return {
    positionKey: input.positionKey.trim(),
    title: input.title.trim(),
    responsibilities: input.responsibilities ?? null,
  };
}

export function toAppointmentContent(
  input: AppointmentContentInput,
): AppointmentContent {
  return {
    membershipId: input.membershipId,
    acting: input.acting ?? false,
    startsOn: input.startsOn,
    endsOn: input.endsOn ?? null,
  };
}

export function toMeetingContent(input: MeetingContentInput): MeetingContent {
  return {
    title: input.title.trim(),
    scheduledAt: input.scheduledAt,
    agenda: input.agenda ?? null,
    visibility: input.visibility ?? MeetingVisibility.Staff,
    recurrence: input.recurrence ?? MeetingRecurrence.None,
  };
}

export function toTaskContent(input: TaskContentInput): TaskContent {
  return {
    meetingId: input.meetingId ?? null,
    title: input.title.trim(),
    description: input.description ?? null,
    ownerMembershipId: input.ownerMembershipId ?? null,
    dueDate: input.dueDate ?? null,
    priority: input.priority ?? TaskPriority.Normal,
    dependsOnTaskId: input.dependsOnTaskId ?? null,
  };
}

/** Normalize an untrusted decision register from the transport. */
export function toDecisionList(
  raw: readonly MeetingDecision[] | null | undefined,
): readonly MeetingDecision[] {
  return (raw ?? [])
    .filter(item => item.ref.trim().length > 0 && item.text.trim().length > 0)
    .map(item => ({
      ref: item.ref.trim().slice(0, DECISION_TEXT_MAX_LENGTH),
      text: item.text.trim().slice(0, DECISION_TEXT_MAX_LENGTH),
    }))
    .slice(0, DECISIONS_MAX);
}

export function toRuleListFilter(input: RuleListFilterInput): RuleListFilter {
  return {
    category: input.category ?? null,
    status: input.status ?? null,
  };
}

export function toDisciplineListFilter(
  input: DisciplineListFilterInput,
): DisciplineListFilter {
  return {
    membershipId: input.membershipId ?? null,
    status: input.status ?? null,
    severity: input.severity ?? null,
  };
}

export function toMeetingListFilter(
  input: MeetingListFilterInput,
): MeetingListFilter {
  return {
    status: input.status ?? null,
    visibility: input.visibility ?? null,
  };
}

export function toTaskListFilter(input: TaskListFilterInput): TaskListFilter {
  return {
    status: input.status ?? null,
    ownerMembershipId: input.ownerMembershipId ?? null,
    meetingId: input.meetingId ?? null,
  };
}
