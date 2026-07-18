import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OptimisticConflictError } from '../errors/optimistic-conflict.error';
import { SlugConflictError } from '../errors/slug-conflict.error';
import { VenueNotFoundError } from '../errors/venue-not-found.error';
import { ResourceStatus } from '../model/teams.enums';
import type { UpdateVenueCommand, Venue } from '../model/teams.types';
import { UpdateVenueUseCase } from './update-venue.use-case';

const NOW = new Date('2026-06-01T12:00:00.000Z');
const ACTOR = { userId: 'admin-1', email: 'a@example.test', roles: [] };
const SCOPE = {} as never;

function venue(overrides: Partial<Venue> = {}): Venue {
  return {
    id: 'venue-1',
    teamId: 'team-1',
    name: 'Main Field',
    address: null,
    timezone: 'Africa/Cairo',
    latitude: null,
    longitude: null,
    status: ResourceStatus.Active,
    createdBy: 'admin-1',
    updatedBy: null,
    createdAt: NOW,
    updatedAt: NOW,
    version: 1,
    ...overrides,
  };
}

const COMMAND: UpdateVenueCommand = {
  name: 'Main Field',
  address: 'New Cairo',
  timezone: null,
  latitude: null,
  longitude: null,
  status: ResourceStatus.Active,
  expectedVersion: 1,
};

function build() {
  const unitOfWork = {
    runInTransaction: vi.fn((op: (scope: never) => unknown) => op(SCOPE)),
  };
  const clock = { now: () => NOW, uptime: () => 0 };
  const idGenerator = { generate: vi.fn().mockReturnValue('generated') };
  const venues = {
    findByIdInTeam: vi.fn(),
    existsByName: vi.fn().mockResolvedValue(false),
    update: vi.fn(),
  };
  const audit = { append: vi.fn() };
  const useCase = new UpdateVenueUseCase(
    unitOfWork as never,
    clock,
    idGenerator,
    venues as never,
    audit,
  );
  return { useCase, venues, audit };
}

function run(harness: ReturnType<typeof build>, command = COMMAND) {
  return harness.useCase.execute(ACTOR, 'team-1', 'venue-1', command);
}

describe('UpdateVenueUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('updates a venue and audits', async () => {
    harness.venues.findByIdInTeam.mockResolvedValue(venue());
    harness.venues.update.mockResolvedValue(
      venue({ address: 'New Cairo', version: 2 }),
    );
    const result = await run(harness);
    expect(result.version).toBe(2);
    expect(harness.audit.append).toHaveBeenCalledOnce();
  });

  it('reports not-found for a missing or cross-team venue', async () => {
    harness.venues.findByIdInTeam.mockResolvedValue(null);
    await expect(run(harness)).rejects.toBeInstanceOf(VenueNotFoundError);
  });

  it('reports a version conflict on a stale expected version', async () => {
    harness.venues.findByIdInTeam.mockResolvedValue(venue({ version: 3 }));
    await expect(run(harness)).rejects.toBeInstanceOf(OptimisticConflictError);
  });

  it('rejects a changed name that collides', async () => {
    harness.venues.findByIdInTeam.mockResolvedValue(venue());
    harness.venues.existsByName.mockResolvedValue(true);
    await expect(
      run(harness, { ...COMMAND, name: 'Second Field' }),
    ).rejects.toBeInstanceOf(SlugConflictError);
  });

  it('reports a version conflict when the guarded update misses', async () => {
    harness.venues.findByIdInTeam.mockResolvedValue(venue());
    harness.venues.update.mockResolvedValue(null);
    await expect(run(harness)).rejects.toBeInstanceOf(OptimisticConflictError);
  });
});
