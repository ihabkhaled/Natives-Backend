import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CalculationRuleStatus, ScoreCategory } from '../model/scoring.enums';
import type { CalculationRule } from '../model/scoring.types';
import { SimulateCalculationRuleUseCase } from './simulate-calculation-rule.use-case';

const NOW = new Date('2026-03-01T00:00:00.000Z');

function rule(
  ruleId: string,
  status: CalculationRuleStatus,
): CalculationRule {
  return {
    ruleId,
    teamId: 'team-1',
    seasonId: null,
    ruleKey: 'legacy_overall',
    version: 1,
    name: 'Legacy overall',
    description: null,
    status,
    scaleMin: 0,
    scaleMax: 5,
    minComponents: 1,
    components: [{ categoryKey: ScoreCategory.Training, weight: 1, minSample: 1 }],
    effectiveFrom: null,
    effectiveTo: null,
    recordVersion: 1,
    createdBy: 'admin-1',
    publishedBy: null,
    publishedAt: null,
    retiredAt: null,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function sourceRow(membershipId: string) {
  return {
    membership_id: membershipId,
    category_key: 'training',
    values: ['4'],
    total_metrics: 1,
  };
}

function build() {
  const tx = {} as never;
  const unitOfWork = {
    runInTransaction: vi.fn((cb: (t: never) => unknown) => cb(tx)),
  };
  const clock = { now: vi.fn(() => NOW) };
  const idGenerator = { generate: vi.fn(() => 'proj-1') };
  const scope = { requireMembership: vi.fn() };
  const lookup = {
    requireForWrite: vi.fn(() => rule('draft-1', CalculationRuleStatus.Draft)),
  };
  const rules = { listPublishedForTeam: vi.fn(() => []) };
  const sources = {
    categorySourcesForMembership: vi.fn(() => [sourceRow('mem-1')]),
  };
  const useCase = new SimulateCalculationRuleUseCase(
    unitOfWork as never,
    clock as never,
    idGenerator,
    scope as never,
    lookup as never,
    rules as never,
    sources as never,
  );
  return { scope, rules, sources, useCase };
}

describe('SimulateCalculationRuleUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('compares a draft to the effective published rule and computes the delta', async () => {
    harness.rules.listPublishedForTeam.mockReturnValueOnce([
      rule('pub-1', CalculationRuleStatus.Published),
    ]);
    const result = await harness.useCase.execute('team-1', 'draft-1', {
      membershipId: 'mem-1',
    });
    expect(harness.scope.requireMembership).toHaveBeenCalled();
    expect(result.draft.overall.unrounded).toBe(4);
    expect(result.published?.overall.unrounded).toBe(4);
    expect(result.delta).toBe(0);
  });

  it('returns a null published comparison and delta when nothing is published', async () => {
    const result = await harness.useCase.execute('team-1', 'draft-1', {
      membershipId: 'mem-1',
    });
    expect(result.published).toBeNull();
    expect(result.delta).toBeNull();
  });

  it('treats absent source rows as no data', async () => {
    harness.sources.categorySourcesForMembership.mockReturnValueOnce([
      sourceRow('other-member'),
    ]);
    const result = await harness.useCase.execute('team-1', 'draft-1', {
      membershipId: 'mem-1',
    });
    expect(result.draft.overall.unrounded).toBeNull();
    expect(result.delta).toBeNull();
  });
});
