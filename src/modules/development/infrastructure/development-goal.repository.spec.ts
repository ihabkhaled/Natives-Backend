import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GoalStatus } from '../model/goal.enums';
import type { DevelopmentGoalRow } from '../model/goal.rows';
import type { GoalContent, NewDevelopmentGoal } from '../model/goal.types';
import { DevelopmentGoalRepository } from './development-goal.repository';

const NOW = new Date('2026-03-01T00:00:00.000Z');

function build() {
  const scope = { run: vi.fn() };
  return { scope, repository: new DevelopmentGoalRepository() };
}

function goalRow(
  overrides: Partial<DevelopmentGoalRow> = {},
): DevelopmentGoalRow {
  return {
    id: 'goal-1',
    team_id: 'team-1',
    season_id: null,
    membership_id: 'mem-1',
    feedback_id: null,
    metric_definition_id: null,
    owner_user_id: null,
    title: 'Goal',
    description: null,
    measurable_target: null,
    target_value: null,
    baseline_value: null,
    progress_value: null,
    progress_note: null,
    evidence: null,
    status: 'proposed',
    due_date: null,
    completed_at: null,
    review_note: null,
    reviewed_at: null,
    reviewed_by: null,
    record_version: 1,
    created_by: 'coach-1',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    deleted_at: null,
    ...overrides,
  };
}

function content(): GoalContent {
  return {
    feedbackId: null,
    metricDefinitionId: null,
    ownerUserId: null,
    title: 'Goal',
    description: null,
    measurableTarget: null,
    targetValue: null,
    baselineValue: null,
    progressValue: null,
    progressNote: null,
    evidence: null,
    dueDate: null,
    actions: [],
  };
}

function newGoal(): NewDevelopmentGoal {
  return {
    id: 'goal-1',
    teamId: 'team-1',
    seasonId: null,
    membershipId: 'mem-1',
    status: GoalStatus.Proposed,
    content: content(),
    createdBy: 'coach-1',
    now: NOW,
  };
}

