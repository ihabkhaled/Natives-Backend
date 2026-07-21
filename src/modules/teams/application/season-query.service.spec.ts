import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CurrentSeasonNotFoundError } from '../errors/current-season-not-found.error';
import { SeasonStatus } from '../model/teams.enums';
import type { Season } from '../model/teams.types';
import { SeasonQueryService } from './season-query.service';

const NOW = new Date('2026-06-01T12:00:00.000Z');
const SCOPE = {} as never;

const SEASON: Season = {
  id: 'season-1',
  teamId: 'team-1',
  slug: '2026',
  name: 'Season 2026',
  startsOn: '2026-01-01',
  endsOn: '2026-12-31',
  status: SeasonStatus.Active,
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
  const seasons = {
    list: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    findCurrent: vi.fn(),
  };
  const service = new SeasonQueryService(unitOfWork as never, seasons as never);
  return { seasons, service };
}

describe('SeasonQueryService', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('lists seasons for a team through the repository', async () => {
    const page = { limit: 20, offset: 0 };

    await harness.service.listSeasons('team-1', page);

    expect(harness.seasons.list).toHaveBeenCalledWith(SCOPE, 'team-1', page);
  });

  it('resolves the single active season as the current season', async () => {
    harness.seasons.findCurrent.mockResolvedValue(SEASON);

    await expect(harness.service.getCurrentSeason('team-1')).resolves.toBe(
      SEASON,
    );
    expect(harness.seasons.findCurrent).toHaveBeenCalledWith(SCOPE, 'team-1');
  });

  it('raises not-found rather than guessing when no season is active', async () => {
    harness.seasons.findCurrent.mockResolvedValue(null);

    await expect(
      harness.service.getCurrentSeason('team-1'),
    ).rejects.toBeInstanceOf(CurrentSeasonNotFoundError);
  });
});
