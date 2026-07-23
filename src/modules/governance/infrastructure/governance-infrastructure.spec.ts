import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { describe, expect, it, vi } from 'vitest';

import {
  DisciplineAction,
  DisciplineSeverity,
  DisciplineStatus,
  MeetingRecurrence,
  MeetingStatus,
  MeetingVisibility,
  RuleAudience,
  RuleCategory,
  TaskPriority,
  TaskStatus,
} from '../model/governance.enums';
import type {
  AckRow,
  AppointmentRow,
  DisciplineCaseRow,
  MeetingRow,
  PositionRow,
  RuleRow,
  TaskRow,
} from '../model/governance.rows';
import { DisciplineRepository } from './discipline.repository';
import { GovernanceDirectoryRepository } from './governance-directory.repository';
import { GovernanceScopeRepository } from './governance-scope.repository';
import { MeetingRepository } from './meeting.repository';
import { RuleRepository } from './rule.repository';
import { TaskRepository } from './task.repository';

const NOW = new Date('2025-03-01T00:00:00.000Z');

const RULE_ROW: RuleRow = {
  id: 'rule-1',
  team_id: 'team-1',
  rule_key: 'conduct',
  version: 1,
  category: 'conduct',
  title: 'Code',
  body: 'text',
  audience: 'team',
  requires_acknowledgement: true,
  effective_from: NOW,
  status: 'active',
  owner_user_id: null,
  created_by: 'user-1',
  archived_at: null,
  created_at: NOW,
};

const ACK_ROW: AckRow = {
  id: 'ack-1',
  team_id: 'team-1',
  rule_id: 'rule-1',
  membership_id: 'member-1',
  rule_version: 1,
  acknowledged_at: NOW,
};

const CASE_ROW: DisciplineCaseRow = {
  id: 'case-1',
  team_id: 'team-1',
  membership_id: 'member-1',
  rule_id: null,
  severity: 'minor',
  fact_summary: 'x',
  evidence_reference: null,
  private_notes: null,
  status: 'open',
  action: 'none',
  due_date: null,
  member_response: null,
  appeal_reason: null,
  resolution: null,
  opened_by: 'user-1',
  reviewed_by: null,
  resolved_by: null,
  record_version: 1,
  responded_at: null,
  reviewed_at: null,
  appealed_at: null,
  resolved_at: null,
  expunged_at: null,
  retention_expires_at: NOW,
  created_at: NOW,
  updated_at: NOW,
};

const POSITION_ROW: PositionRow = {
  id: 'pos-1',
  team_id: 'team-1',
  position_key: 'team_captain',
  title: 'Team Captain',
  responsibilities: null,
  status: 'active',
  created_by: 'user-1',
  created_at: NOW,
  updated_at: NOW,
};

const APPOINTMENT_ROW: AppointmentRow = {
  id: 'app-1',
  team_id: 'team-1',
  position_id: 'pos-1',
  membership_id: 'member-1',
  acting: false,
  starts_on: '2025-01-01',
  ends_on: null,
  status: 'active',
  created_by: 'user-1',
  created_at: NOW,
  updated_at: NOW,
};

const MEETING_ROW: MeetingRow = {
  id: 'meeting-1',
  team_id: 'team-1',
  title: 'Board',
  scheduled_at: NOW,
  agenda: null,
  minutes: null,
  decisions: [],
  visibility: 'board',
  status: 'scheduled',
  recurrence: 'none',
  record_version: 1,
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
  title: 'Book',
  description: null,
  owner_membership_id: null,
  due_date: null,
  priority: 'normal',
  status: 'open',
  depends_on_task_id: null,
  record_version: 1,
  created_by: 'user-1',
  completed_at: null,
  created_at: NOW,
  updated_at: NOW,
};

