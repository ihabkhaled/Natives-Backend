import { describe, expect, it } from 'vitest';

import {
  DisciplineAction,
  DisciplineSeverity,
  DisciplineStatus,
  DisciplineTransition,
  MeetingRecurrence,
  MeetingStatus,
  MeetingVisibility,
  RuleAudience,
  RuleCategory,
  RuleStatus,
  TaskPriority,
  TaskStatus,
} from '../model/governance.enums';
import type {
  DisciplineCaseRow,
  MeetingRow,
  RuleRow,
  TaskRow,
} from '../model/governance.rows';
import type {
  DisciplineCase,
  GovernanceMeeting,
  GovernanceTask,
  TeamRule,
} from '../model/governance.types';
import {
  buildAcknowledgement,
  buildCaseAudit,
  buildCaseResolvedEvent,
  buildCaseStatusChange,
  buildMeetingStatusChange,
  buildNewCase,
  buildNewMeeting,
  buildNewRule,
  buildNewTask,
  buildRuleAudit,
  buildRulePublishedEvent,
  buildTaskStatusChange,
} from './governance.builders';
import {
  mergeRuleAckState,
  parseEnumValue,
  resolveGovernancePage,
  toCalendarDay,
  toDate,
  toDecisions,
  toNullableCalendarDay,
  toNullableDate,
  toNumber,
} from './governance.helpers';
import {
  toDisciplineCase,
  toMeeting,
  toMembershipRef,
  toTask,
  toTeamRule,
} from './governance.mapper';
import {
  toAppointmentContent,
  toDecisionList,
  toDisciplineContent,
  toDisciplineListFilter,
  toMeetingContent,
  toRuleContent,
  toTaskContent,
} from './governance-command.mapper';

const NOW = new Date('2025-03-01T00:00:00.000Z');

const RULE_ROW: RuleRow = {
  id: 'rule-1',
  team_id: 'team-1',
  rule_key: 'conduct',
  version: '2',
  category: 'conduct',
  title: 'Code of conduct',
  body: 'be excellent',
  audience: 'team',
  requires_acknowledgement: true,
  effective_from: NOW,
  status: 'active',
  owner_user_id: 'user-1',
  created_by: 'user-1',
  archived_at: null,
  created_at: NOW,
};

const CASE_ROW: DisciplineCaseRow = {
  id: 'case-1',
  team_id: 'team-1',
  membership_id: 'member-1',
  rule_id: 'rule-1',
  severity: 'minor',
  fact_summary: 'missed briefing',
  evidence_reference: null,
  private_notes: 'sensitive',
  status: 'open',
  action: 'none',
  due_date: '2025-04-01',
  member_response: null,
  appeal_reason: null,
  resolution: null,
  opened_by: 'user-1',
  reviewed_by: null,
  resolved_by: null,
  record_version: '1',
  responded_at: null,
  reviewed_at: null,
  appealed_at: null,
  resolved_at: null,
  expunged_at: null,
  retention_expires_at: NOW,
  created_at: NOW,
  updated_at: NOW,
};

const MEETING_ROW: MeetingRow = {
  id: 'meeting-1',
  team_id: 'team-1',
  title: 'Board sync',
  scheduled_at: NOW,
  agenda: 'budget',
  minutes: null,
  decisions: [{ ref: 'D1', text: 'approve' }, { bad: true }],
  visibility: 'board',
  status: 'scheduled',
  recurrence: 'none',
  record_version: '1',
  created_by: 'user-1',
  minutes_approved_by: null,
  minutes_approved_at: null,
  created_at: NOW,
  updated_at: NOW,
};

const TASK_ROW: TaskRow = {
  id: 'task-1',
  team_id: 'team-1',
  meeting_id: null,
  title: 'Book pitch',
  description: null,
  owner_membership_id: 'member-1',
  due_date: '2025-04-10',
  priority: 'high',
  status: 'open',
  depends_on_task_id: null,
  record_version: '1',
  created_by: 'user-1',
  completed_at: null,
  created_at: NOW,
  updated_at: NOW,
};

const RULE: TeamRule = toTeamRule(RULE_ROW);
const CASE: DisciplineCase = toDisciplineCase(CASE_ROW);
const MEETING: GovernanceMeeting = toMeeting(MEETING_ROW);
const TASK: GovernanceTask = toTask(TASK_ROW);

