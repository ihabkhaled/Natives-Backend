import { describe, expect, it, vi } from 'vitest';

import { CompetitionQueryService } from './competition-query.service';

function build() {
  const tx = {} as never;
  const unitOfWork = {
    runInTransaction: vi.fn((op: (scope: never) => unknown) => op(tx)),
  };
  const repository = {
    listForScope: vi.fn().mockResolvedValue([{ competitionId: 'comp-1' }]),
    countForScope: vi.fn().mockResolvedValue(1),
  };
  const lookup = {
    require: vi.fn().mockResolvedValue({ competitionId: 'comp-1' }),
  };
  const service = new CompetitionQueryService(
    unitOfWork as never,
    repository as never,
    lookup as never,
  );
  return { repository, lookup, service };
}

describe('CompetitionQueryService', () => {
  it('returns a bounded page echoing the request window', async () => {
    const harness = build();
    const page = await harness.service.listForScope('team-1', 'season-1', {
      limit: 20,
      offset: 0,
    });
    expect(page.total).toBe(1);
    expect(page.items).toHaveLength(1);
    expect(harness.repository.listForScope).toHaveBeenCalledWith(
      expect.anything(),
      'team-1',
      'season-1',
      { limit: 20, offset: 0 },
    );
  });

  it('resolves a single competition through the lookup', async () => {
    const harness = build();
    const competition = await harness.service.getById('team-1', 'comp-1');
    expect(competition.competitionId).toBe('comp-1');
    expect(harness.lookup.require).toHaveBeenCalledOnce();
  });
});
