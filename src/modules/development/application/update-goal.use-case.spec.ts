import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DevelopmentValidationError } from '../errors/development-validation.error';
import { GoalVersionConflictError } from '../errors/goal-version-conflict.error';
import { GoalStatus } from '../model/goal.enums';
import type { DevelopmentGoal, GoalContent } from '../model/goal.types';
import { UpdateGoalUseCase } from './update-goal.use-case';

const NOW = new Date('2026-03-01T00:00:00.000Z');
const actor = { userId: 'coach-1' } as never;

function content(title = 'Goal'): GoalContent {
  return {
    feedbackId: null,
    metricDefinitionId: null,
    ownerUserId: null,
    title,
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
    progressValue: null,
    progressNote: null,
    evidence: null,
    status: GoalStatus.Active,
    dueDate: null,
    completedAt: null,
    reviewNote: null,
    reviewedAt: null,
    reviewedBy: null,
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
  const idGenerator = { generate: vi.fn(() => 'act-1') };
  const lookup = { requireForWrite: vi.fn(() => goal()) };
  const repository = {
    updateContent: vi.fn(() => (conflict ? null : goal())),
    clearActions: vi.fn(),
    insertActions: vi.fn(),
    findActions: vi.fn(() => []),
  };
  const audit = { record: vi.fn() };
  const events = { enqueue: vi.fn() };
  const useCase = new UpdateGoalUseCase(
    unitOfWork as never,
    clock as never,
    idGenerator,
    lookup as never,
    repository as never,
    audit as never,
    events as never,
  );
  return { repository, events, useCase };
}

function run(harness: ReturnType<typeof build>, title = 'Goal') {
  return harness.useCase.execute(actor, 'team-1', 'goal-1', {
    expectedRecordVersion: 2,
    content: content(title),
  });
}

describe('UpdateGoalUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('updates content, swaps actions, and emits an event', async () => {
    await run(harness);
    expect(harness.repository.clearActions).toHaveBeenCalled();
    expect(harness.events.enqueue.mock.calls[0]?.[1].eventType).toBe(
      'development.goal.updated.v1',
    );
  });

  it('rejects invalid content', async () => {
    await expect(run(harness, ' ')).rejects.toBeInstanceOf(
      DevelopmentValidationError,
    );
  });

  it('surfaces a version conflict', async () => {
    harness = build(true);
    await expect(run(harness)).rejects.toBeInstanceOf(GoalVersionConflictError);
  });
});
