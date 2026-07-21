import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TeamNotFoundError } from '../errors/team-not-found.error';
import { TeamStatus } from '../model/teams.enums';
import type { Team } from '../model/teams.types';
import { TeamLookupService } from './team-lookup.service';

const NOW = new Date('2026-06-01T12:00:00.000Z');
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
    status: TeamStatus.Active,
    deletedAt: null,
    createdBy: null,
    updatedBy: null,
    createdAt: NOW,
    updatedAt: NOW,
    version: 1,
    ...overrides,
  };
}

function build() {
  const teams = { findById: vi.fn() };
  const service = new TeamLookupService(teams as never);
  return { service, teams };
}

describe('TeamLookupService', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('returns an active team', async () => {
    const active = team();
    harness.teams.findById.mockResolvedValue(active);
    await expect(harness.service.requireActive(SCOPE, 'team-1')).resolves.toBe(
      active,
    );
  });

  it('throws for a missing team', async () => {
    harness.teams.findById.mockResolvedValue(null);
    await expect(
      harness.service.requireActive(SCOPE, 'team-1'),
    ).rejects.toBeInstanceOf(TeamNotFoundError);
  });

  it('throws for a disabled team, which takes no new work', async () => {
    harness.teams.findById.mockResolvedValue(
      team({ status: TeamStatus.Disabled }),
    );
    await expect(
      harness.service.requireActive(SCOPE, 'team-1'),
    ).rejects.toBeInstanceOf(TeamNotFoundError);
  });

  it('throws for a soft-removed team', async () => {
    harness.teams.findById.mockResolvedValue(team({ deletedAt: NOW }));
    await expect(
      harness.service.requireActive(SCOPE, 'team-1'),
    ).rejects.toBeInstanceOf(TeamNotFoundError);
  });

  it('throws for an archived team', async () => {
    harness.teams.findById.mockResolvedValue(
      team({ status: TeamStatus.Archived }),
    );
    await expect(
      harness.service.requireActive(SCOPE, 'team-1'),
    ).rejects.toBeInstanceOf(TeamNotFoundError);
  });
});
