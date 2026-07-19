import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PointsRuleStatus } from '../model/points.enums';
import type { PointsRuleRow } from '../model/points.rows';
import type { NewPointsRule, RuleStatusChange } from '../model/points.types';
import { PointsRuleRepository } from './points-rule.repository';

const NOW = new Date('2026-02-01T00:00:00.000Z');

function ruleRow(overrides: Partial<PointsRuleRow> = {}): PointsRuleRow {
  return {
    id: 'rule-1',
    team_id: 'team-1',
    season_id: null,
    rule_key: 'external_training',
    version: 1,
    name: 'External training',
    description: null,
    status: 'draft',
    point_entries: [],
    effective_from: null,
    effective_to: null,
    record_version: 1,
    created_by: null,
    published_by: null,
    published_at: null,
    retired_at: null,
    created_at: NOW.toISOString(),
    updated_at: NOW.toISOString(),
    ...overrides,
  };
}

function newRule(): NewPointsRule {
  return {
    id: 'rule-1',
    teamId: 'team-1',
    version: 1,
    content: {
      ruleKey: 'external_training',
      name: 'External training',
      description: null,
      seasonId: null,
      effectiveFrom: null,
      effectiveTo: null,
      pointEntries: [
        { activityCategory: 'gym', points: 2, dailyCap: 1, cooldownDays: null },
      ],
    },
    createdBy: 'admin',
    now: NOW,
  };
}

function statusChange(): RuleStatusChange {
  return {
    id: 'rule-1',
    teamId: 'team-1',
    expectedRecordVersion: 1,
    toStatus: PointsRuleStatus.Published,
    publishedBy: 'admin',
    publishedAt: NOW,
    retiredAt: null,
    now: NOW,
  };
}

function build() {
  const run = vi.fn();
  const scope = { run } as never;
  return { run, scope, repository: new PointsRuleRepository() };
}

describe('PointsRuleRepository', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('inserts a draft rule and serializes the value set as jsonb', async () => {
    harness.run.mockResolvedValueOnce([ruleRow()]);
    const rule = await harness.repository.insert(harness.scope, newRule());
    expect(rule.ruleKey).toBe('external_training');
    const params = harness.run.mock.calls[0]?.[1] as unknown[];
    expect(params).toContain(
      JSON.stringify([
        { activityCategory: 'gym', points: 2, dailyCap: 1, cooldownDays: null },
      ]),
    );
  });

  it('throws when the insert returns no row', async () => {
    harness.run.mockResolvedValueOnce([]);
    await expect(
      harness.repository.insert(harness.scope, newRule()),
    ).rejects.toThrow('points rule write');
  });

  it('computes the next version from the current max', async () => {
    harness.run.mockResolvedValueOnce([{ count: 2 }]);
    expect(
      await harness.repository.nextVersion(harness.scope, 'team-1', 'k'),
    ).toBe(3);
    harness.run.mockResolvedValueOnce([]);
    expect(
      await harness.repository.nextVersion(harness.scope, 'team-1', 'k'),
    ).toBe(1);
  });

  it('finds a writable rule or null', async () => {
    harness.run.mockResolvedValueOnce([ruleRow()]);
    expect(
      await harness.repository.findForWrite(harness.scope, 'team-1', 'rule-1'),
    ).not.toBeNull();
    harness.run.mockResolvedValueOnce([]);
    expect(
      await harness.repository.findForWrite(harness.scope, 'team-1', 'rule-1'),
    ).toBeNull();
  });

  it('finds the single effective published rule or null', async () => {
    harness.run.mockResolvedValueOnce([ruleRow({ status: 'published' })]);
    const rule = await harness.repository.findPublished(
      harness.scope,
      'team-1',
    );
    expect(rule?.status).toBe(PointsRuleStatus.Published);
    harness.run.mockResolvedValueOnce([]);
    expect(
      await harness.repository.findPublished(harness.scope, 'team-1'),
    ).toBeNull();
  });

  it('applies a status change or returns null on a stale version', async () => {
    harness.run.mockResolvedValueOnce([ruleRow({ status: 'published' })]);
    expect(
      await harness.repository.applyStatusChange(harness.scope, statusChange()),
    ).not.toBeNull();
    harness.run.mockResolvedValueOnce([]);
    expect(
      await harness.repository.applyStatusChange(harness.scope, statusChange()),
    ).toBeNull();
  });

  it('retires the prior published version and reports the count', async () => {
    harness.run.mockResolvedValueOnce([{ count: 1 }]);
    expect(
      await harness.repository.retirePublished(
        harness.scope,
        'team-1',
        'k',
        'rule-2',
        NOW,
      ),
    ).toBe(1);
    harness.run.mockResolvedValueOnce([]);
    expect(
      await harness.repository.retirePublished(
        harness.scope,
        'team-1',
        'k',
        'rule-2',
        NOW,
      ),
    ).toBe(0);
  });

  it('lists and counts team rules plus global candidates', async () => {
    harness.run.mockResolvedValueOnce([ruleRow(), ruleRow({ team_id: null })]);
    const items = await harness.repository.listForTeam(
      harness.scope,
      'team-1',
      {
        limit: 20,
        offset: 0,
      },
    );
    expect(items).toHaveLength(2);
    harness.run.mockResolvedValueOnce([{ count: 2 }]);
    expect(await harness.repository.countForTeam(harness.scope, 'team-1')).toBe(
      2,
    );
    harness.run.mockResolvedValueOnce([]);
    expect(await harness.repository.countForTeam(harness.scope, 'team-1')).toBe(
      0,
    );
  });
});
