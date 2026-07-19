import { describe, expect, it, vi } from 'vitest';

import { GoalVersionConflictError } from '../errors/goal-version-conflict.error';
import { GoalStatus } from '../model/goal.enums';
import type { DevelopmentGoal } from '../model/goal.types';
import { ReviewGoalUseCase } from './review-goal.use-case';

const NOW = new Date('2026-03-01T00:00:00.000Z');
const actor = { userId: 'coach-1' } as never;

function goal(): DevelopmentGoal {
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
    progressValue: 5,
    progressNote: null,
    evidence: null,
    status: GoalStatus.Active,
    dueDate: null,
    completedAt: null,
    reviewNote: 'ok',
    reviewedAt: NOW,
    reviewedBy: 'coach-1',
    recordVersion: 2,
    createdBy: 'coach-1',
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function build(conflict = false) {
  const tx = {} as never;
  const unitOfWork = {
    runInTransaction: vi.fn((cb: (t: never) => unknown) => cb(tx)),
  };
  const clock = { now: vi.fn(() => NOW) };
  const lookup = { requireForWrite: vi.fn(() => goal()) };
  const repository = {
    applyReview: vi.fn(() => (conflict ? null : goal())),
    findActions: vi.fn(() => []),
  };
  const audit = { record: vi.fn() };
  const events = { enqueue: vi.fn() };
  const useCase = new ReviewGoalUseCase(
    unitOfWork as never,
    clock as never,
    lookup as never,
    repository as never,
    audit as never,
    events as never,
  );
  return { repository, events, useCase };
}

function run(harness: ReturnType<typeof build>) {
  return harness.useCase.execute(actor, 'team-1', 'goal-1', {
    expectedRecordVersion: 2,
    reviewNote: 'ok',
    progressValue: 5,
    progressNote: null,
    evidence: null,
  });
}

describe('ReviewGoalUseCase', () => {
  it('records a review and emits an event', async () => {
    const harness = build();
    await run(harness);
    expect(harness.repository.applyReview).toHaveBeenCalled();
    expect(harness.events.enqueue.mock.calls[0]?.[1].eventType).toBe(
      'development.goal.updated.v1',
    );
  });

  it('surfaces a version conflict', async () => {
    const harness = build(true);
    await expect(run(harness)).rejects.toBeInstanceOf(GoalVersionConflictError);
  });
});
