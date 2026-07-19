import type { AuthUserIdentity } from '@core/auth';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PointsValidationError } from '../errors/points-validation.error';
import type { CreateRuleCommand } from '../model/points.types';
import { CreatePointsRuleUseCase } from './create-points-rule.use-case';

const ACTOR: AuthUserIdentity = {
  userId: 'admin',
  email: 'a@x.test',
  roles: [],
};

function command(): CreateRuleCommand {
  return {
    content: {
      ruleKey: 'external_training',
      name: 'External training',
      description: null,
      seasonId: null,
      effectiveFrom: null,
      effectiveTo: null,
      pointEntries: [
        {
          activityCategory: 'gym',
          points: 2,
          dailyCap: null,
          cooldownDays: null,
        },
      ],
    },
  };
}

function build() {
  const tx = {} as never;
  const unitOfWork = {
    runInTransaction: vi.fn((op: (scope: never) => unknown) => op(tx)),
  };
  const clock = {
    now: vi.fn().mockReturnValue(new Date('2026-02-01T00:00:00Z')),
  };
  const idGenerator = { generate: vi.fn().mockReturnValue('rule-1') };
  const scope = { validate: vi.fn().mockResolvedValue(undefined) };
  const repository = {
    nextVersion: vi.fn().mockResolvedValue(1),
    insert: vi
      .fn()
      .mockResolvedValue({ ruleId: 'rule-1', ruleKey: 'external_training' }),
  };
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const events = { enqueue: vi.fn().mockResolvedValue(undefined) };
  const useCase = new CreatePointsRuleUseCase(
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

describe('CreatePointsRuleUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('validates scope + content, assigns the next version, and records the draft', async () => {
    const rule = await harness.useCase.execute(ACTOR, 'team-1', command());
    expect(harness.scope.validate).toHaveBeenCalledOnce();
    expect(harness.repository.nextVersion).toHaveBeenCalledWith(
      expect.anything(),
      'team-1',
      'external_training',
    );
    expect(harness.audit.record).toHaveBeenCalledOnce();
    expect(harness.events.enqueue).toHaveBeenCalledOnce();
    expect(rule.ruleId).toBe('rule-1');
  });

  it('rejects an invalid value set before writing', async () => {
    const invalid = command();
    const empty = { content: { ...invalid.content, pointEntries: [] } };
    await expect(
      harness.useCase.execute(ACTOR, 'team-1', empty),
    ).rejects.toBeInstanceOf(PointsValidationError);
    expect(harness.repository.insert).not.toHaveBeenCalled();
  });
});
