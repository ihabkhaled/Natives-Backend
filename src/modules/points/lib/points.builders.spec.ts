import { describe, expect, it } from 'vitest';

import {
  LedgerEntryType,
  LedgerSourceType,
  PointsRuleStatus,
} from '../model/points.enums';
import type {
  ActivityAwardCommand,
  ActivityReversalCommand,
  BadgeDefinition,
  BadgeScope,
  LedgerEntry,
  PointsRule,
} from '../model/points.types';
import {
  buildAdjustmentEntry,
  buildAwardEntry,
  buildBadgeEarnedEvent,
  buildLedgerAudit,
  buildNewRule,
  buildPlayerBadge,
  buildPointsAdjustedEvent,
  buildPointsAwardedEvent,
  buildPointsReversedEvent,
  buildReversalEntry,
  buildRuleAudit,
  buildRuleCreatedEvent,
  buildRulePublishedEvent,
  buildRuleRetiredEvent,
  buildRuleStatusChange,
} from './points.builders';

const NOW = new Date('2026-02-01T00:00:00.000Z');
const EARLIER = new Date('2026-01-01T00:00:00.000Z');

function rule(overrides: Partial<PointsRule> = {}): PointsRule {
  return {
    ruleId: 'rule-1',
    teamId: 'team-1',
    seasonId: null,
    ruleKey: 'external_training',
    version: 2,
    name: 'External training',
    description: null,
    status: PointsRuleStatus.Approved,
    pointEntries: [],
    effectiveFrom: null,
    effectiveTo: null,
    recordVersion: 3,
    createdBy: 'creator',
    publishedBy: null,
    publishedAt: null,
    retiredAt: null,
    createdAt: EARLIER,
    updatedAt: EARLIER,
    ...overrides,
  };
}

const AWARD_COMMAND: ActivityAwardCommand = {
  submissionId: 'sub-1',
  teamId: 'team-1',
  seasonId: 'season-1',
  membershipId: 'mem-1',
  activityTypeId: 'type-1',
  performedOn: '2026-01-20',
  actorUserId: 'coach-1',
};

function ledgerEntry(overrides: Partial<LedgerEntry> = {}): LedgerEntry {
  return {
    id: 'entry-1',
    teamId: 'team-1',
    seasonId: 'season-1',
    membershipId: 'mem-1',
    entryType: LedgerEntryType.Award,
    amount: 4,
    sourceType: LedgerSourceType.ActivitySubmission,
    sourceId: 'sub-1',
    ruleId: 'rule-1',
    ruleVersion: 2,
    activityCategory: 'throwing',
    reason: null,
    reasonKey: null,
    reversesEntryId: null,
    idempotencyKey: 'award:sub-1:rule-1',
    effectiveOn: '2026-01-20',
    actorUserId: 'coach-1',
    createdAt: NOW,
    ...overrides,
  };
}

describe('buildNewRule', () => {
  it('builds a draft insert row with the creator and time', () => {
    const built = buildNewRule(
      'id-1',
      'team-1',
      1,
      {
        ruleKey: 'external_training',
        name: 'External training',
        description: null,
        seasonId: null,
        effectiveFrom: null,
        effectiveTo: null,
        pointEntries: [],
      },
      'creator',
      NOW,
    );
    expect(built).toMatchObject({
      id: 'id-1',
      teamId: 'team-1',
      version: 1,
      createdBy: 'creator',
      now: NOW,
    });
  });
});

describe('buildRuleStatusChange', () => {
  it('stamps publisher + publish instant on publish', () => {
    const change = buildRuleStatusChange(
      rule(),
      'team-1',
      PointsRuleStatus.Published,
      'admin',
      3,
      NOW,
    );
    expect(change.publishedBy).toBe('admin');
    expect(change.publishedAt).toBe(NOW);
    expect(change.retiredAt).toBeNull();
  });

  it('stamps the retire instant on retire and keeps the prior publisher', () => {
    const change = buildRuleStatusChange(
      rule({ publishedBy: 'former', publishedAt: EARLIER }),
      'team-1',
      PointsRuleStatus.Retired,
      'admin',
      3,
      NOW,
    );
    expect(change.retiredAt).toBe(NOW);
    expect(change.publishedBy).toBe('former');
    expect(change.publishedAt).toBe(EARLIER);
  });

  it('preserves the publication trail on a revert to draft', () => {
    const change = buildRuleStatusChange(
      rule(),
      'team-1',
      PointsRuleStatus.Draft,
      'admin',
      3,
      NOW,
    );
    expect(change.publishedAt).toBeNull();
    expect(change.retiredAt).toBeNull();
  });
});

