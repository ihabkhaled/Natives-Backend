import { describe, expect, it } from 'vitest';

import {
  AttendanceRuleStatus,
  AttendanceStatus,
} from '../model/attendance.enums';
import type {
  AttendanceScoringRule,
  ParticipationFact,
} from '../model/attendance.types';
import {
  computeParticipation,
  weightForSessionType,
} from './attendance-scoring.policy';

const RULE: AttendanceScoringRule = {
  code: 'legacy-candidate-v1',
  status: AttendanceRuleStatus.Candidate,
  weights: { practice: 3, fitness: 2, game: 3, throwing: 4 },
  defaultWeight: 1,
  latePenalty: 1,
  absentPenalty: 1,
  excusedExcluded: true,
};

function fact(
  status: AttendanceStatus,
  sessionType: string,
  count: number,
): ParticipationFact {
  return { status, sessionType, count };
}

describe('weightForSessionType', () => {
  it('resolves known weights case-insensitively', () => {
    expect(weightForSessionType(RULE, 'practice')).toBe(3);
    expect(weightForSessionType(RULE, 'Throwing')).toBe(4);
  });

  it('falls back to the default weight for unknown types', () => {
    expect(weightForSessionType(RULE, 'yoga')).toBe(1);
  });
});

describe('computeParticipation — legacy candidate golden', () => {
  // Rule version: legacy-candidate-v1 (Practice 3, Fitness 2, Game 3, Throwing 4;
  // late/absent penalty 1; excused excluded from denominator).
  // Raw inputs: 3 on-time practice, 1 late practice, 2 excused fitness,
  //   1 injured game, 2 absent throwing, 1 remote game, 1 other running (unknown).
  const facts: readonly ParticipationFact[] = [
    fact(AttendanceStatus.PresentOnTime, 'practice', 3),
    fact(AttendanceStatus.PresentLate, 'practice', 1),
    fact(AttendanceStatus.Excused, 'fitness', 2),
    fact(AttendanceStatus.Injured, 'game', 1),
    fact(AttendanceStatus.Absent, 'throwing', 2),
    fact(AttendanceStatus.RemoteApproved, 'game', 1),
    fact(AttendanceStatus.OtherApproved, 'running', 1),
  ];

  it('projects every count and a reproducible rate + points contribution', () => {
    const result = computeParticipation(facts, RULE);
    expect(result).toEqual({
      ruleVersion: 'legacy-candidate-v1',
      ruleStatus: AttendanceRuleStatus.Candidate,
      eligibleSessions: 11,
      attended: 6,
      onTime: 3,
      late: 1,
      excused: 2,
      injured: 1,
      absent: 2,
      remoteApproved: 1,
      otherApproved: 1,
      excludedSessions: 3,
      denominator: 8,
      attendanceRate: 0.75,
      // weighted present = 3*3 (on-time practice) + 1*3 (late practice)
      //   + 1*3 (remote game) + 1*1 (other running, default weight) = 16
      weightedPresentPoints: 16,
      latePenaltyPoints: 1,
      absentPenaltyPoints: 2,
      pointsContribution: 13,
    });
  });
});

describe('computeParticipation — null vs measured zero', () => {
  it('returns null rate and null points for no data (missing)', () => {
    const result = computeParticipation([], RULE);
    expect(result.eligibleSessions).toBe(0);
    expect(result.attendanceRate).toBeNull();
    expect(result.pointsContribution).toBeNull();
  });

  it('returns a measured zero rate when a member had sessions but attended none', () => {
    const result = computeParticipation(
      [fact(AttendanceStatus.Absent, 'practice', 2)],
      RULE,
    );
    expect(result.attendanceRate).toBe(0);
    expect(result.pointsContribution).toBe(-2);
  });

  it('returns a null rate but a measured-zero points for only-excused sessions', () => {
    const result = computeParticipation(
      [
        fact(AttendanceStatus.Excused, 'practice', 2),
        fact(AttendanceStatus.Injured, 'game', 1),
      ],
      RULE,
    );
    expect(result.eligibleSessions).toBe(3);
    expect(result.excludedSessions).toBe(3);
    expect(result.denominator).toBe(0);
    expect(result.attendanceRate).toBeNull();
    expect(result.pointsContribution).toBe(0);
  });
});

describe('computeParticipation — rule denominator policy', () => {
  it('includes excused in the denominator when the rule does not exclude it', () => {
    const inclusiveRule: AttendanceScoringRule = {
      ...RULE,
      excusedExcluded: false,
    };
    const result = computeParticipation(
      [
        fact(AttendanceStatus.PresentOnTime, 'practice', 2),
        fact(AttendanceStatus.Excused, 'practice', 2),
      ],
      inclusiveRule,
    );
    expect(result.excludedSessions).toBe(0);
    expect(result.denominator).toBe(4);
    expect(result.attendanceRate).toBe(0.5);
  });
});
