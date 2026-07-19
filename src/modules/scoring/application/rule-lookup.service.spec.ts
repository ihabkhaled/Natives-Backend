import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CalculationRuleNotFoundError } from '../errors/calculation-rule-not-found.error';
import { RuleLookupService } from './rule-lookup.service';

function build() {
  const repository = { findForWrite: vi.fn(), findVisible: vi.fn() };
  const service = new RuleLookupService(repository as never);
  return { repository, service, tx: {} as never };
}

describe('RuleLookupService', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('returns a rule for write or throws not found', async () => {
    harness.repository.findForWrite.mockResolvedValueOnce({ ruleId: 'rule-1' });
    await expect(
      harness.service.requireForWrite(harness.tx, 'team-1', 'rule-1'),
    ).resolves.toMatchObject({ ruleId: 'rule-1' });
    harness.repository.findForWrite.mockResolvedValueOnce(null);
    await expect(
      harness.service.requireForWrite(harness.tx, 'team-1', 'rule-1'),
    ).rejects.toBeInstanceOf(CalculationRuleNotFoundError);
  });

  it('returns a visible rule or throws not found', async () => {
    harness.repository.findVisible.mockResolvedValueOnce({ ruleId: 'rule-1' });
    await expect(
      harness.service.requireVisible(harness.tx, 'team-1', 'rule-1'),
    ).resolves.toMatchObject({ ruleId: 'rule-1' });
    harness.repository.findVisible.mockResolvedValueOnce(null);
    await expect(
      harness.service.requireVisible(harness.tx, 'team-1', 'rule-1'),
    ).rejects.toBeInstanceOf(CalculationRuleNotFoundError);
  });
});
