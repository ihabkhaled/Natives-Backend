import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SlugConflictError } from '../errors/slug-conflict.error';
import { ResourceStatus } from '../model/teams.enums';
import type { Venue } from '../model/teams.types';
import { CreateVenueUseCase } from './create-venue.use-case';

const NOW = new Date('2026-06-01T12:00:00.000Z');
const ACTOR = { userId: 'admin-1', email: 'a@example.test', roles: [] };
const SCOPE = {} as never;

const VENUE: Venue = {
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
};

const COMMAND = {
  name: 'Main Field',
  address: null,
  timezone: null,
  latitude: null,
  longitude: null,
};

function build() {
  const unitOfWork = {
    runInTransaction: vi.fn((op: (scope: never) => unknown) => op(SCOPE)),
  };
  const clock = { now: () => NOW, uptime: () => 0 };
  const idGenerator = { generate: vi.fn().mockReturnValue('generated') };
  const teamLookup = { requireActive: vi.fn().mockResolvedValue(undefined) };
  const venues = {
    existsByName: vi.fn().mockResolvedValue(false),
    insert: vi.fn().mockResolvedValue(VENUE),
  };
  const audit = { append: vi.fn() };
  const useCase = new CreateVenueUseCase(
    unitOfWork as never,
    clock,
    idGenerator,
    teamLookup as never,
    venues as never,
    audit,
  );
  return { useCase, venues, audit };
}

describe('CreateVenueUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('creates a venue, defaulting the timezone, and audits', async () => {
    const result = await harness.useCase.execute(ACTOR, 'team-1', COMMAND);

    expect(result).toBe(VENUE);
    expect(harness.venues.insert.mock.calls[0]?.[1]).toMatchObject({
      timezone: 'Africa/Cairo',
    });
    expect(harness.audit.append).toHaveBeenCalledOnce();
  });

  it('rejects a duplicate name', async () => {
    harness.venues.existsByName.mockResolvedValue(true);
    await expect(
      harness.useCase.execute(ACTOR, 'team-1', COMMAND),
    ).rejects.toBeInstanceOf(SlugConflictError);
  });
});
