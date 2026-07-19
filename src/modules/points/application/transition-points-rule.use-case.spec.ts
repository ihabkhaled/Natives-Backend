import type { AuthUserIdentity } from '@core/auth';
import { describe, expect, it, vi } from 'vitest';

import { PointsRuleInvalidTransitionError } from '../errors/points-rule-invalid-transition.error';
import { PointsRuleVersionConflictError } from '../errors/points-rule-version-conflict.error';
import { PointsRuleStatus, PointsRuleTransition } from '../model/points.enums';
import type { PointsRule } from '../model/points.types';
import { TransitionPointsRuleUseCase } from './transition-points-rule.use-case';

const ACTOR: AuthUserIdentity = {
  userId: 'admin',
  email: 'a@x.test',
  roles: [],
};
const NOW = new Date('2026-02-01T00:00:00.000Z');

function rule(status: PointsRuleStatus): PointsRule {
  return {
    ruleId: 'rule-1',
    teamId: 'team-1',
    seasonId: null,
    ruleKey: 'external_training',
    version: 1,
    name: 'External training',
    description: null,
    status,
    pointEntries: [],
    effectiveFrom: null,
    effectiveTo: null,
    recordVersion: 1,
    createdBy: null,
    publishedBy: null,
    publishedAt: null,
    retiredAt: null,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function build(existing: PointsRule) {
  const tx = {} as never;
  const unitOfWork = {
    runInTransaction: vi.fn((op: (scope: never) => unknown) => op(tx)),
  };
  const clock = { now: vi.fn().mockReturnValue(NOW) };
  const lookup = { requireForWrite: vi.fn().mockResolvedValue(existing) };
  const rules = {
    applyStatusChange: vi.fn(),
    retirePublished: vi.fn().mockResolvedValue(1),
  };
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const events = { enqueue: vi.fn().mockResolvedValue(undefined) };
  const useCase = new TransitionPointsRuleUseCase(
    unitOfWork as never,
    clock as never,
    lookup as never,
    rules as never,
    audit as never,
    events as never,
  );
  return { rules, audit, events, useCase };
}

function command(transition: PointsRuleTransition) {
  return { transition, expectedRecordVersion: 1 };
}

describe('TransitionPointsRuleUseCase', () => {
  it('publishes, retiring the prior published version and announcing it', async () => {
    const harness = build(rule(PointsRuleStatus.Approved));
    harness.rules.applyStatusChange.mockResolvedValue(
      rule(PointsRuleStatus.Published),
    );
    await harness.useCase.execute(
      ACTOR,
      'team-1',
      'rule-1',
      command(PointsRuleTransition.Publish),
    );
    expect(harness.rules.retirePublished).toHaveBeenCalledOnce();
    expect(harness.events.enqueue.mock.calls[0]?.[1]?.eventType).toContain(
      'published',
    );
  });

  it('retires a published rule and announces it', async () => {
    const harness = build(rule(PointsRuleStatus.Published));
    harness.rules.applyStatusChange.mockResolvedValue(
      rule(PointsRuleStatus.Retired),
    );
    await harness.useCase.execute(
      ACTOR,
      'team-1',
      'rule-1',
      command(PointsRuleTransition.Retire),
    );
    expect(harness.rules.retirePublished).not.toHaveBeenCalled();
    expect(harness.events.enqueue.mock.calls[0]?.[1]?.eventType).toContain(
      'retired',
    );
  });

  it('rejects an illegal transition', async () => {
    const harness = build(rule(PointsRuleStatus.Draft));
    await expect(
      harness.useCase.execute(
        ACTOR,
        'team-1',
        'rule-1',
        command(PointsRuleTransition.Publish),
      ),
    ).rejects.toBeInstanceOf(PointsRuleInvalidTransitionError);
    expect(harness.rules.applyStatusChange).not.toHaveBeenCalled();
  });

  it('rejects a stale version', async () => {
    const harness = build(rule(PointsRuleStatus.Approved));
    harness.rules.applyStatusChange.mockResolvedValue(null);
    await expect(
      harness.useCase.execute(
        ACTOR,
        'team-1',
        'rule-1',
        command(PointsRuleTransition.Publish),
      ),
    ).rejects.toBeInstanceOf(PointsRuleVersionConflictError);
    expect(harness.events.enqueue).not.toHaveBeenCalled();
  });
});