function scopeReturning(...results: unknown[][]): {
  scope: TransactionScope;
  run: ReturnType<typeof vi.fn>;
} {
  const run = vi.fn();
  for (const result of results) {
    run.mockResolvedValueOnce(result);
  }
  run.mockResolvedValue([]);
  return { scope: { run }, run };
}

describe('GovernanceScopeRepository', () => {
  const repository = new GovernanceScopeRepository();

  it('probes active team and membership', async () => {
    const team = scopeReturning([{ id: 'team-1' }]);
    expect(await repository.activeTeamExists(team.scope, 'team-1')).toBe(true);
    const member = scopeReturning([]);
    expect(
      await repository.membershipExists(member.scope, 'team-1', 'member-9'),
    ).toBe(false);
  });

  it('resolves a membership with its owning user for self-scope checks', async () => {
    const found = scopeReturning([{ id: 'member-1', user_id: 'user-1' }]);
    expect(
      await repository.findMembership(found.scope, 'team-1', 'member-1'),
    ).toEqual({ membershipId: 'member-1', userId: 'user-1' });
    expect(String(found.run.mock.calls[0]?.[0])).toContain(
      '"deleted_at" IS NULL',
    );
    const missing = scopeReturning([]);
    expect(
      await repository.findMembership(missing.scope, 'team-1', 'member-9'),
    ).toBeNull();
  });

  it('resolves the caller’s single active membership by user', async () => {
    const found = scopeReturning([{ id: 'member-1', user_id: 'user-1' }]);
    expect(
      await repository.findActiveMembershipByUser(
        found.scope,
        'team-1',
        'user-1',
      ),
    ).toEqual({ membershipId: 'member-1', userId: 'user-1' });
    const sql = String(found.run.mock.calls[0]?.[0]);
    expect(sql).toContain(`"status" = 'active'`);
    expect(sql).toContain('LIMIT 1');
  });
});

describe('RuleRepository', () => {
  const repository = new RuleRepository();
  const newRule = {
    id: 'rule-1',
    teamId: 'team-1',
    ruleKey: 'conduct',
    version: 1,
    category: RuleCategory.Conduct,
    title: 'Code',
    body: 'text',
    audience: RuleAudience.Team,
    requiresAcknowledgement: true,
    effectiveFrom: NOW,
    ownerUserId: null,
    createdBy: 'user-1',
  };

  it('inserts and resolves a rule and the latest version of a key', async () => {
    const inserted = scopeReturning([RULE_ROW]);
    expect((await repository.insert(inserted.scope, newRule)).ruleKey).toBe(
      'conduct',
    );
    const latest = scopeReturning([RULE_ROW]);
    expect(
      (await repository.findLatestByKey(latest.scope, 'team-1', 'conduct'))
        ?.version,
    ).toBe(1);
    const missing = scopeReturning([]);
    expect(
      await repository.findForWrite(missing.scope, 'team-1', 'rule-9'),
    ).toBeNull();
  });

  it('throws when a rule write returns no row', async () => {
    const { scope } = scopeReturning([]);
    await expect(repository.insert(scope, newRule)).rejects.toThrow(
      /rule write/u,
    );
  });

  it('bounds the list and count', async () => {
    const filter = { category: null, status: null };
    const list = scopeReturning([RULE_ROW]);
    expect(
      await repository.listForScope(list.scope, 'team-1', filter, {
        limit: 900,
        offset: 0,
      }),
    ).toHaveLength(1);
    expect(list.run.mock.calls[0]?.[1]).toContain(100);
    const count = scopeReturning([{ count: 3 }]);
    expect(await repository.countForScope(count.scope, 'team-1', filter)).toBe(
      3,
    );
    const empty = scopeReturning([]);
    expect(await repository.countForScope(empty.scope, 'team-1', filter)).toBe(
      0,
    );
  });

  it('upserts an acknowledgement', async () => {
    const { scope, run } = scopeReturning([ACK_ROW]);
    expect(
      (
        await repository.upsertAcknowledgement(scope, {
          id: 'ack-1',
          teamId: 'team-1',
          ruleId: 'rule-1',
          membershipId: 'member-1',
          ruleVersion: 1,
          now: NOW,
        })
      ).ruleVersion,
    ).toBe(1);
    expect(String(run.mock.calls[0]?.[0])).toContain('ON CONFLICT');
  });

  it('reads the caller’s acks for a set of rule ids without a query on empty input', async () => {
    const { scope, run } = scopeReturning([ACK_ROW]);
    expect(
      await repository.listAcknowledgementsForMembership(
        scope,
        'team-1',
        'member-1',
        ['rule-1', 'rule-2'],
      ),
    ).toHaveLength(1);
    expect(String(run.mock.calls[0]?.[0])).toContain('ANY($3::uuid[])');
    const empty = scopeReturning([]);
    expect(
      await repository.listAcknowledgementsForMembership(
        empty.scope,
        'team-1',
        'member-1',
        [],
      ),
    ).toEqual([]);
    expect(empty.run).not.toHaveBeenCalled();
  });

  it('bounds the compliance page of one rule version and counts it', async () => {
    const list = scopeReturning([ACK_ROW]);
    expect(
      await repository.listAcknowledgementsForRule(
        list.scope,
        'team-1',
        'rule-1',
        {
          limit: 900,
          offset: 0,
        },
      ),
    ).toHaveLength(1);
    expect(list.run.mock.calls[0]?.[1]).toContain(100);
    expect(String(list.run.mock.calls[0]?.[0])).toContain(
      '"acknowledged_at" DESC',
    );
    const count = scopeReturning([{ count: 7 }]);
    expect(
      await repository.countAcknowledgementsForRule(
        count.scope,
        'team-1',
        'rule-1',
      ),
    ).toBe(7);
  });
});

