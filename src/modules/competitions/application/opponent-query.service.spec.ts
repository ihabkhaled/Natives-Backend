import { describe, expect, it, vi } from 'vitest';

import { OpponentQueryService } from './opponent-query.service';

describe('OpponentQueryService', () => {
  it('returns a bounded page of opponents', async () => {
    const tx = {} as never;
    const unitOfWork = {
      runInTransaction: vi.fn((op: (scope: never) => unknown) => op(tx)),
    };
    const repository = {
      listForTeam: vi.fn().mockResolvedValue([{ opponentId: 'opp-1' }]),
      countForTeam: vi.fn().mockResolvedValue(1),
    };
    const service = new OpponentQueryService(
      unitOfWork as never,
      repository as never,
    );
    const page = await service.listForTeam('team-1', { limit: 20, offset: 0 });
    expect(page.total).toBe(1);
    expect(page.items).toHaveLength(1);
    expect(page.limit).toBe(20);
  });
});