describe('ledger builders', () => {
  it('builds an idempotent award entry keyed by submission + rule', () => {
    const entry = buildAwardEntry(
      'id-1',
      AWARD_COMMAND,
      rule(),
      'throwing',
      4,
      NOW,
    );
    expect(entry).toMatchObject({
      entryType: LedgerEntryType.Award,
      amount: 4,
      sourceType: LedgerSourceType.ActivitySubmission,
      sourceId: 'sub-1',
      ruleVersion: 2,
      activityCategory: 'throwing',
      idempotencyKey: 'award:sub-1:rule-1',
      effectiveOn: '2026-01-20',
    });
  });

  it('builds a compensating reversal that exactly offsets an award', () => {
    const command: ActivityReversalCommand = {
      submissionId: 'sub-1',
      teamId: 'team-1',
      membershipId: 'mem-1',
      actorUserId: 'admin',
    };
    const reversal = buildReversalEntry('id-2', command, ledgerEntry(), NOW);
    expect(reversal.entryType).toBe(LedgerEntryType.Reversal);
    expect(reversal.amount).toBe(-4);
    expect(reversal.reversesEntryId).toBe('entry-1');
    expect(reversal.idempotencyKey).toBe('reversal:entry-1');
    expect(reversal.effectiveOn).toBe('2026-02-01');
  });

  it('builds a reasoned, idempotent manual adjustment', () => {
    const entry = buildAdjustmentEntry(
      'id-3',
      'team-1',
      'mem-1',
      {
        amount: -5,
        reason: 'duplicate credit removed',
        operationKey: 'op-123',
      },
      'admin',
      NOW,
    );
    expect(entry).toMatchObject({
      entryType: LedgerEntryType.ManualAdjustment,
      amount: -5,
      sourceType: LedgerSourceType.Manual,
      reason: 'duplicate credit removed',
      idempotencyKey: 'adjust:mem-1:op-123',
      actorUserId: 'admin',
    });
  });
});

describe('badge builder', () => {
  it('captures the points at award and the tier', () => {
    const scope: BadgeScope = {
      teamId: 'team-1',
      membershipId: 'mem-1',
      actorUserId: null,
    };
    const definition: BadgeDefinition = {
      id: 'trophy',
      teamId: null,
      badgeKey: 'trophy',
      name: 'Trophy',
      description: null,
      threshold: 100,
      status: PointsRuleStatus.Draft as never,
      icon: null,
    };
    const badge = buildPlayerBadge('id-4', scope, definition, 150, NOW);
    expect(badge).toMatchObject({
      badgeDefinitionId: 'trophy',
      badgeKey: 'trophy',
      threshold: 100,
      pointsAtAward: 150,
      awardedBy: null,
    });
  });
});

describe('audit + event builders', () => {
  it('builds a ledger audit with a scalar diff', () => {
    const audit = buildLedgerAudit('points.awarded', 'admin', ledgerEntry());
    expect(audit.resourceId).toBe('entry-1');
    expect(audit.diff).toMatchObject({ entryType: 'award', amount: 4 });
  });

  it('builds a rule audit', () => {
    const audit = buildRuleAudit('points.rule.created', 'admin', rule());
    expect(audit.resourceId).toBe('rule-1');
    expect(audit.diff).toMatchObject({ status: 'approved', version: 2 });
  });

  it('builds privacy-safe ledger events', () => {
    for (const build of [
      buildPointsAwardedEvent,
      buildPointsReversedEvent,
      buildPointsAdjustedEvent,
    ]) {
      const event = build(ledgerEntry());
      expect(event.payload).toMatchObject({
        membershipId: 'mem-1',
        amount: 4,
      });
      expect(event.payload).not.toHaveProperty('reason');
    }
  });

  it('builds a badge-earned event', () => {
    const scope: BadgeScope = {
      teamId: 'team-1',
      membershipId: 'mem-1',
      actorUserId: 'admin',
    };
    const definition: BadgeDefinition = {
      id: 'trophy',
      teamId: null,
      badgeKey: 'trophy',
      name: 'Trophy',
      description: null,
      threshold: 100,
      status: PointsRuleStatus.Draft as never,
      icon: null,
    };
    const event = buildBadgeEarnedEvent(scope, definition, 150);
    expect(event.payload).toMatchObject({
      badgeKey: 'trophy',
      threshold: 100,
      total: 150,
    });
  });

  it('builds rule lifecycle events', () => {
    expect(buildRuleCreatedEvent(rule(), 'admin').eventType).toContain(
      'created',
    );
    expect(buildRulePublishedEvent(rule(), 'admin').eventType).toContain(
      'published',
    );
    expect(buildRuleRetiredEvent(rule(), 'admin').eventType).toContain(
      'retired',
    );
  });
});
