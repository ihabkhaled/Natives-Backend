import { describe, expect, it, vi } from 'vitest';

import { SeasonQueryService } from './season-query.service';

const SCOPE = {} as never;

describe('SeasonQueryService', () => {
  it('lists seasons for a team through the repository', async () => {
    const unitOfWork = {
      runInTransaction: vi.fn((op: (scope: never) => unknown) => op(SCOPE)),
    };
    const seasons = {
      list: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    };
    const service = new SeasonQueryService(
      unitOfWork as never,
      seasons as never,
    );
    const page = { limit: 20, offset: 0 };

    await service.listSeasons('team-1', page);

    expect(seasons.list).toHaveBeenCalledWith(SCOPE, 'team-1', page);
  });
});
