import { describe, expect, it } from 'vitest';

import { GoalStatus } from '../model/goal.enums';
import type { DevelopmentGoal, GoalContent } from '../model/goal.types';
import {
  buildActionRows,
  buildGoalAudit,
  buildGoalCreatedEvent,
  buildGoalOverdueReminderEvent,
  buildGoalUpdatedEvent,
  buildNewGoal,
} from './goal.builders';

const NOW = new Date('2026-03-01T00:00:00.000Z');

function content(overrides: Partial<GoalContent> = {}): GoalContent {
  return {
    feedbackId: null,
    metricDefinitionId: 'metric-1',
    ownerUserId: 'player-1',
    title: 'Improve backhand',
    description: 'work the flick',
    measurableTarget: '90% hucks',
    targetValue: 0.9,
    baselineValue: 0.5,
    progressValue: null,
    progressNote: null,
    evidence: null,
    dueDate: '2026-08-01',
    actions: [],
    ...overrides,
  };
}

function goal(overrides: Partial<DevelopmentGoal> = {}): DevelopmentGoal {
  return {
    id: 'goal-1',
    teamId: 'team-1',
    seasonId: null,
    membershipId: 'mem-1',
    feedbackId: null,
    metricDefinitionId: 'metric-1',
    ownerUserId: 'player-1',
    title: 'Improve backhand',
    description: 'secret plan detail',
    measurableTarget: '90% hucks',
    targetValue: 0.9,
    baselineValue: 0.5,
    progressValue: null,
    progressNote: null,
    evidence: null,
    status: GoalStatus.Active,
    dueDate: '2026-08-01',
    completedAt: null,
    reviewNote: null,
    reviewedAt: null,
    reviewedBy: null,
    recordVersion: 1,
    createdBy: 'coach-1',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe('goal write builders', () => {
  it('builds a proposed goal from a create command', () => {
    const created = buildNewGoal(
      'goal-1',
      'team-1',
      { membershipId: 'mem-1', seasonId: null, content: content() },
      'coach-1',
      NOW,
    );
    expect(created.status).toBe(GoalStatus.Proposed);
    expect(created.createdBy).toBe('coach-1');
    expect(created.content.targetValue).toBe(0.9);
  });

  it('builds action rows with generated ids', () => {
    let counter = 0;
    const nextId = (): string => {
      counter += 1;
      return `act-${counter}`;
    };
    const rows = buildActionRows(
      'goal-1',
      [
        { description: 'a', sortOrder: 0, done: false, dueDate: null },
        { description: 'b', sortOrder: 1, done: true, dueDate: '2026-07-01' },
      ],
      nextId,
      NOW,
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]?.id).toBe('act-1');
    expect(rows[1]?.done).toBe(true);
  });
});

describe('goal audit and events never leak free text', () => {
  it('records only status and version in the audit diff', () => {
    const audit = buildGoalAudit('development.goal.updated', 'coach-1', goal());
    expect(JSON.stringify(audit)).not.toContain('secret plan detail');
    expect(audit.diff).toEqual({ status: 'active', recordVersion: 1 });
  });

  it('emits privacy-safe created and updated events', () => {
    const created = buildGoalCreatedEvent(goal());
    expect(created.eventType).toBe('development.goal.created.v1');
    expect(JSON.stringify(created)).not.toContain('secret plan detail');
    expect(created.payload).not.toHaveProperty('title');

    const updated = buildGoalUpdatedEvent(goal(), 'coach-2');
    expect(updated.eventType).toBe('development.goal.updated.v1');
    expect(updated.actorUserId).toBe('coach-2');
  });

  it('emits a privacy-safe overdue reminder event', () => {
    const event = buildGoalOverdueReminderEvent({
      id: 'goal-1',
      team_id: 'team-1',
      season_id: null,
      membership_id: 'mem-1',
      reminder_user_id: 'player-1',
      due_date: '2026-01-01',
    });
    expect(event.eventType).toBe('development.goal.overdueReminder.v1');
    expect(event.payload).toEqual({
      goalId: 'goal-1',
      membershipId: 'mem-1',
      dueDate: '2026-01-01',
    });
  });
});
