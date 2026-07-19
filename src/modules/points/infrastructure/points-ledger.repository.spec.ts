import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LedgerEntryType, LedgerSourceType } from '../model/points.enums';
import type { LedgerEntryRow } from '../model/points.rows';
import type { NewLedgerEntry } from '../model/points.types';
import { PointsLedgerRepository } from './points-ledger.repository';

const NOW = new Date('2026-02-01T00:00:00.000Z');

function entryRow(overrides: Partial<LedgerEntryRow> = {}): LedgerEntryRow {
  return {
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
    effective_on: '2026-01-20',
    actor_user_id: 'coach-1',
    created_at: NOW.toISOString(),
    ...overrides,
  };
}

function newEntry(): NewLedgerEntry {
  return {
    id: 'entry-1',
    teamId: 'team-1',
    seasonId: null,
    membershipId: 'mem-1',
    entryType: LedgerEntryType.Award,
    amount: 4,
    sourceType: LedgerSourceType.ActivitySubmission,
    sourceId: 'sub-1',
    ruleId: 'rule-1',
    ruleVersion: 1,
    activityCategory: 'throwing',
    reason: null,
    reasonKey: null,
    reversesEntryId: null,
    idempotencyKey: 'award:sub-1:rule-1',
    effectiveOn: '2026-01-20',
    actorUserId: 'coach-1',
    now: NOW,
  };
}

function build() {
  const run = vi.fn();
  const scope = { run } as never;
  return { run, scope, repository: new PointsLedgerRepository() };
}

describe('PointsLedgerRepository', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('returns the inserted entry, or null when the idempotency key conflicts', async () => {
    harness.run.mockResolvedValueOnce([entryRow()]);
    expect(
      await harness.repository.insert(harness.scope, newEntry()),
    ).not.toBeNull();
    const sql = String(harness.run.mock.calls[0]?.[0]);
    expect(sql).toContain('ON CONFLICT ("idempotency_key") DO NOTHING');
    harness.run.mockResolvedValueOnce([]);
    expect(
      await harness.repository.insert(harness.scope, newEntry()),
    ).toBeNull();
  });

  it('aggregates cap/cooldown facts, defaulting an empty result', async () => {
    harness.run.mockResolvedValueOnce([
      { same_day_count: 2, last_award_on: '2026-01-10' },
    ]);
    expect(
      await harness.repository.awardFacts(
        harness.scope,
        'mem-1',
        'gym',
        '2026-01-20',
      ),
    ).toEqual({ sameDayCount: 2, lastAwardOn: '2026-01-10' });
    harness.run.mockResolvedValueOnce([]);
    expect(
      await harness.repository.awardFacts(
        harness.scope,
        'mem-1',
        'gym',
        '2026-01-20',
      ),
    ).toEqual({ sameDayCount: 0, lastAwardOn: null });
  });

  it('lists the awards produced by a submission', async () => {
    harness.run.mockResolvedValueOnce([
      entryRow(),
      entryRow({ id: 'entry-2' }),
    ]);
    const awards = await harness.repository.awardsForSubmission(
      harness.scope,
      'sub-1',
    );
    expect(awards).toHaveLength(2);
  });

  it('projects a total from the sum, coalescing null rows to zero', async () => {
    harness.run.mockResolvedValueOnce([{ total: '9' }]);
    expect(await harness.repository.totalFor(harness.scope, 'mem-1')).toBe(9);
    harness.run.mockResolvedValueOnce([{ total: null }]);
    expect(await harness.repository.totalFor(harness.scope, 'mem-1')).toBe(0);
    harness.run.mockResolvedValueOnce([]);
    expect(await harness.repository.totalFor(harness.scope, 'mem-1')).toBe(0);
  });

  it('lists a member ledger history', async () => {
    harness.run.mockResolvedValueOnce([entryRow()]);
    const items = await harness.repository.listForMembership(
      harness.scope,
      'team-1',
      'mem-1',
    );
    expect(items[0]?.amount).toBe(4);
  });

  it('ranks the leaderboard positionally with zero-contribution members present', async () => {
    harness.run.mockResolvedValueOnce([
      { membership_id: 'a', total: '30', badge_count: 1 },
      { membership_id: 'b', total: null, badge_count: 0 },
    ]);
    const rows = await harness.repository.leaderboard(harness.scope, 'team-1', {
      limit: 20,
      offset: 0,
    });
    expect(rows).toEqual([
      { membershipId: 'a', total: 30, rank: 1, badgeCount: 1 },
      { membershipId: 'b', total: 0, rank: 2, badgeCount: 0 },
    ]);
  });

  it('counts active memberships', async () => {
    harness.run.mockResolvedValueOnce([{ count: 5 }]);
    expect(
      await harness.repository.countActiveMemberships(harness.scope, 'team-1'),
    ).toBe(5);
    harness.run.mockResolvedValueOnce([]);
    expect(
      await harness.repository.countActiveMemberships(harness.scope, 'team-1'),
    ).toBe(0);
  });

  it('reads the point-relevant activity type or null', async () => {
    harness.run.mockResolvedValueOnce([
      { id: 'type-1', category: 'gym', points_approval: 'approved' },
    ]);
    expect(
      await harness.repository.findActivityTypePoints(harness.scope, 'type-1'),
    ).toMatchObject({ category: 'gym' });
    harness.run.mockResolvedValueOnce([]);
    expect(
      await harness.repository.findActivityTypePoints(harness.scope, 'type-1'),
    ).toBeNull();
  });
});