describe('governance helpers', () => {
  it('clamps paging and coerces driver values', () => {
    expect(resolveGovernancePage(undefined, undefined)).toEqual({
      limit: 20,
      offset: 0,
    });
    expect(resolveGovernancePage(500, 3)).toEqual({ limit: 100, offset: 3 });
    expect(toDate(NOW)).toBe(NOW);
    expect(toNullableDate(null)).toBeNull();
    expect(toNumber('4')).toBe(4);
    expect(toCalendarDay('2025-04-01')).toBe('2025-04-01');
    expect(toNullableCalendarDay(null)).toBeNull();
    expect(parseEnumValue(['a'], 'a', 'x')).toBe('a');
    expect(() => parseEnumValue(['a'], 'z', 'x')).toThrow(/x/u);
  });

  it('narrows a jsonb decision register, dropping malformed elements', () => {
    expect(
      toDecisions([{ ref: 'D1', text: 'ok' }, { bad: true }, 'x']),
    ).toEqual([{ ref: 'D1', text: 'ok' }]);
    expect(toDecisions('nope')).toEqual([]);
  });

  it('merges the caller’s acks into rule rows without cross-version carry-over', () => {
    const other: TeamRule = { ...RULE, ruleId: 'rule-9' };
    const merged = mergeRuleAckState(
      [RULE, other],
      [
        {
          acknowledgementId: 'ack-1',
          teamId: RULE.teamId,
          ruleId: RULE.ruleId,
          membershipId: 'member-1',
          ruleVersion: RULE.version,
          acknowledgedAt: NOW,
        },
      ],
    );
    expect(merged[0]?.myAcknowledgedVersion).toBe(RULE.version);
    expect(merged[0]?.myAcknowledgedAt).toEqual(NOW);
    expect(merged[1]?.myAcknowledgedVersion).toBeNull();
    expect(merged[1]?.myAcknowledgedAt).toBeNull();
  });
});

describe('governance mapper', () => {
  it('maps a membership ownership probe row, and a miss to null', () => {
    expect(toMembershipRef({ id: 'member-1', user_id: 'user-1' })).toEqual({
      membershipId: 'member-1',
      userId: 'user-1',
    });
    expect(toMembershipRef(undefined)).toBeNull();
  });

  it('maps a rule version', () => {
    expect(RULE.version).toBe(2);
    expect(RULE.category).toBe(RuleCategory.Conduct);
    expect(RULE.audience).toBe(RuleAudience.Team);
    expect(RULE.status).toBe(RuleStatus.Active);
  });

  it('maps a discipline case with its calendar due date', () => {
    expect(CASE.dueDate).toBe('2025-04-01');
    expect(CASE.severity).toBe(DisciplineSeverity.Minor);
    expect(CASE.status).toBe(DisciplineStatus.Open);
    expect(CASE.action).toBe(DisciplineAction.None);
  });

  it('maps a meeting, sanitizing its decision register', () => {
    expect(MEETING.decisions).toEqual([{ ref: 'D1', text: 'approve' }]);
    expect(MEETING.visibility).toBe(MeetingVisibility.Board);
    expect(MEETING.status).toBe(MeetingStatus.Scheduled);
    expect(MEETING.recurrence).toBe(MeetingRecurrence.None);
  });

  it('maps a task', () => {
    expect(TASK.priority).toBe(TaskPriority.High);
    expect(TASK.status).toBe(TaskStatus.Open);
    expect(TASK.dueDate).toBe('2025-04-10');
  });
});

