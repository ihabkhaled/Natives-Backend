import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ScoringValidationError } from '../errors/scoring-validation.error';
import { CalculationRuleStatus, ScoreCategory } from '../model/scoring.enums';
import type { CalculationRule, RuleContent } from '../model/scoring.types';
import { CreateCalculationRuleUseCase } from './create-calculation-rule.use-case';

const NOW = new Date('2026-03-01T00:00:00.000Z');
const actor = { userId: 'admin-1' } as never;

function content(name = 'Legacy overall'): RuleContent {
  return {
    ruleKey: 'legacy_overall',
    name,
    description: null,
    seasonId: null,
    scaleMin: 0,
    scaleMax: 5,
    minComponents: 1,
    effectiveFrom: null,
    effectiveTo: null,
    components: [{ categoryKey: ScoreCategory.Training, weight: 1, minSample: 1 }],
  };
}

function rule(): CalculationRule {
  return {
    ruleId: 'rule-1',
    teamId: 'team-1',
    seasonId: null,
    ruleKey: 'legacy_overall',
    version: 1,
    name: 'Legacy overall',
    description: null,
    status: CalculationRuleStatus.Draft,
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

function build() {
  const tx = {} as never;
  const unitOfWork = {
    runInTransaction: vi.fn((cb: (t: never) => unknown) => cb(tx)),
  };
  const clock = { now: vi.fn(() => NOW) };
  const idGenerator = { generate: vi.fn(() => 'rule-1') };
  const scope = { validate: vi.fn() };
  const repository = {
    nextVersion: vi.fn(() => 1),
    insert: vi.fn(() => rule()),
  };
  const audit = { record: vi.fn() };
  const events = { enqueue: vi.fn() };
  const useCase = new CreateCalculationRuleUseCase(
    unitOfWork as never,
    clock as never,
    idGenerator,
    scope as never,
    repository as never,
    audit as never,
    events as never,
  );
  return { scope, repository, audit, events, useCase };
}

describe('CreateCalculationRuleUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('validates scope + content, versions, persists, audits, and emits', async () => {
    const created = await harness.useCase.execute(actor, 'team-1', {
      content: content(),
    });
    expect(harness.scope.validate).toHaveBeenCalled();
    expect(harness.repository.nextVersion).toHaveBeenCalledWith(
      expect.anything(),
      'team-1',
      'legacy_overall',
    );
    expect(harness.audit.record).toHaveBeenCalled();
    expect(harness.events.enqueue.mock.calls[0]?.[1].eventType).toBe(
      'scoring.rule.created.v1',
    );
    expect(created.status).toBe(CalculationRuleStatus.Draft);
  });

  it('rejects invalid content before persisting', async () => {
    await expect(
      harness.useCase.execute(actor, 'team-1', { content: content(' ') }),
    ).rejects.toBeInstanceOf(ScoringValidationError);
    expect(harness.repository.insert).not.toHaveBeenCalled();
  });
});
