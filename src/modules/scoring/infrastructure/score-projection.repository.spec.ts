import { beforeEach, describe, expect, it, vi } from 'vitest';

import { computeMembershipProjection } from '../lib/scoring.builders';
import { CalculationRuleStatus, ScoreCategory } from '../model/scoring.enums';
import type { ScoreProjectionRow } from '../model/scoring.rows';
import type { CalculationRule, ProjectionTarget } from '../model/scoring.types';
import { ScoreProjectionRepository } from './score-projection.repository';

const NOW = new Date('2026-03-01T00:00:00.000Z');

function build() {
  const scope = { run: vi.fn() };
  return { scope, repository: new ScoreProjectionRepository() };
}

const RULE: CalculationRule = {
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
  components: [
    { categoryKey: ScoreCategory.Training, weight: 1, minSample: 1 },
  ],
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

const TARGET: ProjectionTarget = {
  id: 'proj-1',
  teamId: 'team-1',
  seasonId: null,
  membershipId: 'mem-1',
  periodId: null,
};

function projectionRow(): ScoreProjectionRow {
  return {
    id: 'proj-1',
    team_id: 'team-1',
    season_id: null,
    membership_id: 'mem-1',
    period_id: null,
    rule_id: 'rule-1',
    rule_key: 'legacy_overall',
    rule_version: 1,
    status: 'ready',
    overall_value: '4',
    overall_numerator: '4',
    overall_denominator: '1',
    included_count: 1,
    excluded_count: 0,
    completeness: '1',
    confidence: 'low',
    explanation: { rule: { ruleId: 'rule-1' } },
    source_hash: 'abc',
    error: null,
    computed_at: NOW,
    created_at: NOW,
    updated_at: NOW,
  };
}

describe('ScoreProjectionRepository', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('upserts a ready projection', async () => {
    harness.scope.run.mockResolvedValueOnce([]);
    const projection = computeMembershipProjection(
      RULE,
      TARGET,
      [{ categoryKey: ScoreCategory.Training, values: [4], totalMetrics: 1 }],
      NOW,
    );
    await harness.repository.upsertReady(harness.scope as never, projection);
    expect(harness.scope.run).toHaveBeenCalledTimes(1);
  });

  it('upserts a failed projection', async () => {
    harness.scope.run.mockResolvedValueOnce([]);
    await harness.repository.upsertFailed(
      harness.scope as never,
      TARGET,
      RULE,
      'boom',
      NOW,
    );
    expect(harness.scope.run).toHaveBeenCalledTimes(1);
  });

  it('marks projections stale and reports the count', async () => {
    harness.scope.run.mockResolvedValueOnce([{ count: 3 }]);
    await expect(
      harness.repository.markStaleForTeamRuleKey(
        harness.scope as never,
        'team-1',
        'legacy_overall',
      ),
    ).resolves.toBe(3);
    harness.scope.run.mockResolvedValueOnce([]);
    await expect(
      harness.repository.markStaleForTeamRuleKey(
        harness.scope as never,
        'team-1',
        'legacy_overall',
      ),
    ).resolves.toBe(0);
  });

  it('deletes superseded projections and reports the count', async () => {
    harness.scope.run.mockResolvedValueOnce([{ count: 2 }]);
    await expect(
      harness.repository.deleteSupersededForTeam(
        harness.scope as never,
        'team-1',
        'rule-1',
      ),
    ).resolves.toBe(2);
    harness.scope.run.mockResolvedValueOnce([]);
    await expect(
      harness.repository.deleteSupersededForTeam(
        harness.scope as never,
        'team-1',
        'rule-1',
      ),
    ).resolves.toBe(0);
  });

  it('lists and counts a team’s projections', async () => {
    harness.scope.run.mockResolvedValueOnce([projectionRow()]);
    await expect(
      harness.repository.listForTeam(harness.scope as never, 'team-1', {
        limit: 20,
        offset: 0,
      }),
    ).resolves.toHaveLength(1);
    harness.scope.run.mockResolvedValueOnce([{ count: 7 }]);
    await expect(
      harness.repository.countForTeam(harness.scope as never, 'team-1'),
    ).resolves.toBe(7);
    harness.scope.run.mockResolvedValueOnce([]);
    await expect(
      harness.repository.countForTeam(harness.scope as never, 'team-1'),
    ).resolves.toBe(0);
  });

  it('lists projections by membership and by user', async () => {
    harness.scope.run.mockResolvedValueOnce([projectionRow()]);
    await expect(
      harness.repository.listForMembership(
        harness.scope as never,
        'team-1',
        'mem-1',
      ),
    ).resolves.toHaveLength(1);
    harness.scope.run.mockResolvedValueOnce([projectionRow()]);
    await expect(
      harness.repository.listForUser(
        harness.scope as never,
        'team-1',
        'user-1',
      ),
    ).resolves.toHaveLength(1);
  });
});
