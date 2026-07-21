import { describe, expect, it } from 'vitest';

import {
  MatchPlayType,
  PointOutcome,
  PointStartingLine,
  ScoringSide,
} from '../model/matches.enums';
import type { MatchPlayEvent, OpenMatchPoint } from '../model/matches.types';
import {
  canStartPoint,
  classifyPoint,
  isEffectivePlay,
  isOpponentErrorPlay,
  isPointWon,
  isPossessionPlay,
  isTurnoverPlay,
  nextPointNumber,
  requiresOpenPoint,
} from './match-point.state-machine';

const NOW = new Date('2026-05-01T10:00:00.000Z');

function play(overrides: Partial<MatchPlayEvent> = {}): MatchPlayEvent {
  return {
    playId: 'play-1',
    matchId: 'match-1',
    teamId: 'team-1',
    sequence: 1,
    operationId: 'op-1',
    requestHash: 'hash-1',
    playType: MatchPlayType.Goal,
    pointNumber: 1,
    period: 1,
    startingLine: null,
    scoringSide: null,
    primaryMembershipId: null,
    secondaryMembershipId: null,
    assistState: null,
    callahan: false,
    durationSeconds: null,
    correctsPlayId: null,
    correctionReason: null,
    retracted: false,
    notes: null,
    recordedBy: 'user-1',
    occurredAt: null,
    recordedAt: NOW,
    ...overrides,
  };
}

function openPoint(): OpenMatchPoint {
  return {
    playId: 'play-1',
    pointNumber: 3,
    period: 1,
    startingLine: PointStartingLine.Offense,
  };
}

describe('match point state machine', () => {
  it('treats only the facts between the envelope as possession plays', () => {
    expect(isPossessionPlay(MatchPlayType.Goal)).toBe(true);
    expect(isPossessionPlay(MatchPlayType.Pull)).toBe(true);
    expect(isPossessionPlay(MatchPlayType.PointStarted)).toBe(false);
    expect(isPossessionPlay(MatchPlayType.PointCompleted)).toBe(false);
    expect(isPossessionPlay(MatchPlayType.Correction)).toBe(false);
  });

  it('identifies the two forced opponent errors', () => {
    expect(isOpponentErrorPlay(MatchPlayType.OpponentDrop)).toBe(true);
    expect(isOpponentErrorPlay(MatchPlayType.OpponentThrowaway)).toBe(true);
    expect(isOpponentErrorPlay(MatchPlayType.Drop)).toBe(false);
  });

  it('identifies our own turnovers', () => {
    expect(isTurnoverPlay(MatchPlayType.Drop)).toBe(true);
    expect(isTurnoverPlay(MatchPlayType.Throwaway)).toBe(true);
    expect(isTurnoverPlay(MatchPlayType.Stall)).toBe(true);
    expect(isTurnoverPlay(MatchPlayType.Turnover)).toBe(true);
    expect(isTurnoverPlay(MatchPlayType.Goal)).toBe(false);
    expect(isTurnoverPlay(MatchPlayType.OpponentDrop)).toBe(false);
  });

  it('allows a new point only when none is open', () => {
    expect(canStartPoint(null)).toBe(true);
    expect(canStartPoint(openPoint())).toBe(false);
  });

  it('requires an open point to attach a fact to', () => {
    expect(requiresOpenPoint(openPoint())).toBe(true);
    expect(requiresOpenPoint(null)).toBe(false);
  });

  it('numbers the next point one past the starts that still count', () => {
    expect(nextPointNumber(0)).toBe(1);
    expect(nextPointNumber(4)).toBe(5);
  });

  it('drops retracted facts and the retractions themselves', () => {
    expect(isEffectivePlay(play())).toBe(true);
    expect(isEffectivePlay(play({ retracted: true }))).toBe(false);
    expect(isEffectivePlay(play({ playType: MatchPlayType.Correction }))).toBe(
      false,
    );
  });

  it('classifies a won point on offense as a hold and on defense as a break', () => {
    expect(classifyPoint(PointStartingLine.Offense, ScoringSide.Us)).toBe(
      PointOutcome.Hold,
    );
    expect(classifyPoint(PointStartingLine.Defense, ScoringSide.Us)).toBe(
      PointOutcome.Break,
    );
  });

  it('mirrors a lost point onto the opponent hold/break pair', () => {
    expect(classifyPoint(PointStartingLine.Offense, ScoringSide.Them)).toBe(
      PointOutcome.OpponentBreak,
    );
    expect(classifyPoint(PointStartingLine.Defense, ScoringSide.Them)).toBe(
      PointOutcome.OpponentHold,
    );
  });

  it('credits our team only with a hold or a break', () => {
    expect(isPointWon(PointOutcome.Hold)).toBe(true);
    expect(isPointWon(PointOutcome.Break)).toBe(true);
    expect(isPointWon(PointOutcome.OpponentHold)).toBe(false);
    expect(isPointWon(PointOutcome.OpponentBreak)).toBe(false);
  });
});
