import { describe, expect, it } from 'vitest';

import {
  AssistState,
  MatchEventType,
  MatchPlayType,
  PointStartingLine,
  ScoringSide,
} from '../model/matches.enums';
import type {
  PointContent,
  TimeoutContent,
  VoidContent,
} from '../model/matches.types';
import {
  hashCompletePointOperation,
  hashCorrectionOperation,
  hashLifecycleOperation,
  hashPlayOperation,
  hashPointOperation,
  hashStartPointOperation,
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
  it('fingerprints a point start over its whole line, order-independently', () => {
    const base = {
      operationId: 'op-1',
      startingLine: PointStartingLine.Offense,
      lineMembershipIds: ['ana', 'bo'],
      pullerMembershipId: 'bo',
      occurredAt: null,
      notes: null,
    };
    expect(hashStartPointOperation(base)).toBe(
      hashStartPointOperation({ ...base, lineMembershipIds: ['bo', 'ana'] }),
    );
    expect(
      hashStartPointOperation({ ...base, lineMembershipIds: ['ana', 'cy'] }),
    ).not.toBe(hashStartPointOperation(base));
    expect(
      hashStartPointOperation({ ...base, pullerMembershipId: null }),
    ).not.toBe(hashStartPointOperation(base));
    expect(
      hashStartPointOperation({
        ...base,
        startingLine: PointStartingLine.Defense,
      }),
    ).not.toBe(hashStartPointOperation(base));
  });

  it('fingerprints a completion including a measured point length', () => {
    const base = {
      operationId: 'op-1',
      scoringSide: ScoringSide.Us,
      durationSeconds: null,
      occurredAt: null,
      notes: null,
    };
    expect(hashCompletePointOperation(base)).toBe(
      hashCompletePointOperation({ ...base, notes: 'ignored' }),
    );
    expect(
      hashCompletePointOperation({ ...base, durationSeconds: 0 }),
    ).not.toBe(hashCompletePointOperation(base));
    expect(
      hashCompletePointOperation({ ...base, scoringSide: ScoringSide.Them }),
    ).not.toBe(hashCompletePointOperation(base));
  });

  it('fingerprints a possession fact over everything that changes it', () => {
    const base = {
      operationId: 'op-1',
      playType: MatchPlayType.Goal,
      primaryMembershipId: null,
      secondaryMembershipId: null,
      assistState: AssistState.Unknown,
      callahan: false,
      occurredAt: null,
      notes: null,
    };
    expect(hashPlayOperation(base)).toBe(hashPlayOperation({ ...base }));
    expect(hashPlayOperation({ ...base, primaryMembershipId: 'ana' })).not.toBe(
      hashPlayOperation(base),
    );
    expect(
      hashPlayOperation({ ...base, secondaryMembershipId: 'bo' }),
    ).not.toBe(hashPlayOperation(base));
    expect(
      hashPlayOperation({ ...base, assistState: AssistState.None }),
    ).not.toBe(hashPlayOperation(base));
    expect(hashPlayOperation({ ...base, callahan: true })).not.toBe(
      hashPlayOperation(base),
    );
    expect(
      hashPlayOperation({ ...base, playType: MatchPlayType.Drop }),
    ).not.toBe(hashPlayOperation(base));
  });

  it('fingerprints a retraction over its target and reason', () => {
    const base = { operationId: 'op-1', playId: 'play-1', reason: 'wrong' };
    expect(hashCorrectionOperation(base)).toBe(hashCorrectionOperation(base));
    expect(hashCorrectionOperation({ ...base, playId: 'play-2' })).not.toBe(
      hashCorrectionOperation(base),
    );
    expect(hashCorrectionOperation({ ...base, reason: 'other' })).not.toBe(
      hashCorrectionOperation(base),
    );
  });
});
