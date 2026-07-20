import { describe, expect, it } from 'vitest';

import { MatchEventType, ScoringSide } from '../model/matches.enums';
import type {
  PointContent,
  TimeoutContent,
  VoidContent,
} from '../model/matches.types';
import {
  hashLifecycleOperation,
  hashPointOperation,
  hashTimeoutOperation,
  hashVoidOperation,
} from './match-operation.hash';

function point(overrides: Partial<PointContent> = {}): PointContent {
  return {
    operationId: 'op-abcdef01',
    scoringSide: ScoringSide.Us,
    points: 1,
    scorerMembershipId: null,
    assistMembershipId: null,
    occurredAt: null,
    expectedStreamVersion: null,
    ...overrides,
  };
}

function timeout(overrides: Partial<TimeoutContent> = {}): TimeoutContent {
  return {
    operationId: 'op-abcdef02',
    scoringSide: ScoringSide.Them,
    occurredAt: null,
    ...overrides,
  };
}

function voidOp(overrides: Partial<VoidContent> = {}): VoidContent {
  return {
    operationId: 'op-abcdef03',
    eventId: 'event-1',
    reason: 'scored for the wrong side',
    ...overrides,
  };
}

describe('match operation hash', () => {
  it('is stable for an identical point payload', () => {
    expect(hashPointOperation(point())).toBe(hashPointOperation(point()));
  });

  it('ignores fields that do not change the outcome', () => {
    expect(
      hashPointOperation(
        point({
          operationId: 'op-different',
          occurredAt: '2026-03-01T10:00:00.000Z',
          expectedStreamVersion: 12,
        }),
      ),
    ).toBe(hashPointOperation(point()));
  });

  it('changes when any outcome-bearing field changes', () => {
    const base = hashPointOperation(point());
    expect(
      hashPointOperation(point({ scoringSide: ScoringSide.Them })),
    ).not.toBe(base);
    expect(hashPointOperation(point({ points: 2 }))).not.toBe(base);
    expect(
      hashPointOperation(point({ scorerMembershipId: 'member-1' })),
    ).not.toBe(base);
    expect(
      hashPointOperation(point({ assistMembershipId: 'member-2' })),
    ).not.toBe(base);
  });

  it('fingerprints a timeout by its side alone', () => {
    expect(hashTimeoutOperation(timeout())).toBe(
      hashTimeoutOperation(timeout({ occurredAt: '2026-03-01T10:00:00.000Z' })),
    );
    expect(
      hashTimeoutOperation(timeout({ scoringSide: ScoringSide.Us })),
    ).not.toBe(hashTimeoutOperation(timeout()));
  });

  it('fingerprints a void by its target and reason', () => {
    expect(hashVoidOperation(voidOp())).toBe(hashVoidOperation(voidOp()));
    expect(hashVoidOperation(voidOp({ eventId: 'event-2' }))).not.toBe(
      hashVoidOperation(voidOp()),
    );
    expect(hashVoidOperation(voidOp({ reason: 'other reason' }))).not.toBe(
      hashVoidOperation(voidOp()),
    );
  });

  it('fingerprints a server-appended lifecycle mark', () => {
    expect(hashLifecycleOperation(MatchEventType.PeriodStart, 2, null)).toBe(
      hashLifecycleOperation(MatchEventType.PeriodStart, 2, null),
    );
    expect(
      hashLifecycleOperation(MatchEventType.PeriodStart, 2, ScoringSide.Us),
    ).not.toBe(hashLifecycleOperation(MatchEventType.PeriodStart, 2, null));
    expect(hashLifecycleOperation(MatchEventType.PeriodEnd, 2, null)).not.toBe(
      hashLifecycleOperation(MatchEventType.PeriodStart, 2, null),
    );
  });

  it('produces a hex sha-256 digest, never the raw payload', () => {
    const digest = hashPointOperation(point({ scorerMembershipId: 'm-1' }));
    expect(digest).toMatch(/^[0-9a-f]{64}$/u);
    expect(digest).not.toContain('m-1');
  });
});
