import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PointsApproval, PointsRuleStatus } from '../model/points.enums';
import type {
  ActivityAwardCommand,
  ActivityTypePoints,
  PointsRule,
} from '../model/points.types';
import { AwardActivityPointsService } from './award-activity-points.service';

const NOW = new Date('2026-02-01T00:00:00.000Z');

const COMMAND: ActivityAwardCommand = {
  submissionId: 'sub-1',
  teamId: 'team-1',
  seasonId: null,
  membershipId: 'mem-1',
  activityTypeId: 'type-1',
  performedOn: '2026-01-20',
  actorUserId: 'coach-1',
};

const RULE: PointsRule = {
  ruleId: 'rule-1',
  teamId: null,
  seasonId: null,
  ruleKey: 'external_training',
  version: 1,
  name: 'External training',
  description: null,
  status: PointsRuleStatus.Published,
  pointEntries: [
    { activityCategory: 'gym', points: 2, dailyCap: null, cooldownDays: null },
  ],
  effectiveFrom: null,
  effectiveTo: null,
  recordVersion: 1,
  createdBy: null,
  publishedBy: null,
  publishedAt: NOW,
  retiredAt: null,
  createdAt: NOW,
  updatedAt: NOW,
};

const TYPE: ActivityTypePoints = {
  activityTypeId: 'type-1',
  category: 'gym',
  pointsApproval: PointsApproval.Approved,
};

function build() {
  const clock = { now: vi.fn().mockReturnValue(NOW) };
  const idGenerator = { generate: vi.fn().mockReturnValue('entry-1') };
  const rules = { findPublished: vi.fn().mockResolvedValue(RULE) };
  const ledger = {
    findActivityTypePoints: vi.fn().mockResolvedValue(TYPE),
    awardFacts: vi
      .fn()
      .mockResolvedValue({ sameDayCount: 0, lastAwardOn: null }),
    insert: vi.fn().mockResolvedValue({ id: 'entry-1', teamId: 'team-1' }),
  };
  const badges = { sync: vi.fn().mockResolvedValue(undefined) };
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const events = { enqueue: vi.fn().mockResolvedValue(undefined) };
  const service = new AwardActivityPointsService(
    clock as never,
    idGenerator,
    rules as never,
    ledger as never,
    badges as never,
    audit as never,
    events as never,
  );
  return { rules, ledger, badges, audit, events, service, tx: {} as never };
}

describe('AwardActivityPointsService', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('awards, syncs badges, audits, and publishes when a rule prices the activity', async () => {
    await harness.service.awardForApproval(harness.tx, COMMAND);
    expect(harness.ledger.insert).toHaveBeenCalledOnce();
    const entry = harness.ledger.insert.mock.calls[0]?.[1];
    expect(entry).toMatchObject({
      amount: 2,
      idempotencyKey: 'award:sub-1:rule-1',
    });
    expect(harness.badges.sync).toHaveBeenCalledOnce();
    expect(harness.audit.record).toHaveBeenCalledOnce();
    expect(harness.events.enqueue).toHaveBeenCalledOnce();
  });

  it('awards nothing when no rule is published', async () => {
    harness.rules.findPublished.mockResolvedValue(null);
    await harness.service.awardForApproval(harness.tx, COMMAND);
    expect(harness.ledger.findActivityTypePoints).not.toHaveBeenCalled();
    expect(harness.ledger.insert).not.toHaveBeenCalled();
  });

  it('awards nothing when the activity type is missing', async () => {
    harness.ledger.findActivityTypePoints.mockResolvedValue(null);
    await harness.service.awardForApproval(harness.tx, COMMAND);
    expect(harness.ledger.insert).not.toHaveBeenCalled();
  });

  it('awards nothing for a pending activity value (null-not-zero)', async () => {
    harness.ledger.findActivityTypePoints.mockResolvedValue({
      ...TYPE,
      pointsApproval: PointsApproval.Pending,
    });
    await harness.service.awardForApproval(harness.tx, COMMAND);
    expect(harness.ledger.insert).not.toHaveBeenCalled();
  });

  it('does not double-award when the idempotent insert is a no-op', async () => {
    harness.ledger.insert.mockResolvedValue(null);
    await harness.service.awardForApproval(harness.tx, COMMAND);
    expect(harness.badges.sync).not.toHaveBeenCalled();
    expect(harness.events.enqueue).not.toHaveBeenCalled();
  });
});
