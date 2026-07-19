import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RuleQueryService } from './rule-query.service';

function build() {
  const tx = {} as never;
  const unitOfWork = {
    runInTransaction: vi.fn(async (cb: (t: never) => unknown) => cb(tx)),
  };
  const repository = {
    listForTeam: vi.fn(() => [{ ruleId: 'rule-1' }]),
    countForTeam: vi.fn(() => 1),
  };
  const lookup = { requireVisible: vi.fn(() => ({ ruleId: 'rule-1' })) };
  const service = new RuleQueryService(
    unitOfWork as never,
    repository as never,
    lookup as never,
  );
  return { repository, lookup, service };
}

describe('RuleQueryService', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('returns a bounded page of rules', async () => {
    const page = await harness.service.listForTeam('team-1', {
      limit: 20,
      offset: 0,
    });
    expect(page).toEqual({
      items: [{ ruleId: 'rule-1' }],
      total: 1,
      limit: 20,
      offset: 0,
    });
  });

  it('delegates detail reads to the visible lookup', async () => {
    await expect(
      harness.service.getDetail('team-1', 'rule-1'),
    ).resolves.toMatchObject({ ruleId: 'rule-1' });
    expect(harness.lookup.requireVisible).toHaveBeenCalled();
  });
});
