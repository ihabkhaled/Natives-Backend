import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LedgerEntryType, LedgerSourceType } from '../model/points.enums';
import type {
  ActivityReversalCommand,
  LedgerEntry,
} from '../model/points.types';
import { ReverseActivityPointsService } from './reverse-activity-points.service';

const NOW = new Date('2026-02-01T00:00:00.000Z');

const COMMAND: ActivityReversalCommand = {
  submissionId: 'sub-1',
  teamId: 'team-1',
  membershipId: 'mem-1',
  actorUserId: 'admin',
};

function award(id: string, amount: number): LedgerEntry {
  return {
    id,
    teamId: 'team-1',
    seasonId: null,
    membershipId: 'mem-1',
    entryType: LedgerEntryType.Award,
    amount,
    sourceType: LedgerSourceType.ActivitySubmission,
    sourceId: 'sub-1',
    ruleId: 'rule-1',
    ruleVersion: 1,
    activityCategory: 'gym',
    reason: null,
    reasonKey: null,
    reversesEntryId: null,
    idempotencyKey: `award:sub-1:${id}`,
    effectiveOn: '2026-01-20',
    actorUserId: 'coach-1',
    createdAt: NOW,
  };
}

function build() {
  const clock = { now: vi.fn().mockReturnValue(NOW) };
  const idGenerator = { generate: vi.fn().mockReturnValue('rev-1') };
  const ledger = {
    awardsForSubmission: vi.fn().mockResolvedValue([award('a1', 2)]),
    insert: vi.fn().mockResolvedValue({ id: 'rev-1' }),
  };
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const events = { enqueue: vi.fn().mockResolvedValue(undefined) };
  const service = new ReverseActivityPointsService(
    clock as never,
    idGenerator,
    ledger as never,
    audit as never,
    events as never,
  );
  return { ledger, audit, events, service, tx: {} as never };
}

describe('ReverseActivityPointsService', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('appends a compensating negative reversal for each award', async () => {
    await harness.service.reverseForCorrection(harness.tx, COMMAND);
    const inserted = harness.ledger.insert.mock.calls[0]?.[1];
    expect(inserted).toMatchObject({
      entryType: LedgerEntryType.Reversal,
      amount: -2,
      reversesEntryId: 'a1',
    });
    expect(harness.audit.record).toHaveBeenCalledOnce();
    expect(harness.events.enqueue).toHaveBeenCalledOnce();
  });

  it('is a no-op when the submission awarded nothing', async () => {
    harness.ledger.awardsForSubmission.mockResolvedValue([]);
    await harness.service.reverseForCorrection(harness.tx, COMMAND);
    expect(harness.ledger.insert).not.toHaveBeenCalled();
  });

  it('does not re-audit when the reversal already exists (idempotent)', async () => {
    harness.ledger.insert.mockResolvedValue(null);
    await harness.service.reverseForCorrection(harness.tx, COMMAND);
    expect(harness.audit.record).not.toHaveBeenCalled();
    expect(harness.events.enqueue).not.toHaveBeenCalled();
  });
});
