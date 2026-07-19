import { describe, expect, it, vi } from 'vitest';

import { PointsRuleNotFoundError } from '../errors/points-rule-not-found.error';
import { RuleLookupService } from './rule-lookup.service';

describe('RuleLookupService', () => {
  it('returns a writable rule', async () => {
    const repository = {
      findForWrite: vi.fn().mockResolvedValue({ ruleId: 'rule-1' }),
    };
    const service = new RuleLookupService(repository as never);
    expect(
      (await service.requireForWrite({} as never, 'team-1', 'rule-1')).ruleId,
    ).toBe('rule-1');
  });

  it('404s a missing rule to hide existence', async () => {
    const repository = { findForWrite: vi.fn().mockResolvedValue(null) };
    const service = new RuleLookupService(repository as never);
    await expect(
      service.requireForWrite({} as never, 'team-1', 'rule-1'),
    ).rejects.toBeInstanceOf(PointsRuleNotFoundError);
  });
});
