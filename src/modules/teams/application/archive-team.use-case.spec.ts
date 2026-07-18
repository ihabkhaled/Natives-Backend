import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TeamNotFoundError } from '../errors/team-not-found.error';
import { ResourceStatus } from '../model/teams.enums';
import type { Team } from '../model/teams.types';
import { ArchiveTeamUseCase } from './archive-team.use-case';

const NOW = new Date('2026-06-01T12:00:00.000Z');
const ACTOR = { userId: 'admin-1', email: 'a@example.test', roles: [] };
const SCOPE = {} as never;

function team(overrides: Partial<Team> = {}): Team {
  return {
    id: 'team-1',
    slug: 'natives',
    name: 'Ultimate Natives',
    locale: 'en',
    timezone: 'Africa/Cairo',
    primaryColor: null,
    logoMediaKey: null,
    status: ResourceStatus.Active,
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
  const teams = { findById: vi.fn(), archive: vi.fn() };
  const audit = { append: vi.fn() };
  const useCase = new ArchiveTeamUseCase(
    unitOfWork as never,
    clock,
    idGenerator,
    teams as never,
    audit,
  );
  return { useCase, teams, audit };
}

describe('ArchiveTeamUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('archives an active team and audits', async () => {
    harness.teams.findById.mockResolvedValue(team());
    harness.teams.archive.mockResolvedValue(
      team({ status: ResourceStatus.Archived }),
    );

    const result = await harness.useCase.execute(ACTOR, 'team-1');

    expect(result.status).toBe(ResourceStatus.Archived);
    expect(harness.audit.append).toHaveBeenCalledOnce();
  });

  it('reports not-found for a missing or archived team', async () => {
    harness.teams.findById.mockResolvedValue(null);
    await expect(
      harness.useCase.execute(ACTOR, 'team-1'),
    ).rejects.toBeInstanceOf(TeamNotFoundError);

    harness.teams.findById.mockResolvedValue(
      team({ status: ResourceStatus.Archived }),
    );
    await expect(
      harness.useCase.execute(ACTOR, 'team-1'),
    ).rejects.toBeInstanceOf(TeamNotFoundError);
  });

  it('reports not-found when the guarded archive loses a race', async () => {
    harness.teams.findById.mockResolvedValue(team());
    harness.teams.archive.mockResolvedValue(null);
    await expect(
      harness.useCase.execute(ACTOR, 'team-1'),
    ).rejects.toBeInstanceOf(TeamNotFoundError);
  });
});
