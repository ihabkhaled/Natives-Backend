import { describe, expect, it, vi } from 'vitest';

import { RuleQueryService } from './rule-query.service';

describe('RuleQueryService', () => {
  it('pages the team rules and candidates with a total count', async () => {
    const tx = {} as never;
    const unitOfWork = {
      runInTransaction: vi.fn((op: (scope: never) => unknown) => op(tx)),
    };
    const repository = {
      listForTeam: vi.fn().mockResolvedValue([{ ruleId: 'rule-1' }]),
      countForTeam: vi.fn().mockResolvedValue(1),
    };
    const service = new RuleQueryService(
      unitOfWork as never,
      repository as never,
    );
    const page = await service.listForTeam('team-1', { limit: 20, offset: 0 });
    expect(page).toEqual({
      items: [{ ruleId: 'rule-1' }],
      total: 1,
      limit: 20,
      offset: 0,
    });
  });
});
