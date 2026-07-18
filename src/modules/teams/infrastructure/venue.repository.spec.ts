import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ResourceStatus } from '../model/teams.enums';
import type { VenueRow } from '../model/teams.rows';
import type { NewVenue, VenueUpdate } from '../model/teams.types';
import { VenueRepository } from './venue.repository';

const NOW = new Date('2026-06-01T12:00:00.000Z');

function buildScope() {
  return { run: vi.fn() };
}

function venueRow(overrides: Partial<VenueRow> = {}): VenueRow {
  return {
    id: 'venue-1',
    team_id: 'team-1',
    name: 'Main Field',
    address: null,
    timezone: 'Africa/Cairo',
    latitude: null,
    longitude: null,
    status: 'active',
    created_by: 'admin-1',
    updated_by: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    version: 1,
    ...overrides,
  };
}

const NEW_VENUE: NewVenue = {
  id: 'venue-1',
  teamId: 'team-1',
  name: 'Main Field',
  address: null,
  timezone: 'Africa/Cairo',
  latitude: null,
  longitude: null,
  createdBy: 'admin-1',
  now: NOW,
};

const VENUE_UPDATE: VenueUpdate = {
  id: 'venue-1',
  teamId: 'team-1',
  name: 'Main Field',
  address: 'New Cairo',
  timezone: 'Africa/Cairo',
  latitude: 30.05,
  longitude: 31.25,
  status: ResourceStatus.Active,
  updatedBy: 'admin-1',
  expectedVersion: 1,
  now: NOW,
};

describe('VenueRepository', () => {
  let repository: VenueRepository;
  let scope: ReturnType<typeof buildScope>;

  beforeEach(() => {
    repository = new VenueRepository();
    scope = buildScope();
  });

  it('finds a venue and preserves null coordinates (null-not-zero)', async () => {
    scope.run.mockResolvedValueOnce([venueRow()]);
    const found = await repository.findByIdInTeam(
      scope as never,
      'team-1',
      'venue-1',
    );
    expect(found?.latitude).toBeNull();
    expect(found?.longitude).toBeNull();

    scope.run.mockResolvedValueOnce([]);
    await expect(
      repository.findByIdInTeam(scope as never, 'team-1', 'other'),
    ).resolves.toBeNull();
  });

  it('maps numeric coordinate strings to numbers', async () => {
    scope.run.mockResolvedValueOnce([
      venueRow({ latitude: '30.050000', longitude: '31.250000' }),
    ]);
    const found = await repository.findByIdInTeam(
      scope as never,
      'team-1',
      'venue-1',
    );
    expect(found?.latitude).toBeCloseTo(30.05);
    expect(found?.longitude).toBeCloseTo(31.25);
  });

  it('reports name existence within a team', async () => {
    scope.run.mockResolvedValueOnce([{ id: 'venue-1' }]);
    await expect(
      repository.existsByName(scope as never, 'team-1', 'Main Field'),
    ).resolves.toBe(true);

    scope.run.mockResolvedValueOnce([]);
    await expect(
      repository.existsByName(scope as never, 'team-1', 'Ghost'),
    ).resolves.toBe(false);
  });

  it('inserts a venue and maps the returned row', async () => {
    scope.run.mockResolvedValue([venueRow()]);
    await expect(
      repository.insert(scope as never, NEW_VENUE),
    ).resolves.toMatchObject({ name: 'Main Field' });
  });

  it('throws when the insert returns no row', async () => {
    scope.run.mockResolvedValue([]);
    await expect(repository.insert(scope as never, NEW_VENUE)).rejects.toThrow(
      /returned row/u,
    );
  });

  it('updates a venue or returns null on version mismatch', async () => {
    scope.run.mockResolvedValueOnce([
      venueRow({ address: 'New Cairo', version: 2 }),
    ]);
    await expect(
      repository.update(scope as never, VENUE_UPDATE),
    ).resolves.toMatchObject({ address: 'New Cairo', version: 2 });

    scope.run.mockResolvedValueOnce([]);
    await expect(
      repository.update(scope as never, VENUE_UPDATE),
    ).resolves.toBeNull();
  });

  it('archives a venue or returns null when already archived', async () => {
    scope.run.mockResolvedValueOnce([venueRow({ status: 'archived' })]);
    await expect(
      repository.archive(scope as never, 'team-1', 'venue-1', 'admin-1', NOW),
    ).resolves.toMatchObject({ status: ResourceStatus.Archived });

    scope.run.mockResolvedValueOnce([]);
    await expect(
      repository.archive(scope as never, 'team-1', 'venue-1', 'admin-1', NOW),
    ).resolves.toBeNull();
  });

  it('lists venues with a total, defaulting the count to zero', async () => {
    scope.run.mockResolvedValueOnce([venueRow()]);
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
