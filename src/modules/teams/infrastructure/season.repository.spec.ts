import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SeasonStatus } from '../model/teams.enums';
import type { SeasonRow } from '../model/teams.rows';
import type {
  NewSeason,
  SeasonStatusChange,
  SeasonUpdate,
} from '../model/teams.types';
import { SeasonRepository } from './season.repository';

const NOW = new Date('2026-06-01T12:00:00.000Z');

function buildScope() {
  return { run: vi.fn() };
}

function seasonRow(overrides: Partial<SeasonRow> = {}): SeasonRow {
  return {
    id: 'season-1',
    team_id: 'team-1',
    slug: 'spring-2026',
    name: 'Spring 2026',
    starts_on: '2026-01-01',
    ends_on: '2026-06-30',
    status: 'active',
    created_by: 'admin-1',
    updated_by: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    version: 1,
    ...overrides,
  };
}

const NEW_SEASON: NewSeason = {
  id: 'season-1',
  teamId: 'team-1',
  slug: 'spring-2026',
  name: 'Spring 2026',
  startsOn: '2026-01-01',
  endsOn: '2026-06-30',
  status: SeasonStatus.Draft,
  createdBy: 'admin-1',
  now: NOW,
};

const SEASON_UPDATE: SeasonUpdate = {
  id: 'season-1',
  teamId: 'team-1',
  slug: 'spring-2026',
  name: 'Spring 2026',
  startsOn: '2026-01-01',
  endsOn: '2026-07-31',
  status: SeasonStatus.Active,
  updatedBy: 'admin-1',
  expectedVersion: 1,
  now: NOW,
};

const STATUS_CHANGE: SeasonStatusChange = {
  id: 'season-1',
  teamId: 'team-1',
  status: SeasonStatus.Closed,
  updatedBy: 'admin-1',
  expectedVersion: 1,
  now: NOW,
};

describe('SeasonRepository', () => {
  let repository: SeasonRepository;
  let scope: ReturnType<typeof buildScope>;

  beforeEach(() => {
    repository = new SeasonRepository();
    scope = buildScope();
  });

  it('finds a season within a team or returns null', async () => {
    scope.run.mockResolvedValueOnce([seasonRow()]);
    await expect(
      repository.findByIdInTeam(scope as never, 'team-1', 'season-1'),
    ).resolves.toMatchObject({
      id: 'season-1',
      status: SeasonStatus.Active,
      startsOn: '2026-01-01',
    });

    scope.run.mockResolvedValueOnce([]);
    await expect(
      repository.findByIdInTeam(scope as never, 'team-1', 'other'),
    ).resolves.toBeNull();
  });

  it('reports slug existence within a team', async () => {
    scope.run.mockResolvedValueOnce([{ id: 'season-1' }]);
    await expect(
      repository.existsBySlug(scope as never, 'team-1', 'spring-2026'),
    ).resolves.toBe(true);

    scope.run.mockResolvedValueOnce([]);
    await expect(
      repository.existsBySlug(scope as never, 'team-1', 'ghost'),
    ).resolves.toBe(false);
  });

  it('lists active date ranges for overlap checks', async () => {
    scope.run.mockResolvedValueOnce([
      { id: 'season-1', starts_on: '2026-01-01', ends_on: '2026-06-30' },
    ]);
    await expect(
      repository.listActiveRanges(scope as never, 'team-1', 1000),
    ).resolves.toEqual([
      { id: 'season-1', startsOn: '2026-01-01', endsOn: '2026-06-30' },
    ]);
  });

  it('inserts a season and maps the returned row', async () => {
    scope.run.mockResolvedValue([seasonRow({ status: 'draft' })]);
    const result = await repository.insert(scope as never, NEW_SEASON);
    expect(result.status).toBe(SeasonStatus.Draft);
  });

  it('throws when the insert returns no row', async () => {
    scope.run.mockResolvedValue([]);
    await expect(repository.insert(scope as never, NEW_SEASON)).rejects.toThrow(
      /returned row/u,
    );
  });

  it('updates a season or returns null on version mismatch', async () => {
    scope.run.mockResolvedValueOnce([
      seasonRow({ ends_on: '2026-07-31', version: 2 }),
    ]);
    await expect(
      repository.update(scope as never, SEASON_UPDATE),
    ).resolves.toMatchObject({ endsOn: '2026-07-31', version: 2 });

    scope.run.mockResolvedValueOnce([]);
    await expect(
      repository.update(scope as never, SEASON_UPDATE),
    ).resolves.toBeNull();
  });

  it('resolves the single active season as the current one, or null', async () => {
    scope.run.mockResolvedValueOnce([seasonRow({ status: 'active' })]);
    await expect(
      repository.findCurrent(scope as never, 'team-1'),
    ).resolves.toMatchObject({ status: SeasonStatus.Active });
    expect(scope.run.mock.calls[0]?.[0]).toContain(`"status" = 'active'`);

    scope.run.mockResolvedValueOnce([]);
    await expect(
      repository.findCurrent(scope as never, 'team-1'),
    ).resolves.toBeNull();
  });

  it('detects another active season, excluding the one being changed', async () => {
    scope.run.mockResolvedValueOnce([{ id: 'other' }]);
    await expect(
      repository.hasOtherActive(scope as never, 'team-1', 'season-1'),
    ).resolves.toBe(true);
    expect(scope.run.mock.calls[0]?.[1]).toEqual(['team-1', 'season-1']);

    scope.run.mockResolvedValueOnce([]);
    await expect(
      repository.hasOtherActive(scope as never, 'team-1', null),
    ).resolves.toBe(false);
  });

  it('applies a season status change or returns null on a version miss', async () => {
    scope.run.mockResolvedValueOnce([
      seasonRow({ status: 'closed', version: 2 }),
    ]);
    await expect(
      repository.applyStatusChange(scope as never, STATUS_CHANGE),
    ).resolves.toMatchObject({ status: SeasonStatus.Closed, version: 2 });

    scope.run.mockResolvedValueOnce([]);
    await expect(
      repository.applyStatusChange(scope as never, {
        ...STATUS_CHANGE,
        expectedVersion: null,
      }),
    ).resolves.toBeNull();
    expect(scope.run.mock.calls[1]?.[0]).toContain('$6::int IS NULL');
  });

  it('lists seasons with a total, defaulting the count to zero', async () => {
    scope.run.mockResolvedValueOnce([seasonRow()]);
    scope.run.mockResolvedValueOnce([{ count: 1 }]);
    await expect(
      repository.list(scope as never, 'team-1', { limit: 20, offset: 0 }),
    ).resolves.toMatchObject({ total: 1 });

    scope.run.mockResolvedValueOnce([]);
    scope.run.mockResolvedValueOnce([]);
    const fallback = await repository.list(scope as never, 'team-1', {
      limit: 20,
      offset: 0,
    });
    expect(fallback.total).toBe(0);
  });
});
