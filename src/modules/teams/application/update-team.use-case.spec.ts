import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OptimisticConflictError } from '../errors/optimistic-conflict.error';
import { TeamNotFoundError } from '../errors/team-not-found.error';
import { TeamStatus } from '../model/teams.enums';
import type { Team } from '../model/teams.types';
import { UpdateTeamUseCase } from './update-team.use-case';

const NOW = new Date('2026-06-01T12:00:00.000Z');
const ACTOR = { userId: 'admin-1', email: 'a@example.test', roles: [] };
const SCOPE = {} as never;

const COMMAND = {
  name: 'Renamed',
  locale: null,
  timezone: null,
  primaryColor: null,
  logoMediaKey: null,
  expectedVersion: 1,
};

function team(overrides: Partial<Team> = {}): Team {
  return {
    id: 'team-1',
    slug: 'natives',
    name: 'Ultimate Natives',
    locale: 'en',
    timezone: 'Africa/Cairo',
    primaryColor: null,
    logoMediaKey: null,
    status: TeamStatus.Active,
    deletedAt: null,
    createdBy: 'admin-1',
    updatedBy: null,
    createdAt: NOW,
    updatedAt: NOW,
    version: 1,
    ...overrides,
  };
}

function build() {
  const unitOfWork = {
    runInTransaction: vi.fn((op: (scope: never) => unknown) => op(SCOPE)),
  };
  const clock = { now: () => NOW, uptime: () => 0 };
  const idGenerator = { generate: vi.fn().mockReturnValue('generated') };
  const teams = { findById: vi.fn(), update: vi.fn() };
  const audit = { append: vi.fn() };
  const useCase = new UpdateTeamUseCase(
    unitOfWork as never,
    clock,
    idGenerator,
    teams as never,
    audit,
  );
  return { useCase, teams, audit };
}

describe('UpdateTeamUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('updates an active team and audits', async () => {
    harness.teams.findById.mockResolvedValue(team());
    harness.teams.update.mockResolvedValue(
      team({ name: 'Renamed', version: 2 }),
    );

    const result = await harness.useCase.execute(ACTOR, 'team-1', COMMAND);

    expect(result.name).toBe('Renamed');
    expect(harness.audit.append).toHaveBeenCalledOnce();
  });

  it('reports not-found for a missing team', async () => {
    harness.teams.findById.mockResolvedValue(null);
    await expect(
      harness.useCase.execute(ACTOR, 'team-1', COMMAND),
    ).rejects.toBeInstanceOf(TeamNotFoundError);
  });

  it('reports not-found for an archived team', async () => {
    harness.teams.findById.mockResolvedValue(
      team({ status: TeamStatus.Archived }),
    );
    await expect(
      harness.useCase.execute(ACTOR, 'team-1', COMMAND),
    ).rejects.toBeInstanceOf(TeamNotFoundError);
    expect(harness.teams.update).not.toHaveBeenCalled();
  });

  it('reports a version conflict when the guarded update misses', async () => {
    harness.teams.findById.mockResolvedValue(team());
    harness.teams.update.mockResolvedValue(null);
    await expect(
      harness.useCase.execute(ACTOR, 'team-1', COMMAND),
    ).rejects.toBeInstanceOf(OptimisticConflictError);
  });
});
