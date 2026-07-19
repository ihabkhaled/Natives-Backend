import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CalculationRuleInvalidTransitionError } from '../errors/calculation-rule-invalid-transition.error';
import { CalculationRuleVersionConflictError } from '../errors/calculation-rule-version-conflict.error';
import {
  CalculationRuleStatus,
  CalculationRuleTransition,
  ScoreCategory,
} from '../model/scoring.enums';
import type { CalculationRule } from '../model/scoring.types';
import { TransitionCalculationRuleUseCase } from './transition-calculation-rule.use-case';

const NOW = new Date('2026-03-01T00:00:00.000Z');
const actor = { userId: 'admin-1' } as never;

function rule(status: CalculationRuleStatus): CalculationRule {
  return {
    ruleId: 'rule-1',
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

function build(existing: CalculationRuleStatus) {
  const tx = {} as never;
  const unitOfWork = {
    runInTransaction: vi.fn((cb: (t: never) => unknown) => cb(tx)),
  };
  const clock = { now: vi.fn(() => NOW) };
  const lookup = { requireForWrite: vi.fn(() => rule(existing)) };
  const rules = {
    applyStatusChange: vi.fn(),
    retirePublished: vi.fn(() => 1),
  };
  const projections = { markStaleForTeamRuleKey: vi.fn(() => 0) };
  const audit = { record: vi.fn() };
  const events = { enqueue: vi.fn() };
  const useCase = new TransitionCalculationRuleUseCase(
    unitOfWork as never,
    clock as never,
    lookup as never,
    rules as never,
    projections as never,
    audit as never,
    events as never,
  );
  return { lookup, rules, projections, audit, events, useCase };
}

describe('TransitionCalculationRuleUseCase', () => {
  it('publishes: supersedes, marks stale, and emits publish + rebuild-request', async () => {
    const harness = build(CalculationRuleStatus.Approved);
    harness.rules.applyStatusChange.mockReturnValueOnce(
      rule(CalculationRuleStatus.Published),
    );
    await harness.useCase.execute(actor, 'team-1', 'rule-1', {
      transition: CalculationRuleTransition.Publish,
      expectedRecordVersion: 1,
    });
    expect(harness.rules.retirePublished).toHaveBeenCalled();
    expect(harness.projections.markStaleForTeamRuleKey).toHaveBeenCalled();
    const types = harness.events.enqueue.mock.calls.map(c => c[1].eventType);
    expect(types).toEqual([
      'scoring.rule.published.v1',
      'scoring.projection.requested.v1',
    ]);
  });

  it('retires: emits the retire event only', async () => {
    const harness = build(CalculationRuleStatus.Published);
    harness.rules.applyStatusChange.mockReturnValueOnce(
      rule(CalculationRuleStatus.Retired),
    );
    await harness.useCase.execute(actor, 'team-1', 'rule-1', {
      transition: CalculationRuleTransition.Retire,
      expectedRecordVersion: 1,
    });
    const types = harness.events.enqueue.mock.calls.map(c => c[1].eventType);
    expect(types).toEqual(['scoring.rule.retired.v1']);
    expect(harness.rules.retirePublished).not.toHaveBeenCalled();
  });

  it('approves: audits with no lifecycle side effects', async () => {
    const harness = build(CalculationRuleStatus.Draft);
    harness.rules.applyStatusChange.mockReturnValueOnce(
      rule(CalculationRuleStatus.Approved),
    );
    await harness.useCase.execute(actor, 'team-1', 'rule-1', {
      transition: CalculationRuleTransition.Approve,
      expectedRecordVersion: 1,
    });
    expect(harness.events.enqueue).not.toHaveBeenCalled();
    expect(harness.audit.record).toHaveBeenCalled();
  });

  it('rejects an illegal transition', async () => {
    const harness = build(CalculationRuleStatus.Published);
    await expect(
      harness.useCase.execute(actor, 'team-1', 'rule-1', {
        transition: CalculationRuleTransition.Approve,
        expectedRecordVersion: 1,
      }),
    ).rejects.toBeInstanceOf(CalculationRuleInvalidTransitionError);
  });

  it('reports an optimistic version conflict', async () => {
    const harness = build(CalculationRuleStatus.Approved);
    harness.rules.applyStatusChange.mockReturnValueOnce(null);
    await expect(
      harness.useCase.execute(actor, 'team-1', 'rule-1', {
        transition: CalculationRuleTransition.Publish,
        expectedRecordVersion: 1,
      }),
    ).rejects.toBeInstanceOf(CalculationRuleVersionConflictError);
  });
});