describe('governance command mapper', () => {
  it('defaults a rule to team audience and required acknowledgement', () => {
    const content = toRuleContent({
      ruleKey: ' conduct ',
      title: ' Code ',
      body: 'text',
    });
    expect(content.audience).toBe(RuleAudience.Team);
    expect(content.requiresAcknowledgement).toBe(true);
    expect(content.ruleKey).toBe('conduct');
  });

  it('defaults discipline to a concern with no action', () => {
    const content = toDisciplineContent({
      membershipId: 'member-1',
      factSummary: ' missed ',
    });
    expect(content.severity).toBe(DisciplineSeverity.Concern);
    expect(content.action).toBe(DisciplineAction.None);
    expect(content.dueDate).toBeNull();
  });

  it('defaults a meeting to staff visibility', () => {
    expect(
      toMeetingContent({ title: 'x', scheduledAt: NOW.toISOString() })
        .visibility,
    ).toBe(MeetingVisibility.Staff);
  });

  it('normalizes an appointment and a task', () => {
    expect(
      toAppointmentContent({ membershipId: 'm', startsOn: '2025-01-01' })
        .acting,
    ).toBe(false);
    expect(toTaskContent({ title: ' Book ' }).priority).toBe(
      TaskPriority.Normal,
    );
  });

  it('sanitizes a decision register from the transport', () => {
    expect(
      toDecisionList([
        { ref: ' D1 ', text: ' ok ' },
        { ref: '', text: 'x' },
      ]),
    ).toEqual([{ ref: 'D1', text: 'ok' }]);
    expect(toDecisionList(null)).toEqual([]);
  });

  it('keeps every absent filter facet null', () => {
    expect(toDisciplineListFilter({})).toEqual({
      membershipId: null,
      status: null,
      severity: null,
    });
  });
});

describe('governance builders', () => {
  it('builds a new rule and an acknowledgement citing the version', () => {
    const rule = buildNewRule(
      'id-1',
      'team-1',
      toRuleContent({ ruleKey: 'conduct', title: 'Code', body: 'text' }),
      3,
      'user-1',
      NOW,
    );
    expect(rule.version).toBe(3);
    expect(buildAcknowledgement('a-1', RULE, 'member-1', NOW).ruleVersion).toBe(
      2,
    );
  });

  it('builds a discipline case and stamps only the instants a move owns', () => {
    const newCase = buildNewCase(
      'id-1',
      'team-1',
      toDisciplineContent({ membershipId: 'member-1', factSummary: 'x' }),
      'user-1',
      NOW,
      NOW,
    );
    expect(newCase.openedBy).toBe('user-1');
    const resolved = buildCaseStatusChange(
      CASE,
      DisciplineStatus.Resolved,
      DisciplineAction.Warning,
      'user-2',
      {
        transition: DisciplineTransition.Resolve,
        note: 'closed',
        action: DisciplineAction.Warning,
        expectedRecordVersion: 1,
      },
      NOW,
    );
    expect(resolved.resolvedAt).toBe(NOW);
    expect(resolved.resolution).toBe('closed');
    expect(resolved.resolvedBy).toBe('user-2');
  });

  it('audits discipline with classifications only, never the fact text', () => {
    const audit = buildCaseAudit('governance.case.opened', 'user-1', CASE);
    expect(JSON.stringify(audit.diff)).not.toContain('missed briefing');
    expect(audit.diff['status']).toBe(DisciplineStatus.Open);
    const event = buildCaseResolvedEvent(CASE, 'user-2');
    expect(JSON.stringify(event.payload)).not.toContain('missed briefing');
  });

  it('publishes a rule event without the body', () => {
    const event = buildRulePublishedEvent(RULE, 'user-1');
    expect(event.payload['version']).toBe(2);
    expect(JSON.stringify(event.payload)).not.toContain('be excellent');
    expect(buildRuleAudit('user-1', RULE).diff['ruleKey']).toBe('conduct');
  });

  it('builds meeting and task changes', () => {
    const minuted = buildMeetingStatusChange(
      MEETING,
      MeetingStatus.Minuted,
      'user-1',
      {
        transition: 'minute' as never,
        minutes: 'notes',
        decisions: [{ ref: 'D1', text: 'ok' }],
        expectedRecordVersion: 1,
      },
      NOW,
    );
    expect(minuted.minutes).toBe('notes');
    const newMeeting = buildNewMeeting(
      'id-1',
      'team-1',
      toMeetingContent({ title: 'x', scheduledAt: NOW.toISOString() }),
      'user-1',
      NOW,
    );
    expect(newMeeting.visibility).toBe(MeetingVisibility.Staff);
    const completed = buildTaskStatusChange(
      TASK,
      TaskStatus.Completed,
      'member-2',
      { expectedRecordVersion: 1 },
      NOW,
    );
    expect(completed.completedAt).toBe(NOW);
    expect(completed.ownerMembershipId).toBe('member-2');
    expect(
      buildNewTask(
        'id-1',
        'team-1',
        toTaskContent({ title: 'Book' }),
        'user-1',
        NOW,
      ).priority,
    ).toBe(TaskPriority.Normal);
  });
});
