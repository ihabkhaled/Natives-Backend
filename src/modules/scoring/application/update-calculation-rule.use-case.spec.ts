import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CalculationRuleNotEditableError } from '../errors/calculation-rule-not-editable.error';
import { CalculationRuleVersionConflictError } from '../errors/calculation-rule-version-conflict.error';
import { ScoringValidationError } from '../errors/scoring-validation.error';
import { CalculationRuleStatus, ScoreCategory } from '../model/scoring.enums';
import type { CalculationRule, RuleContent } from '../model/scoring.types';
import { UpdateCalculationRuleUseCase } from './update-calculation-rule.use-case';

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
    components: [
      { categoryKey: ScoreCategory.Training, weight: 1, minSample: 1 },
    ],
  };
}

function rule(status = CalculationRuleStatus.Draft): CalculationRule {
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
    components: [
      { categoryKey: ScoreCategory.Training, weight: 1, minSample: 1 },
    ],
    effectiveFrom: null,
    effectiveTo: null,
    recordVersion: 2,
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
  const lookup = { requireForWrite: vi.fn(() => rule()) };
  const repository = { updateContent: vi.fn(() => rule()) };
  const audit = { record: vi.fn() };
  const useCase = new UpdateCalculationRuleUseCase(
    unitOfWork as never,
    clock as never,
    lookup as never,
    repository as never,
    audit as never,
  );
  return { lookup, repository, audit, useCase };
}

describe('UpdateCalculationRuleUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('edits a draft rule and audits', async () => {
    const updated = await harness.useCase.execute(actor, 'team-1', 'rule-1', {
      expectedRecordVersion: 2,
      content: content(),
    });
    expect(updated.recordVersion).toBe(2);
    expect(harness.audit.record).toHaveBeenCalled();
  });

  it('refuses to edit a non-draft rule', async () => {
    harness.lookup.requireForWrite.mockReturnValueOnce(
      rule(CalculationRuleStatus.Published),
    );
    await expect(
      harness.useCase.execute(actor, 'team-1', 'rule-1', {
        expectedRecordVersion: 2,
        content: content(),
      }),
    ).rejects.toBeInstanceOf(CalculationRuleNotEditableError);
  });

  it('rejects invalid content', async () => {
    await expect(
      harness.useCase.execute(actor, 'team-1', 'rule-1', {
        expectedRecordVersion: 2,
        content: content(' '),
      }),
    ).rejects.toBeInstanceOf(ScoringValidationError);
  });

  it('reports an optimistic version conflict', async () => {
    harness.repository.updateContent.mockReturnValueOnce(null);
    await expect(
      harness.useCase.execute(actor, 'team-1', 'rule-1', {
        expectedRecordVersion: 1,
        content: content(),
      }),
    ).rejects.toBeInstanceOf(CalculationRuleVersionConflictError);
  });
});
