import { describe, expect, it } from 'vitest';

import { GoalStatus } from '../model/goal.enums';
import type { DevelopmentGoalRow, GoalActionRow } from '../model/goal.rows';
import { toDevelopmentGoal, toGoalAction } from './goal.mapper';

function row(overrides: Partial<DevelopmentGoalRow> = {}): DevelopmentGoalRow {
  return {
    id: 'goal-1',
    team_id: 'team-1',
    season_id: null,
    membership_id: 'mem-1',
    feedback_id: null,
    metric_definition_id: 'metric-1',
    owner_user_id: 'player-1',
    title: 'Improve backhand',
    description: 'work the flick',
    measurable_target: 'complete 90% of hucks',
    target_value: '0.9',
    baseline_value: '0.5',
    progress_value: null,
    progress_note: null,
    evidence: null,
    status: 'active',
    due_date: '2026-08-01',
    completed_at: null,
    review_note: null,
    reviewed_at: null,
    reviewed_by: null,
    record_version: 2,
    created_by: 'coach-1',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-02-01T00:00:00.000Z',
    deleted_at: null,
    ...overrides,
  };
}

describe('toDevelopmentGoal', () => {
  it('maps a row honouring null-not-zero numerics', () => {
    const goal = toDevelopmentGoal(row());
    expect(goal.status).toBe(GoalStatus.Active);
    expect(goal.targetValue).toBe(0.9);
    expect(goal.baselineValue).toBe(0.5);
    expect(goal.progressValue).toBeNull();
    expect(goal.dueDate).toBe('2026-08-01');
    expect(goal.completedAt).toBeNull();
  });
});

describe('toGoalAction', () => {
  it('maps an action-plan step row', () => {
    const actionRow: GoalActionRow = {
      id: 'act-1',
      goal_id: 'goal-1',
      description: 'attend clinic',
      sort_order: 3,
      done: true,
      due_date: '2026-07-01',
      created_at: '2026-01-01T00:00:00.000Z',
    };
    expect(toGoalAction(actionRow)).toEqual({
      description: 'attend clinic',
      sortOrder: 3,
      done: true,
      dueDate: '2026-07-01',
    });
  });
});
