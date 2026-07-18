import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SlugConflictError } from '../errors/slug-conflict.error';
import type { Team } from '../model/teams.types';
import { CreateTeamUseCase } from './create-team.use-case';

const NOW = new Date('2026-06-01T12:00:00.000Z');
const ACTOR = { userId: 'admin-1', email: 'a@example.test', roles: [] };
const SCOPE = {} as never;

const TEAM: Team = {
  id: 'team-1',
  slug: 'natives',
  name: 'Ultimate Natives',
  locale: 'en',
  timezone: 'Africa/Cairo',
  primaryColor: null,
  logoMediaKey: null,
  status: 'active' as Team['status'],
  createdBy: 'admin-1',
  updatedBy: null,
  createdAt: NOW,
  updatedAt: NOW,
  version: 1,
};

function build() {
  const unitOfWork = {
    runInTransaction: vi.fn((op: (scope: never) => unknown) => op(SCOPE)),
  };
  const clock = { now: () => NOW, uptime: () => 0 };
  const idGenerator = { generate: vi.fn().mockReturnValue('generated') };
  const teams = { existsBySlug: vi.fn(), insert: vi.fn() };
  const audit = { append: vi.fn() };
  const useCase = new CreateTeamUseCase(
    unitOfWork as never,
    clock,
    idGenerator,
    teams as never,
    audit,
  );
  return { useCase, teams, audit };
}

describe('CreateTeamUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('creates a team, defaulting locale/timezone, and audits', async () => {
    harness.teams.existsBySlug.mockResolvedValue(false);
    harness.teams.insert.mockResolvedValue(TEAM);

    const result = await harness.useCase.execute(ACTOR, {
      slug: 'natives',
      name: 'Ultimate Natives',
      locale: null,
      timezone: null,
      primaryColor: null,
      logoMediaKey: null,
    });

    expect(result).toBe(TEAM);
    expect(harness.teams.insert.mock.calls[0]?.[1]).toMatchObject({
      locale: 'en',
      timezone: 'Africa/Cairo',
      createdBy: 'admin-1',
    });
    expect(harness.audit.append).toHaveBeenCalledOnce();
  });

  it('rejects a duplicate slug', async () => {
    harness.teams.existsBySlug.mockResolvedValue(true);

    await expect(
      harness.useCase.execute(ACTOR, {
        slug: 'natives',
        name: 'Ultimate Natives',
        locale: 'fr',
        timezone: 'UTC',
        primaryColor: '#000',
        logoMediaKey: 'key',
      }),
    ).rejects.toBeInstanceOf(SlugConflictError);
    expect(harness.teams.insert).not.toHaveBeenCalled();
  });
});
