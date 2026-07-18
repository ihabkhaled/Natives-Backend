import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TeamNotFoundError } from '../errors/team-not-found.error';
import { ResourceStatus } from '../model/teams.enums';
import type { Team } from '../model/teams.types';
import { TeamQueryService } from './team-query.service';

const NOW = new Date('2026-06-01T12:00:00.000Z');
const SCOPE = {} as never;

const TEAM: Team = {
  id: 'team-1',
  slug: 'natives',
  name: 'Ultimate Natives',
  locale: 'en',
  timezone: 'Africa/Cairo',
  primaryColor: null,
  logoMediaKey: null,
  status: ResourceStatus.Active,
  createdBy: null,
  updatedBy: null,
  createdAt: NOW,
  updatedAt: NOW,
  version: 1,
};

function build() {
  const unitOfWork = {
    runInTransaction: vi.fn((op: (scope: never) => unknown) => op(SCOPE)),
  };
  const teams = { findById: vi.fn(), list: vi.fn() };
  const service = new TeamQueryService(unitOfWork as never, teams as never);
  return { service, teams };
}

describe('TeamQueryService', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('returns a team by id', async () => {
    harness.teams.findById.mockResolvedValue(TEAM);
    await expect(harness.service.getTeam('team-1')).resolves.toBe(TEAM);
  });

  it('throws not-found for a missing team', async () => {
    harness.teams.findById.mockResolvedValue(null);
    await expect(harness.service.getTeam('team-1')).rejects.toBeInstanceOf(
      TeamNotFoundError,
    );
  });

  it('lists teams through the repository', async () => {
    const page = { limit: 20, offset: 0 };
    const result = { items: [TEAM], total: 1, limit: 20, offset: 0 };
    harness.teams.list.mockResolvedValue(result);
    await expect(harness.service.listTeams(page)).resolves.toBe(result);
    expect(harness.teams.list).toHaveBeenCalledWith(SCOPE, page);
  });
});
