import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CalculationRuleNotFoundError } from '../errors/calculation-rule-not-found.error';
import { CalculationRuleStatus, ScoreCategory } from '../model/scoring.enums';
import type { CalculationRule } from '../model/scoring.types';
import { RebuildScoreProjectionsUseCase } from './rebuild-score-projections.use-case';

const NOW = new Date('2026-03-01T00:00:00.000Z');
const actor = { userId: 'admin-1' } as never;

function rule(): CalculationRule {
  return {
    ruleId: 'rule-1',
    teamId: 'team-1',
    seasonId: null,
    ruleKey: 'legacy_overall',
    version: 1,
    name: 'Legacy overall',
    description: null,
    status: CalculationRuleStatus.Published,
    scaleMin: 0,
    scaleMax: 5,
    minComponents: 1,
    components: [{ categoryKey: ScoreCategory.Training, weight: 1, minSample: 1 }],
    effectiveFrom: null,
    effectiveTo: null,
    recordVersion: 1,
    createdBy: 'admin-1',
    publishedBy: 'admin-1',
    publishedAt: NOW,
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
  const scope = { validate: vi.fn() };
  const rules = { listPublishedForTeam: vi.fn(() => [rule()]) };
  const sources = {
    listActiveMemberships: vi.fn(() => [
      { membership_id: 'mem-1' },
      { membership_id: 'mem-2' },
    ]),
    categorySourcesForTeam: vi.fn(() => [sourceRow('mem-1')]),
  };
  const projections = {
    upsertReady: vi.fn(),
    upsertFailed: vi.fn(),
    deleteSupersededForTeam: vi.fn(() => 0),
  };
  const audit = { record: vi.fn() };
  const events = { enqueue: vi.fn() };
  const useCase = new RebuildScoreProjectionsUseCase(
    unitOfWork as never,
    clock as never,
    idGenerator,
    scope as never,
    rules as never,
    sources as never,
    projections as never,
    audit as never,
    events as never,
  );
  return { rules, sources, projections, audit, events, useCase };
}

describe('RebuildScoreProjectionsUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('rebuilds every active member, prunes, audits, and emits', async () => {
    const outcome = await harness.useCase.execute(actor, 'team-1');
    expect(outcome).toMatchObject({
      scanned: 2,
      rebuilt: 2,
      failed: 0,
      ruleId: 'rule-1',
      ruleVersion: 1,
    });
    expect(harness.projections.upsertReady).toHaveBeenCalledTimes(2);
    expect(harness.projections.deleteSupersededForTeam).toHaveBeenCalled();
    expect(harness.events.enqueue.mock.calls[0]?.[1].eventType).toBe(
      'scoring.projection.rebuilt.v1',
    );
  });

  it('404s when there is no effective published rule', async () => {
    harness.rules.listPublishedForTeam.mockReturnValueOnce([]);
    await expect(
      harness.useCase.execute(actor, 'team-1'),
    ).rejects.toBeInstanceOf(CalculationRuleNotFoundError);
  });

  it('captures a per-member failure without aborting the batch (Error)', async () => {
    harness.projections.upsertReady
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(undefined);
    const outcome = await harness.useCase.execute(actor, 'team-1');
    expect(outcome.failed).toBe(1);
    expect(outcome.rebuilt).toBe(1);
    expect(harness.projections.upsertFailed).toHaveBeenCalledTimes(1);
    expect(harness.projections.upsertFailed.mock.calls[0]?.[3]).toBe('boom');
  });

  it('captures a per-member failure thrown as a non-Error', async () => {
    harness.projections.upsertReady.mockRejectedValueOnce('kaboom');
    const outcome = await harness.useCase.execute(actor, 'team-1');
    expect(outcome.failed).toBeGreaterThanOrEqual(1);
    expect(harness.projections.upsertFailed.mock.calls[0]?.[3]).toBe('kaboom');
  });
});