describe('DisciplineRepository', () => {
  const repository = new DisciplineRepository();
  const newCase = {
    id: 'case-1',
    teamId: 'team-1',
    membershipId: 'member-1',
    ruleId: null,
    severity: DisciplineSeverity.Minor,
    factSummary: 'x',
    evidenceReference: null,
    privateNotes: null,
    action: DisciplineAction.None,
    dueDate: null,
    openedBy: 'user-1',
    retentionExpiresAt: NOW,
    now: NOW,
  };

  it('inserts a case, resolves it, and guards a transition', async () => {
    const inserted = scopeReturning([CASE_ROW]);
    expect((await repository.insert(inserted.scope, newCase)).status).toBe(
      DisciplineStatus.Open,
    );
    const found = scopeReturning([CASE_ROW]);
    expect(
      (await repository.findForWrite(found.scope, 'team-1', 'case-1'))?.caseId,
    ).toBe('case-1');
    const applied = scopeReturning([{ ...CASE_ROW, status: 'resolved' }]);
    expect(
      (
        await repository.applyStatusChange(applied.scope, {
          id: 'case-1',
          teamId: 'team-1',
          expectedRecordVersion: 1,
          toStatus: DisciplineStatus.Resolved,
          action: DisciplineAction.Warning,
          memberResponse: null,
          appealReason: null,
          resolution: 'done',
          reviewedBy: 'user-2',
          resolvedBy: 'user-2',
          respondedAt: null,
          reviewedAt: NOW,
          appealedAt: null,
          resolvedAt: NOW,
          expungedAt: null,
          now: NOW,
        })
      )?.status,
    ).toBe(DisciplineStatus.Resolved);
    const stale = scopeReturning([]);
    expect(
      await repository.applyStatusChange(stale.scope, {
        id: 'case-1',
        teamId: 'team-1',
        expectedRecordVersion: 9,
        toStatus: DisciplineStatus.Resolved,
        action: DisciplineAction.None,
        memberResponse: null,
        appealReason: null,
        resolution: null,
        reviewedBy: null,
        resolvedBy: null,
        respondedAt: null,
        reviewedAt: null,
        appealedAt: null,
        resolvedAt: null,
        expungedAt: null,
        now: NOW,
      }),
    ).toBeNull();
  });

  it('throws when a case write returns no row', async () => {
    const { scope } = scopeReturning([]);
    await expect(repository.insert(scope, newCase)).rejects.toThrow(
      /discipline write/u,
    );
  });

  it('bounds the list and count with the severity filter', async () => {
    const filter = {
      membershipId: null,
      status: null,
      severity: DisciplineSeverity.Major,
    };
    const list = scopeReturning([CASE_ROW]);
    expect(
      await repository.listForScope(list.scope, 'team-1', filter, {
        limit: 900,
        offset: 0,
      }),
    ).toHaveLength(1);
    expect(list.run.mock.calls[0]?.[1]).toContain(100);
    const count = scopeReturning([{ count: 2 }]);
    expect(await repository.countForScope(count.scope, 'team-1', filter)).toBe(
      2,
    );
  });
});

