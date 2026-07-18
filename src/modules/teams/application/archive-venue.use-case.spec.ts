import { beforeEach, describe, expect, it, vi } from 'vitest';

import { VenueNotFoundError } from '../errors/venue-not-found.error';
import { ResourceStatus } from '../model/teams.enums';
import type { Venue } from '../model/teams.types';
import { ArchiveVenueUseCase } from './archive-venue.use-case';

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
  status: ResourceStatus.Archived,
  createdBy: 'admin-1',
  updatedBy: 'admin-1',
  createdAt: NOW,
  updatedAt: NOW,
  version: 2,
};

function build() {
  const unitOfWork = {
    runInTransaction: vi.fn((op: (scope: never) => unknown) => op(SCOPE)),
  };
  const clock = { now: () => NOW, uptime: () => 0 };
  const idGenerator = { generate: vi.fn().mockReturnValue('generated') };
  const venues = { archive: vi.fn() };
  const audit = { append: vi.fn() };
  const useCase = new ArchiveVenueUseCase(
    unitOfWork as never,
    clock,
    idGenerator,
    venues as never,
    audit,
  );
  return { useCase, venues, audit };
}

describe('ArchiveVenueUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('archives a venue and audits', async () => {
    harness.venues.archive.mockResolvedValue(VENUE);
    const result = await harness.useCase.execute(ACTOR, 'team-1', 'venue-1');
    expect(result.status).toBe(ResourceStatus.Archived);
    expect(harness.audit.append).toHaveBeenCalledOnce();
  });

  it('reports not-found for a missing, cross-team, or archived venue', async () => {
    harness.venues.archive.mockResolvedValue(null);
    await expect(
      harness.useCase.execute(ACTOR, 'team-1', 'venue-1'),
    ).rejects.toBeInstanceOf(VenueNotFoundError);
  });
});