describe('DevelopmentGoalRepository', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('inserts a goal and throws when no row returns', async () => {
    harness.scope.run.mockResolvedValueOnce([goalRow()]);
    await expect(
      harness.repository.insertGoal(harness.scope as never, newGoal()),
    ).resolves.not.toBeNull();
    harness.scope.run.mockResolvedValueOnce([]);
    await expect(
      harness.repository.insertGoal(harness.scope as never, newGoal()),
    ).rejects.toThrow('Expected a returned row');
  });

  it('skips the action insert when there are none', async () => {
    await harness.repository.insertActions(harness.scope as never, []);
    expect(harness.scope.run).not.toHaveBeenCalled();
  });

  it('inserts action rows via a recordset', async () => {
    harness.scope.run.mockResolvedValueOnce(undefined);
    await harness.repository.insertActions(harness.scope as never, [
      {
        id: 'act-1',
        goalId: 'goal-1',
        description: 'drill',
        sortOrder: 0,
        done: false,
        dueDate: null,
        now: NOW,
      },
    ]);
    expect(String(harness.scope.run.mock.calls[0]?.[0])).toContain(
      'jsonb_to_recordset',
    );
  });

  it('clears actions for a goal', async () => {
    harness.scope.run.mockResolvedValueOnce(undefined);
    await harness.repository.clearActions(harness.scope as never, 'goal-1');
    expect(harness.scope.run.mock.calls[0]?.[1]).toEqual(['goal-1']);
  });

  it('finds a live goal for write or returns null', async () => {
    harness.scope.run.mockResolvedValueOnce([goalRow()]);
    await expect(
      harness.repository.findForWrite(
        harness.scope as never,
        'team-1',
        'goal-1',
      ),
    ).resolves.not.toBeNull();
    harness.scope.run.mockResolvedValueOnce([]);
    await expect(
      harness.repository.findForWrite(
        harness.scope as never,
        'team-1',
        'goal-x',
      ),
    ).resolves.toBeNull();
  });

  it('reads ordered actions for a goal', async () => {
    harness.scope.run.mockResolvedValueOnce([
      {
        id: 'act-1',
        goal_id: 'goal-1',
        description: 'drill',
        sort_order: 0,
        done: false,
        due_date: null,
        created_at: '2026-01-01T00:00:00.000Z',
      },
    ]);
    const actions = await harness.repository.findActions(
      harness.scope as never,
      'goal-1',
    );
    expect(actions).toHaveLength(1);
  });

  it('updates content or reports a conflict as null', async () => {
    harness.scope.run.mockResolvedValueOnce([goalRow({ record_version: 2 })]);
    await expect(
      harness.repository.updateContent(harness.scope as never, {
        id: 'goal-1',
        teamId: 'team-1',
        expectedRecordVersion: 1,
        content: content(),
        now: NOW,
      }),
    ).resolves.not.toBeNull();
    harness.scope.run.mockResolvedValueOnce([]);
    await expect(
      harness.repository.updateContent(harness.scope as never, {
        id: 'goal-1',
        teamId: 'team-1',
        expectedRecordVersion: 9,
        content: content(),
        now: NOW,
      }),
    ).resolves.toBeNull();
  });

  it('applies a review or reports a conflict as null', async () => {
    harness.scope.run.mockResolvedValueOnce([goalRow({ review_note: 'ok' })]);
    await expect(
      harness.repository.applyReview(harness.scope as never, {
        id: 'goal-1',
        teamId: 'team-1',
        expectedRecordVersion: 1,
        reviewNote: 'ok',
        progressValue: 5,
        progressNote: null,
        evidence: null,
        reviewedBy: 'coach-1',
        now: NOW,
      }),
    ).resolves.not.toBeNull();
    harness.scope.run.mockResolvedValueOnce([]);
    await expect(
      harness.repository.applyReview(harness.scope as never, {
        id: 'goal-1',
        teamId: 'team-1',
        expectedRecordVersion: 9,
        reviewNote: null,
        progressValue: null,
        progressNote: null,
        evidence: null,
        reviewedBy: 'coach-1',
        now: NOW,
      }),
    ).resolves.toBeNull();
  });

  it('applies a status change or reports a conflict as null', async () => {
    harness.scope.run.mockResolvedValueOnce([goalRow({ status: 'achieved' })]);
    await expect(
      harness.repository.applyStatusChange(harness.scope as never, {
        id: 'goal-1',
        teamId: 'team-1',
        toStatus: GoalStatus.Achieved,
        expectedRecordVersion: 1,
        completedAt: NOW,
        now: NOW,
      }),
    ).resolves.not.toBeNull();
    harness.scope.run.mockResolvedValueOnce([]);
    await expect(
      harness.repository.applyStatusChange(harness.scope as never, {
        id: 'goal-1',
        teamId: 'team-1',
        toStatus: GoalStatus.Cancelled,
        expectedRecordVersion: 9,
        completedAt: null,
        now: NOW,
      }),
    ).resolves.toBeNull();
  });

  it('lists and counts team goals', async () => {
    harness.scope.run.mockResolvedValueOnce([goalRow()]);
    await expect(
      harness.repository.listForTeam(harness.scope as never, 'team-1', {
        limit: 20,
        offset: 0,
      }),
    ).resolves.toHaveLength(1);
    harness.scope.run.mockResolvedValueOnce([{ count: 4 }]);
    await expect(
      harness.repository.countForTeam(harness.scope as never, 'team-1'),
    ).resolves.toBe(4);
    harness.scope.run.mockResolvedValueOnce([]);
    await expect(
      harness.repository.countForTeam(harness.scope as never, 'team-1'),
    ).resolves.toBe(0);
  });

  it('lists and counts a member’s goals', async () => {
    harness.scope.run.mockResolvedValueOnce([goalRow()]);
    await expect(
      harness.repository.listForMember(
        harness.scope as never,
        'team-1',
        'p-1',
        {
          limit: 20,
          offset: 0,
        },
      ),
    ).resolves.toHaveLength(1);
    harness.scope.run.mockResolvedValueOnce([{ count: 2 }]);
    await expect(
      harness.repository.countForMember(
        harness.scope as never,
        'team-1',
        'p-1',
      ),
    ).resolves.toBe(2);
    harness.scope.run.mockResolvedValueOnce([]);
    await expect(
      harness.repository.countForMember(
        harness.scope as never,
        'team-1',
        'p-1',
      ),
    ).resolves.toBe(0);
  });

  it('groups actions by goal and short-circuits on empty ids', async () => {
    await expect(
      harness.repository.actionsByGoal(harness.scope as never, []),
    ).resolves.toEqual(new Map());
    expect(harness.scope.run).not.toHaveBeenCalled();

    harness.scope.run.mockResolvedValueOnce([
      {
        id: 'act-1',
        goal_id: 'goal-1',
        description: 'a',
        sort_order: 0,
        done: false,
        due_date: null,
        created_at: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'act-2',
        goal_id: 'goal-1',
        description: 'b',
        sort_order: 1,
        done: false,
        due_date: null,
        created_at: '2026-01-01T00:00:00.000Z',
      },
    ]);
    const grouped = await harness.repository.actionsByGoal(
      harness.scope as never,
      ['goal-1'],
    );
    expect(grouped.get('goal-1')).toHaveLength(2);
  });

  it('lists overdue active goals before a date bound', async () => {
    harness.scope.run.mockResolvedValueOnce([
      {
        id: 'goal-1',
        team_id: 'team-1',
        season_id: null,
        membership_id: 'mem-1',
        reminder_user_id: 'player-1',
        due_date: '2026-01-01',
      },
    ]);
    const rows = await harness.repository.listOverdue(
      harness.scope as never,
      'team-1',
      '2026-06-15',
    );
    expect(rows).toHaveLength(1);
    expect(harness.scope.run.mock.calls[0]?.[1]?.[1]).toBe('2026-06-15');
  });
});
