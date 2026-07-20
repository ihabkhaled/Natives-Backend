import { describe, expect, it } from 'vitest';

import {
  MatchEventType,
  OperationOutcome,
  ScoringSide,
} from '../model/matches.enums';
import type { MatchEvent } from '../model/matches.types';
import {
  classifyOperation,
  isOperationConflict,
  isOperationReplay,
  matchesStreamVersion,
  nextSequence,
} from './match-operation.policy';

const NOW = new Date('2026-03-01T10:00:00.000Z');

function event(requestHash: string): MatchEvent {
  return {
    eventId: 'event-1',
    matchId: 'match-1',
    teamId: 'team-1',
    sequence: 4,
    operationId: 'op-abcdef01',
    requestHash,
    eventType: MatchEventType.Point,
    scoringSide: ScoringSide.Us,
    points: 1,
    ourScoreAfter: 3,
    opponentScoreAfter: 2,
    period: 1,
    scorerMembershipId: null,
    assistMembershipId: null,
    voidsEventId: null,
    voided: false,
    voidReason: null,
    recordedBy: 'user-1',
    occurredAt: null,
    recordedAt: NOW,
  };
}

describe('match operation policy', () => {
  it('treats an unseen operation id as newly applied', () => {
    expect(classifyOperation(null, 'hash-a')).toBe(OperationOutcome.Applied);
  });

  it('treats the same id with the same payload as a faithful replay', () => {
    expect(classifyOperation(event('hash-a'), 'hash-a')).toBe(
      OperationOutcome.Replayed,
    );
  });

  it('treats the same id with a different payload as a conflict', () => {
    expect(classifyOperation(event('hash-a'), 'hash-b')).toBe(
      OperationOutcome.Conflict,
    );
  });

  it('classifies each outcome for the caller', () => {
    expect(isOperationConflict(OperationOutcome.Conflict)).toBe(true);
    expect(isOperationConflict(OperationOutcome.Replayed)).toBe(false);
    expect(isOperationReplay(OperationOutcome.Replayed)).toBe(true);
    expect(isOperationReplay(OperationOutcome.Applied)).toBe(false);
  });

  it('accepts an unclaimed base version and rejects a stale one', () => {
    expect(matchesStreamVersion(null, 7)).toBe(true);
    expect(matchesStreamVersion(7, 7)).toBe(true);
    expect(matchesStreamVersion(6, 7)).toBe(false);
  });

  it('numbers the next fact one past the current stream version', () => {
    expect(nextSequence(0)).toBe(1);
    expect(nextSequence(12)).toBe(13);
  });
});
