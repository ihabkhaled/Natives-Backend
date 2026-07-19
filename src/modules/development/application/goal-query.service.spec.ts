import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DevelopmentGoalNotFoundError } from '../errors/development-goal-not-found.error';
import { GoalStatus } from '../model/goal.enums';
import type { DevelopmentGoal, GoalAction } from '../model/goal.types';
import { GoalQueryService } from './goal-query.service';

function goal(id: string): DevelopmentGoal {
  return {
    id,
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
    recordVersion: 1,
    createdBy: 'coach-1',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };
}

const ACTION: GoalAction = {
  description: 'drill',
  sortOrder: 0,
  done: false,
  dueDate: null,
};

function build() {
  const tx = {} as never;
  const unitOfWork = {
    runInTransaction: vi.fn((cb: (t: never) => unknown) => cb(tx)),
  };
  const repository = {
    listForTeam: vi.fn(),
    countForTeam: vi.fn(),
    listForMember: vi.fn(),
    countForMember: vi.fn(),
    findForWrite: vi.fn(),
    findActions: vi.fn(),
    actionsByGoal: vi.fn(),
  };
  return {
    repository,
    service: new GoalQueryService(unitOfWork as never, repository as never),
  };
}

describe('GoalQueryService', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('assembles a team page with per-goal actions', async () => {
    harness.repository.listForTeam.mockResolvedValue([
      goal('g-1'),
      goal('g-2'),
    ]);
    harness.repository.countForTeam.mockResolvedValue(2);
    harness.repository.actionsByGoal.mockResolvedValue(
      new Map([['g-1', [ACTION]]]),
    );
    const page = await harness.service.listForTeam('team-1', {
      limit: 20,
      offset: 0,
    });
    expect(page.total).toBe(2);
    expect(page.items[0]?.actions).toHaveLength(1);
    expect(page.items[1]?.actions).toHaveLength(0);
  });

  it('assembles a member page', async () => {
    harness.repository.listForMember.mockResolvedValue([goal('g-1')]);
    harness.repository.countForMember.mockResolvedValue(1);
    harness.repository.actionsByGoal.mockResolvedValue(new Map());
    const page = await harness.service.listForMember('team-1', 'p-1', {
      limit: 20,
      offset: 0,
    });
    expect(page.total).toBe(1);
  });

  it('returns a goal detail with actions', async () => {
    harness.repository.findForWrite.mockResolvedValue(goal('g-1'));
    harness.repository.findActions.mockResolvedValue([ACTION]);
    const detail = await harness.service.getDetail('team-1', 'g-1');
    expect(detail.actions).toHaveLength(1);
  });

  it('hides a missing goal detail as not-found', async () => {
    harness.repository.findForWrite.mockResolvedValue(null);
    await expect(
      harness.service.getDetail('team-1', 'g-x'),
    ).rejects.toBeInstanceOf(DevelopmentGoalNotFoundError);
  });
});
