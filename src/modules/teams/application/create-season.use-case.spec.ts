import { ValidationError } from '@core/errors/validation.error';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SeasonOverlapError } from '../errors/season-overlap.error';
import { SlugConflictError } from '../errors/slug-conflict.error';
import { SeasonStatus } from '../model/teams.enums';
import type { Season } from '../model/teams.types';
import { CreateSeasonUseCase } from './create-season.use-case';

const NOW = new Date('2026-06-01T12:00:00.000Z');
const ACTOR = { userId: 'admin-1', email: 'a@example.test', roles: [] };
const SCOPE = {} as never;

const SEASON: Season = {
  id: 'season-1',
  teamId: 'team-1',
  slug: 'spring-2026',
  name: 'Spring 2026',
  startsOn: '2026-01-01',
  endsOn: '2026-06-30',
  status: SeasonStatus.Draft,
  createdBy: 'admin-1',
  updatedBy: null,
  createdAt: NOW,
  updatedAt: NOW,
  version: 1,
};

const COMMAND = {
  slug: 'spring-2026',
  name: 'Spring 2026',
  startsOn: '2026-01-01',
  endsOn: '2026-06-30',
  status: null,
};

function build() {
  const unitOfWork = {
    runInTransaction: vi.fn((op: (scope: never) => unknown) => op(SCOPE)),
  };
  const clock = { now: () => NOW, uptime: () => 0 };
  const idGenerator = { generate: vi.fn().mockReturnValue('generated') };
  const teamLookup = { requireActive: vi.fn().mockResolvedValue(undefined) };
  const seasons = {
    existsBySlug: vi.fn().mockResolvedValue(false),
    listActiveRanges: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockResolvedValue(SEASON),
  };
  const audit = { append: vi.fn() };
  const useCase = new CreateSeasonUseCase(
    unitOfWork as never,
    clock,
    idGenerator,
    teamLookup as never,
    seasons as never,
    audit,
  );
  return { useCase, teamLookup, seasons, audit };
}

describe('CreateSeasonUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('creates a season, defaulting status to draft, and audits', async () => {
    const result = await harness.useCase.execute(ACTOR, 'team-1', COMMAND);

    expect(result).toBe(SEASON);
    expect(harness.seasons.insert.mock.calls[0]?.[1]).toMatchObject({
      status: SeasonStatus.Draft,
    });
    expect(harness.audit.append).toHaveBeenCalledOnce();
  });

  it('rejects an invalid date range', async () => {
    await expect(
      harness.useCase.execute(ACTOR, 'team-1', {
        ...COMMAND,
        startsOn: '2026-06-30',
        endsOn: '2026-01-01',
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(harness.seasons.insert).not.toHaveBeenCalled();
  });

  it('rejects a duplicate slug', async () => {
    harness.seasons.existsBySlug.mockResolvedValue(true);
    await expect(
      harness.useCase.execute(ACTOR, 'team-1', COMMAND),
    ).rejects.toBeInstanceOf(SlugConflictError);
  });

  it('rejects an overlapping season', async () => {
    harness.seasons.listActiveRanges.mockResolvedValue([
      { id: 'other', startsOn: '2026-03-01', endsOn: '2026-09-01' },
    ]);
    await expect(
      harness.useCase.execute(ACTOR, 'team-1', COMMAND),
    ).rejects.toBeInstanceOf(SeasonOverlapError);
  });

  it('skips the overlap scan when creating an archived season', async () => {
    await harness.useCase.execute(ACTOR, 'team-1', {
      ...COMMAND,
      status: SeasonStatus.Archived,
    });
    expect(harness.seasons.listActiveRanges).not.toHaveBeenCalled();
  });
});
