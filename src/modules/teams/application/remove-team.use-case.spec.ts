import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OptimisticConflictError } from '../errors/optimistic-conflict.error';
import { TeamInvalidTransitionError } from '../errors/team-invalid-transition.error';
import { TeamNotFoundError } from '../errors/team-not-found.error';
import { TeamStatus } from '../model/teams.enums';
import type { Team } from '../model/teams.types';
import { RemoveTeamUseCase } from './remove-team.use-case';

const NOW = new Date('2026-06-01T12:00:00.000Z');
const ACTOR = { userId: 'admin-1', email: 'a@example.test', roles: [] };
const SCOPE = {} as never;

function team(overrides: Partial<Team> = {}): Team {
  return {
    id: 'team-1',
    slug: 'un',
    name: 'Ultimate Natives',
    locale: 'en',
    timezone: 'Africa/Cairo',
    primaryColor: null,
    logoMediaKey: null,
    status: TeamStatus.Archived,
    deletedAt: null,
    createdBy: 'admin-1',
    updatedBy: null,
    createdAt: NOW,
    updatedAt: NOW,
    version: 3,
    ...overrides,
  };
}

function build() {
  const unitOfWork = {
    runInTransaction: vi.fn((op: (scope: never) => unknown) => op(SCOPE)),
  };
  const clock = { now: () => NOW, uptime: () => 0 };
  const idGenerator = { generate: vi.fn().mockReturnValue('generated') };
  const teams = { findById: vi.fn(), softRemove: vi.fn() };
  const audit = { append: vi.fn() };
  const useCase = new RemoveTeamUseCase(
    unitOfWork as never,
    clock,
    idGenerator,
    teams as never,
    audit,
  );
  return { audit, teams, useCase };
}

describe('RemoveTeamUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('soft-removes an archived team and audits it', async () => {
    harness.teams.findById.mockResolvedValue(team());
    harness.teams.softRemove.mockResolvedValue(
      team({ deletedAt: NOW, version: 4 }),
    );

    const result = await harness.useCase.execute(ACTOR, 'team-1', {
      expectedVersion: 3,
    });

    expect(result.deletedAt).toEqual(NOW);
    expect(harness.teams.softRemove).toHaveBeenCalledWith(SCOPE, {
      id: 'team-1',
      updatedBy: 'admin-1',
      expectedVersion: 3,
      now: NOW,
    });
    expect(harness.audit.append).toHaveBeenCalledOnce();
  });

  it('reports not-found for a missing team', async () => {
    harness.teams.findById.mockResolvedValue(null);

    await expect(
      harness.useCase.execute(ACTOR, 'team-1', { expectedVersion: null }),
    ).rejects.toBeInstanceOf(TeamNotFoundError);
  });

  it('refuses to remove a team that is not archived yet', async () => {
    harness.teams.findById.mockResolvedValue(
      team({ status: TeamStatus.Active }),
    );

    await expect(
      harness.useCase.execute(ACTOR, 'team-1', { expectedVersion: null }),
    ).rejects.toBeInstanceOf(TeamInvalidTransitionError);
    expect(harness.teams.softRemove).not.toHaveBeenCalled();
  });

  it('reports a version conflict when the guarded removal misses', async () => {
    harness.teams.findById.mockResolvedValue(team());
    harness.teams.softRemove.mockResolvedValue(null);

    await expect(
      harness.useCase.execute(ACTOR, 'team-1', { expectedVersion: 99 }),
    ).rejects.toBeInstanceOf(OptimisticConflictError);
  });
});
