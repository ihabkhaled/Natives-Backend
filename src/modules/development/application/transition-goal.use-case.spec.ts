import { describe, expect, it, vi } from 'vitest';

import { GoalInvalidTransitionError } from '../errors/goal-invalid-transition.error';
import { GoalVersionConflictError } from '../errors/goal-version-conflict.error';
import { GoalStatus, GoalTransition } from '../model/goal.enums';
import type { DevelopmentGoal } from '../model/goal.types';
import { TransitionGoalUseCase } from './transition-goal.use-case';

const NOW = new Date('2026-03-01T00:00:00.000Z');
const actor = { userId: 'coach-1' } as never;

function goal(status: GoalStatus): DevelopmentGoal {
  return {
    id: 'goal-1',
    teamId: 'team-1',
    seasonId: null,
    membershipId: 'mem-1',
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
    status,
    dueDate: null,
    completedAt: null,
    reviewNote: null,
    reviewedAt: null,
    reviewedBy: null,
    recordVersion: 1,
    createdBy: 'coach-1',
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function build(current: DevelopmentGoal, conflict = false) {
  const tx = {} as never;
  const unitOfWork = {
    runInTransaction: vi.fn((cb: (t: never) => unknown) => cb(tx)),
  };
  const clock = { now: vi.fn(() => NOW) };
  const lookup = { requireForWrite: vi.fn(() => current) };
  const applyStatusChange = vi.fn(
    (_scope: never, change: { toStatus: GoalStatus }) =>
      conflict ? null : goal(change.toStatus),
  );
  const repository = { applyStatusChange, findActions: vi.fn(() => []) };
  const audit = { record: vi.fn() };
  const events = { enqueue: vi.fn() };
  const useCase = new TransitionGoalUseCase(
    unitOfWork as never,
    clock as never,
    lookup as never,
    repository as never,
    audit as never,
    events as never,
  );
  return { repository, events, useCase };
}

describe('TransitionGoalUseCase', () => {
  it('activates a proposed goal and emits an event', async () => {
    const harness = build(goal(GoalStatus.Proposed));
    const detail = await harness.useCase.execute(actor, 'team-1', 'goal-1', {
      transition: GoalTransition.Activate,
      expectedRecordVersion: 1,
    });
    expect(detail.goal.status).toBe(GoalStatus.Active);
    expect(harness.events.enqueue).toHaveBeenCalled();
  });

  it('stamps a completion instant when achieving', async () => {
    const harness = build(goal(GoalStatus.Active));
    await harness.useCase.execute(actor, 'team-1', 'goal-1', {
      transition: GoalTransition.Achieve,
      expectedRecordVersion: 1,
    });
    const change = harness.repository.applyStatusChange.mock.calls[0]?.[1];
    expect(change.completedAt).toBe(NOW);
  });

  it('rejects an illegal transition', async () => {
    const harness = build(goal(GoalStatus.Proposed));
    await expect(
      harness.useCase.execute(actor, 'team-1', 'goal-1', {
        transition: GoalTransition.Achieve,
        expectedRecordVersion: 1,
      }),
    ).rejects.toBeInstanceOf(GoalInvalidTransitionError);
  });

  it('surfaces a version conflict', async () => {
    const harness = build(goal(GoalStatus.Active), true);
    await expect(
      harness.useCase.execute(actor, 'team-1', 'goal-1', {
        transition: GoalTransition.Cancel,
        expectedRecordVersion: 1,
      }),
    ).rejects.toBeInstanceOf(GoalVersionConflictError);
  });
});
