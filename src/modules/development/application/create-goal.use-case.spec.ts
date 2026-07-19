import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DevelopmentValidationError } from '../errors/development-validation.error';
import { GoalStatus } from '../model/goal.enums';
import type { DevelopmentGoal, GoalContent } from '../model/goal.types';
import { CreateGoalUseCase } from './create-goal.use-case';

const NOW = new Date('2026-03-01T00:00:00.000Z');
const actor = { userId: 'coach-1' } as never;

function content(title = 'Improve backhand'): GoalContent {
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
    actions: [
      { description: 'drill', sortOrder: 0, done: false, dueDate: null },
    ],
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
    title: 'Improve backhand',
    description: null,
    measurableTarget: null,
    targetValue: null,
    baselineValue: null,
    progressValue: null,
    progressNote: null,
    evidence: null,
    status: GoalStatus.Proposed,
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

function build() {
  const tx = {} as never;
  const unitOfWork = {
    runInTransaction: vi.fn((cb: (t: never) => unknown) => cb(tx)),
  };
  const clock = { now: vi.fn(() => NOW) };
  const idGenerator = { generate: vi.fn(() => 'goal-1') };
  const scope = { validate: vi.fn(), requireMembership: vi.fn() };
  const repository = {
    insertGoal: vi.fn(() => goal()),
    insertActions: vi.fn(),
    findActions: vi.fn(() => []),
  };
  const audit = { record: vi.fn() };
  const events = { enqueue: vi.fn() };
  const useCase = new CreateGoalUseCase(
    unitOfWork as never,
    clock as never,
    idGenerator,
    scope as never,
    repository as never,
    audit as never,
    events as never,
  );
  return { scope, repository, audit, events, useCase };
}

describe('CreateGoalUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('validates, persists the goal and actions, audits, and emits an event', async () => {
    const detail = await harness.useCase.execute(actor, 'team-1', {
      membershipId: 'mem-1',
      seasonId: null,
      content: content(),
    });
    expect(harness.scope.validate).toHaveBeenCalled();
    expect(harness.repository.insertActions).toHaveBeenCalled();
    expect(harness.events.enqueue.mock.calls[0]?.[1].eventType).toBe(
      'development.goal.created.v1',
    );
    expect(detail.goal.status).toBe(GoalStatus.Proposed);
  });

  it('rejects invalid content', async () => {
    await expect(
      harness.useCase.execute(actor, 'team-1', {
        membershipId: 'mem-1',
        seasonId: null,
        content: content(' '),
      }),
    ).rejects.toBeInstanceOf(DevelopmentValidationError);
  });
});