describe('GovernanceDirectoryRepository', () => {
  const repository = new GovernanceDirectoryRepository();

  it('upserts a position and ends prior appointments before a new one', async () => {
    const position = scopeReturning([POSITION_ROW]);
    expect(
      (
        await repository.insertPosition(position.scope, {
          id: 'pos-1',
          teamId: 'team-1',
          positionKey: 'team_captain',
          title: 'Team Captain',
          responsibilities: null,
          createdBy: 'user-1',
          now: NOW,
        })
      ).positionKey,
    ).toBe('team_captain');
    const ended = scopeReturning([]);
    await repository.endActiveAppointments(
      ended.scope,
      'pos-1',
      '2025-06-01',
      NOW,
    );
    expect(String(ended.run.mock.calls[0]?.[0])).toContain(`'ended'`);
    const appointed = scopeReturning([APPOINTMENT_ROW]);
    expect(
      (
        await repository.insertAppointment(appointed.scope, {
          id: 'app-1',
          teamId: 'team-1',
          positionId: 'pos-1',
          membershipId: 'member-1',
          acting: false,
          startsOn: '2025-01-01',
          endsOn: null,
          createdBy: 'user-1',
          now: NOW,
        })
      ).membershipId,
    ).toBe('member-1');
  });

  it('resolves a position and lists appointment history', async () => {
    const found = scopeReturning([POSITION_ROW]);
    expect(
      (await repository.findPosition(found.scope, 'team-1', 'pos-1'))
        ?.positionId,
    ).toBe('pos-1');
    const missing = scopeReturning([]);
    expect(
      await repository.findPosition(missing.scope, 'team-1', 'pos-9'),
    ).toBeNull();
    const list = scopeReturning([POSITION_ROW]);
    expect(
      await repository.listPositions(list.scope, 'team-1', {
        limit: 20,
        offset: 0,
      }),
    ).toHaveLength(1);
    const count = scopeReturning([{ count: 1 }]);
    expect(await repository.countPositions(count.scope, 'team-1')).toBe(1);
    const apps = scopeReturning([APPOINTMENT_ROW]);
    expect(
      await repository.listAppointments(apps.scope, 'pos-1', {
        limit: 20,
        offset: 0,
      }),
    ).toHaveLength(1);
  });
});

