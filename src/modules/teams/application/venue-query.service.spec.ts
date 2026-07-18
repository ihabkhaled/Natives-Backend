import { describe, expect, it, vi } from 'vitest';

import { VenueQueryService } from './venue-query.service';

const SCOPE = {} as never;

describe('VenueQueryService', () => {
  it('lists venues for a team through the repository', async () => {
    const unitOfWork = {
      runInTransaction: vi.fn((op: (scope: never) => unknown) => op(SCOPE)),
    };
    const venues = { list: vi.fn().mockResolvedValue({ items: [], total: 0 }) };
    const service = new VenueQueryService(unitOfWork as never, venues as never);
    const page = { limit: 20, offset: 0 };

    await service.listVenues('team-1', page);

    expect(venues.list).toHaveBeenCalledWith(SCOPE, 'team-1', page);
  });
});
