import { describe, expect, it } from 'vitest';

import {
  BadgeStatus,
  LedgerEntryType,
  LedgerSourceType,
  PointsApproval,
  PointsRuleStatus,
} from '../model/points.enums';
import type {
  BadgeDefinitionRow,
  LedgerEntryRow,
  PlayerBadgeRow,
  PointsRuleRow,
} from '../model/points.rows';
import type { LedgerEntry, PlayerBadge } from '../model/points.types';
import {
  parsePointEntries,
  toActivityTypePoints,
  toBadgeDefinition,
  toLedgerEntry,
  toLedgerEntryView,
  toPlayerBadge,
  toPlayerBadgeView,
  toPointsRule,
} from './points.mapper';

const RULE_ROW: PointsRuleRow = {
  id: 'rule-1',
  team_id: null,
  season_id: null,
  rule_key: 'external_training',
  version: 1,
  name: 'External training',
  description: null,
  status: 'draft',
  point_entries: [
    { activityCategory: 'gym', points: 2, dailyCap: 1, cooldownDays: null },
    { activityCategory: 'wfdf', points: null, dailyCap: null, cooldownDays: 7 },
  ],
  effective_from: null,
  effective_to: null,
  record_version: 1,
  created_by: null,
  published_by: null,
  published_at: null,
  retired_at: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

const LEDGER_ROW: LedgerEntryRow = {
  id: 'entry-1',
  team_id: 'team-1',
  season_id: null,
  membership_id: 'mem-1',
  entry_type: 'award',
  amount: '4',
  source_type: 'activity_submission',
  source_id: 'sub-1',
  rule_id: 'rule-1',
  rule_version: 1,
  activity_category: 'throwing',
  reason: null,
  reason_key: null,
  reverses_entry_id: null,
  idempotency_key: 'award:sub-1:rule-1',
  effective_on: '2026-01-05',
  actor_user_id: 'coach-1',
  created_at: '2026-01-05T10:00:00.000Z',
};

describe('toPointsRule', () => {
  it('maps the row and parses the jsonb value set, preserving null points', () => {
    const rule = toPointsRule(RULE_ROW);
    expect(rule.status).toBe(PointsRuleStatus.Draft);
    expect(rule.pointEntries).toHaveLength(2);
    expect(rule.pointEntries[0]).toEqual({
      activityCategory: 'gym',
      points: 2,
      dailyCap: 1,
      cooldownDays: null,
    });
    expect(rule.pointEntries[1]?.points).toBeNull();
  });

  it('maps published/retired instants when present', () => {
    const rule = toPointsRule({
      ...RULE_ROW,
      status: 'published',
      published_at: '2026-01-02T00:00:00.000Z',
      retired_at: '2026-01-03T00:00:00.000Z',
    });
    expect(rule.publishedAt).toEqual(new Date('2026-01-02T00:00:00.000Z'));
    expect(rule.retiredAt).toEqual(new Date('2026-01-03T00:00:00.000Z'));
  });
});

describe('parsePointEntries', () => {
  it('returns an empty list for a non-array value', () => {
    expect(parsePointEntries(null)).toEqual([]);
    expect(parsePointEntries({})).toEqual([]);
  });
});

describe('toLedgerEntry', () => {
  it('maps the row and coerces the numeric amount', () => {
    const entry = toLedgerEntry(LEDGER_ROW);
    expect(entry.entryType).toBe(LedgerEntryType.Award);
    expect(entry.sourceType).toBe(LedgerSourceType.ActivitySubmission);
    expect(entry.amount).toBe(4);
    expect(entry.createdAt).toEqual(new Date('2026-01-05T10:00:00.000Z'));
  });
});

describe('badge mappers', () => {
  it('maps a badge definition', () => {
    const row: BadgeDefinitionRow = {
      id: 'trophy',
      team_id: null,
      badge_key: 'trophy',
      name: 'Trophy',
      description: 'tier',
      threshold: 100,
      status: 'active',
      icon: null,
    };
    expect(toBadgeDefinition(row).status).toBe(BadgeStatus.Active);
  });

  it('maps a player badge and its numeric points', () => {
    const row: PlayerBadgeRow = {
      id: 'pb-1',
      team_id: 'team-1',
      membership_id: 'mem-1',
      badge_definition_id: 'trophy',
      badge_key: 'trophy',
      threshold: 100,
      points_at_award: '150',
      awarded_by: null,
      awarded_at: '2026-01-05T10:00:00.000Z',
    };
    expect(toPlayerBadge(row).pointsAtAward).toBe(150);
  });
});

describe('toActivityTypePoints', () => {
  it('maps the point-relevant activity-type projection', () => {
    const type = toActivityTypePoints({
      id: 'type-1',
      category: 'gym',
      points_approval: 'pending',
    });
    expect(type).toEqual({
      activityTypeId: 'type-1',
      category: 'gym',
      pointsApproval: PointsApproval.Pending,
    });
  });
});

describe('view mappers', () => {
  it('strips the idempotency internals from a ledger view', () => {
    const entry: LedgerEntry = toLedgerEntry(LEDGER_ROW);
    const view = toLedgerEntryView(entry);
    expect(view).not.toHaveProperty('idempotencyKey');
    expect(view.amount).toBe(4);
  });

  it('projects only the safe badge fields', () => {
    const badge: PlayerBadge = {
      id: 'pb-1',
      teamId: 'team-1',
      membershipId: 'mem-1',
      badgeDefinitionId: 'trophy',
      badgeKey: 'trophy',
      threshold: 100,
      pointsAtAward: 150,
      awardedBy: null,
      awardedAt: new Date('2026-01-05T10:00:00.000Z'),
    };
    expect(toPlayerBadgeView(badge)).toEqual({
      badgeKey: 'trophy',
      threshold: 100,
      pointsAtAward: 150,
      awardedAt: new Date('2026-01-05T10:00:00.000Z'),
    });
  });
});