describe('MeetingRepository', () => {
  const repository = new MeetingRepository();

  it('inserts, resolves, and guards a meeting change', async () => {
    const inserted = scopeReturning([MEETING_ROW]);
    expect(
      (
        await repository.insert(inserted.scope, {
          id: 'meeting-1',
          teamId: 'team-1',
          title: 'Board',
          scheduledAt: NOW.toISOString(),
          agenda: null,
          visibility: MeetingVisibility.Board,
          recurrence: MeetingRecurrence.None,
          createdBy: 'user-1',
          now: NOW,
        })
      ).status,
    ).toBe(MeetingStatus.Scheduled);
    const applied = scopeReturning([{ ...MEETING_ROW, status: 'minuted' }]);
    expect(
      (
        await repository.applyStatusChange(applied.scope, {
          id: 'meeting-1',
          teamId: 'team-1',
          expectedRecordVersion: 1,
          toStatus: MeetingStatus.Minuted,
          minutes: 'notes',
          decisions: [{ ref: 'D1', text: 'ok' }],
          minutesApprovedBy: null,
          minutesApprovedAt: null,
          now: NOW,
        })
      )?.status,
    ).toBe(MeetingStatus.Minuted);
    const filter = { status: null, visibility: null };
    const list = scopeReturning([MEETING_ROW]);
    expect(
      await repository.listForScope(list.scope, 'team-1', filter, {
        limit: 20,
        offset: 0,
      }),
    ).toHaveLength(1);
    const count = scopeReturning([{ count: 1 }]);
    expect(await repository.countForScope(count.scope, 'team-1', filter)).toBe(
      1,
    );
  });

  it('throws when a meeting write returns no row', async () => {
    const { scope } = scopeReturning([]);
    await expect(
      repository.insert(scope, {
        id: 'meeting-1',
        teamId: 'team-1',
        title: 'Board',
        scheduledAt: NOW.toISOString(),
        agenda: null,
        visibility: MeetingVisibility.Board,
        recurrence: MeetingRecurrence.None,
        createdBy: 'user-1',
        now: NOW,
      }),
    ).rejects.toThrow(/meeting write/u);
  });
});

describe('TaskRepository', () => {
  const repository = new TaskRepository();

  it('inserts, resolves, guards, lists, and counts a task', async () => {
    const inserted = scopeReturning([TASK_ROW]);
    expect(
      (
        await repository.insert(inserted.scope, {
          id: 'task-1',
          teamId: 'team-1',
          meetingId: null,
          title: 'Book',
          description: null,
          ownerMembershipId: null,
          dueDate: null,
          priority: TaskPriority.Normal,
          dependsOnTaskId: null,
          createdBy: 'user-1',
          now: NOW,
        })
      ).status,
    ).toBe(TaskStatus.Open);
    const found = scopeReturning([TASK_ROW]);
    expect(
      (await repository.findForWrite(found.scope, 'team-1', 'task-1'))?.taskId,
    ).toBe('task-1');
    const applied = scopeReturning([{ ...TASK_ROW, status: 'completed' }]);
    expect(
      (
        await repository.applyStatusChange(applied.scope, {
          id: 'task-1',
          teamId: 'team-1',
          expectedRecordVersion: 1,
          toStatus: TaskStatus.Completed,
          ownerMembershipId: null,
          completedAt: NOW,
          now: NOW,
        })
      )?.status,
    ).toBe(TaskStatus.Completed);
    const filter = {
      status: null,
      ownerMembershipId: null,
      meetingId: null,
    };
    const list = scopeReturning([TASK_ROW]);
    expect(
      await repository.listForScope(list.scope, 'team-1', filter, {
        limit: 900,
        offset: 0,
      }),
    ).toHaveLength(1);
    expect(list.run.mock.calls[0]?.[1]).toContain(100);
    const count = scopeReturning([{ count: 4 }]);
    expect(await repository.countForScope(count.scope, 'team-1', filter)).toBe(
      4,
    );
  });

  it('throws when a task write returns no row', async () => {
    const { scope } = scopeReturning([]);
    await expect(
      repository.insert(scope, {
        id: 'task-1',
        teamId: 'team-1',
        meetingId: null,
        title: 'Book',
        description: null,
        ownerMembershipId: null,
        dueDate: null,
        priority: TaskPriority.Normal,
        dependsOnTaskId: null,
        createdBy: 'user-1',
        now: NOW,
      }),
    ).rejects.toThrow(/task write/u);
  });
});
