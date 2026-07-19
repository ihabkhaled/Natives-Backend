import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CalculationRuleStatus, ScoreCategory } from '../model/scoring.enums';
import type { CalculationRuleRow } from '../model/scoring.rows';
import type {
  NewCalculationRule,
  RuleContent,
  RuleContentUpdate,
  RuleStatusChange,
} from '../model/scoring.types';
import { CalculationRuleRepository } from './calculation-rule.repository';

const NOW = new Date('2026-03-01T00:00:00.000Z');

function build() {
  const scope = { run: vi.fn() };
  return { scope, repository: new CalculationRuleRepository() };
}

function ruleRow(overrides: Partial<CalculationRuleRow> = {}): CalculationRuleRow {
  return {
    id: 'rule-1',
    team_id: 'team-1',
    season_id: null,
    rule_key: 'legacy_overall',
    version: 1,
    name: 'Legacy overall',
    description: null,
    status: 'draft',
    scale_min: '0',
    scale_max: '5',
    min_components: 1,
    components: [{ categoryKey: 'training', weight: 1, minSample: 1 }],
    effective_from: null,
    effective_to: null,
    record_version: 1,
    created_by: 'admin-1',
    published_by: null,
    published_at: null,
    retired_at: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function content(): RuleContent {
  return {
    ruleKey: 'legacy_overall',
    name: 'Legacy overall',
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

function newRule(): NewCalculationRule {
  return { id: 'rule-1', teamId: 'team-1', version: 1, content: content(), createdBy: 'admin-1', now: NOW };
}

function update(): RuleContentUpdate {
  return { id: 'rule-1', teamId: 'team-1', expectedRecordVersion: 1, content: content(), now: NOW };
}

function statusChange(): RuleStatusChange {
  return {
    id: 'rule-1',
    teamId: 'team-1',
    expectedRecordVersion: 1,
    toStatus: CalculationRuleStatus.Published,
    publishedBy: 'admin-1',
    publishedAt: NOW,
    retiredAt: null,
    now: NOW,
  };
}

describe('CalculationRuleRepository', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('inserts a rule and throws when no row returns', async () => {
    harness.scope.run.mockResolvedValueOnce([ruleRow()]);
    await expect(
      harness.repository.insert(harness.scope as never, newRule()),
    ).resolves.toMatchObject({ ruleId: 'rule-1' });
    harness.scope.run.mockResolvedValueOnce([]);
    await expect(
      harness.repository.insert(harness.scope as never, newRule()),
    ).rejects.toThrow('Expected a returned row');
  });

  it('computes the next version, defaulting to 1', async () => {
    harness.scope.run.mockResolvedValueOnce([{ count: 2 }]);
    await expect(
      harness.repository.nextVersion(harness.scope as never, 'team-1', 'legacy_overall'),
    ).resolves.toBe(3);
    harness.scope.run.mockResolvedValueOnce([]);
    await expect(
      harness.repository.nextVersion(harness.scope as never, 'team-1', 'legacy_overall'),
    ).resolves.toBe(1);
  });

  it('finds a rule for write or returns null', async () => {
    harness.scope.run.mockResolvedValueOnce([ruleRow()]);
    await expect(
      harness.repository.findForWrite(harness.scope as never, 'team-1', 'rule-1'),
    ).resolves.toMatchObject({ ruleId: 'rule-1' });
    harness.scope.run.mockResolvedValueOnce([]);
    await expect(
      harness.repository.findForWrite(harness.scope as never, 'team-1', 'rule-1'),
    ).resolves.toBeNull();
  });

  it('finds a visible rule or returns null', async () => {
    harness.scope.run.mockResolvedValueOnce([ruleRow()]);
    await expect(
      harness.repository.findVisible(harness.scope as never, 'team-1', 'rule-1'),
    ).resolves.toMatchObject({ ruleId: 'rule-1' });
    harness.scope.run.mockResolvedValueOnce([]);
    await expect(
      harness.repository.findVisible(harness.scope as never, 'team-1', 'rule-1'),
    ).resolves.toBeNull();
  });

  it('updates content or returns null on a version miss', async () => {
    harness.scope.run.mockResolvedValueOnce([ruleRow({ record_version: 2 })]);
    await expect(
      harness.repository.updateContent(harness.scope as never, update()),
    ).resolves.toMatchObject({ recordVersion: 2 });
    harness.scope.run.mockResolvedValueOnce([]);
    await expect(
      harness.repository.updateContent(harness.scope as never, update()),
    ).resolves.toBeNull();
  });

  it('applies a status change or returns null on a version miss', async () => {
    harness.scope.run.mockResolvedValueOnce([ruleRow({ status: 'published' })]);
    await expect(
      harness.repository.applyStatusChange(harness.scope as never, statusChange()),
    ).resolves.toMatchObject({ status: CalculationRuleStatus.Published });
    harness.scope.run.mockResolvedValueOnce([]);
    await expect(
      harness.repository.applyStatusChange(harness.scope as never, statusChange()),
    ).resolves.toBeNull();
  });

  it('retires prior published rules and reports the count', async () => {
    harness.scope.run.mockResolvedValueOnce([{ count: 1 }]);
    await expect(
      harness.repository.retirePublished(harness.scope as never, 'team-1', 'legacy_overall', 'rule-2', NOW),
    ).resolves.toBe(1);
    harness.scope.run.mockResolvedValueOnce([]);
    await expect(
      harness.repository.retirePublished(harness.scope as never, 'team-1', 'legacy_overall', 'rule-2', NOW),
    ).resolves.toBe(0);
  });

  it('lists and counts rules for a team', async () => {
    harness.scope.run.mockResolvedValueOnce([ruleRow(), ruleRow({ id: 'rule-2' })]);
    await expect(
      harness.repository.listForTeam(harness.scope as never, 'team-1', { limit: 20, offset: 0 }),
    ).resolves.toHaveLength(2);
    harness.scope.run.mockResolvedValueOnce([{ count: 5 }]);
    await expect(
      harness.repository.countForTeam(harness.scope as never, 'team-1'),
    ).resolves.toBe(5);
    harness.scope.run.mockResolvedValueOnce([]);
    await expect(
      harness.repository.countForTeam(harness.scope as never, 'team-1'),
    ).resolves.toBe(0);
  });

  it('lists published rules for effective selection', async () => {
    harness.scope.run.mockResolvedValueOnce([ruleRow({ status: 'published' })]);
    await expect(
      harness.repository.listPublishedForTeam(harness.scope as never, 'team-1'),
    ).resolves.toHaveLength(1);
  });
});
