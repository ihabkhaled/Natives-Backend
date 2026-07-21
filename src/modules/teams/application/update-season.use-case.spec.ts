import { ValidationError } from '@core/errors/validation.error';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OptimisticConflictError } from '../errors/optimistic-conflict.error';
import { SeasonAlreadyActiveError } from '../errors/season-already-active.error';
import { SeasonNotFoundError } from '../errors/season-not-found.error';
import { SeasonOverlapError } from '../errors/season-overlap.error';
import { SlugConflictError } from '../errors/slug-conflict.error';
import { SeasonStatus } from '../model/teams.enums';
import type { Season, UpdateSeasonCommand } from '../model/teams.types';
import { UpdateSeasonUseCase } from './update-season.use-case';

const NOW = new Date('2026-06-01T12:00:00.000Z');
const ACTOR = { userId: 'admin-1', email: 'a@example.test', roles: [] };
const SCOPE = {} as never;

function season(overrides: Partial<Season> = {}): Season {
  return {
    id: 'season-1',
    teamId: 'team-1',
    slug: 'spring-2026',
    name: 'Spring 2026',
    startsOn: '2026-01-01',
    endsOn: '2026-06-30',
    status: SeasonStatus.Active,
    createdBy: 'admin-1',
    updatedBy: null,
    createdAt: NOW,
    updatedAt: NOW,
    version: 1,
    ...overrides,
  };
}

const COMMAND: UpdateSeasonCommand = {
  slug: 'spring-2026',
  name: 'Spring 2026',
  startsOn: '2026-01-01',
  endsOn: '2026-07-31',
  status: SeasonStatus.Active,
  expectedVersion: 1,
};

function build() {
  const unitOfWork = {
    runInTransaction: vi.fn((op: (scope: never) => unknown) => op(SCOPE)),
  };
  const clock = { now: () => NOW, uptime: () => 0 };
  const idGenerator = { generate: vi.fn().mockReturnValue('generated') };
  const seasons = {
    findByIdInTeam: vi.fn(),
    existsBySlug: vi.fn().mockResolvedValue(false),
    listActiveRanges: vi.fn().mockResolvedValue([]),
    hasOtherActive: vi.fn().mockResolvedValue(false),
    update: vi.fn(),
  };
  const audit = { append: vi.fn() };
  const useCase = new UpdateSeasonUseCase(
    unitOfWork as never,
    clock,
    idGenerator,
    seasons as never,
    audit,
  );
  return { useCase, seasons, audit };
}

function run(harness: ReturnType<typeof build>, command = COMMAND) {
  return harness.useCase.execute(ACTOR, 'team-1', 'season-1', command);
}

describe('UpdateSeasonUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('updates a season and audits', async () => {
    harness.seasons.findByIdInTeam.mockResolvedValue(season());
    harness.seasons.update.mockResolvedValue(
      season({ endsOn: '2026-07-31', version: 2 }),
    );

    const result = await run(harness);

    expect(result.version).toBe(2);
    expect(harness.audit.append).toHaveBeenCalledOnce();
  });

  it('reports not-found for a missing or cross-team season', async () => {
    harness.seasons.findByIdInTeam.mockResolvedValue(null);
    await expect(run(harness)).rejects.toBeInstanceOf(SeasonNotFoundError);
  });

  it('rejects an invalid date range', async () => {
    harness.seasons.findByIdInTeam.mockResolvedValue(season());
    await expect(
      run(harness, {
        ...COMMAND,
        startsOn: '2026-08-01',
        endsOn: '2026-07-01',
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('reports a version conflict on a stale expected version', async () => {
    harness.seasons.findByIdInTeam.mockResolvedValue(season({ version: 2 }));
    await expect(run(harness)).rejects.toBeInstanceOf(OptimisticConflictError);
  });

  it('rejects a changed slug that collides', async () => {
    harness.seasons.findByIdInTeam.mockResolvedValue(season());
    harness.seasons.existsBySlug.mockResolvedValue(true);
    await expect(
      run(harness, { ...COMMAND, slug: 'summer-2026' }),
    ).rejects.toBeInstanceOf(SlugConflictError);
  });

  it('rejects an overlapping range against another season', async () => {
    harness.seasons.findByIdInTeam.mockResolvedValue(season());
    harness.seasons.listActiveRanges.mockResolvedValue([
      { id: 'season-1', startsOn: '2026-01-01', endsOn: '2026-06-30' },
      { id: 'other', startsOn: '2026-07-01', endsOn: '2026-09-01' },
    ]);
    await expect(run(harness)).rejects.toBeInstanceOf(SeasonOverlapError);
  });

  it('skips the overlap scan when archiving via update', async () => {
    harness.seasons.findByIdInTeam.mockResolvedValue(season());
    harness.seasons.update.mockResolvedValue(
      season({ status: SeasonStatus.Archived, version: 2 }),
    );
    await run(harness, { ...COMMAND, status: SeasonStatus.Archived });
    expect(harness.seasons.listActiveRanges).not.toHaveBeenCalled();
  });

  it('reports a version conflict when the guarded update misses', async () => {
    harness.seasons.findByIdInTeam.mockResolvedValue(season());
    harness.seasons.update.mockResolvedValue(null);
    await expect(run(harness)).rejects.toBeInstanceOf(OptimisticConflictError);
  });

  it('refuses to make a second season the team current season', async () => {
    harness.seasons.findByIdInTeam.mockResolvedValue(season());
    harness.seasons.hasOtherActive.mockResolvedValue(true);

    await expect(
      run(harness, { ...COMMAND, status: SeasonStatus.Active }),
    ).rejects.toBeInstanceOf(SeasonAlreadyActiveError);
    expect(harness.seasons.hasOtherActive).toHaveBeenCalledWith(
      SCOPE,
      'team-1',
      'season-1',
    );
  });
});
