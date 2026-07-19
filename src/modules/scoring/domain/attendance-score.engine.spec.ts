import { describe, expect, it } from 'vitest';

import { LEGACY_ATTENDANCE_WEIGHTS } from '../model/scoring.constants';
import {
  computeAttendancePercentage,
  computeLegacyWeightedAttendance,
} from './attendance-score.engine';

describe('computeAttendancePercentage (golden legacy)', () => {
  it('divides attended by eligible minus excused, excusing from the denominator', () => {
    // Fixture: rule "legacy attendance %"; raw = 10 eligible, 6 attended,
    // 2 excused; exclusions = 2 excused; denominator = 10 - 2 = 8.
    const result = computeAttendancePercentage({
      attendedEligible: 6,
      eligibleSessions: 10,
      excusedSessions: 2,
    });
    expect(result.numerator).toBe(6);
    expect(result.denominator).toBe(8);
    expect(result.excludedCount).toBe(2);
    expect(result.value).toBe(0.75); // unrounded fraction; display 75.00%
  });

  it('is null (not 0%) when every eligible session was excused', () => {
    const result = computeAttendancePercentage({
      attendedEligible: 0,
      eligibleSessions: 3,
      excusedSessions: 3,
    });
    expect(result.denominator).toBe(0);
    expect(result.value).toBeNull();
  });

  it('is null (not divide-by-zero) when there are no eligible sessions', () => {
    const result = computeAttendancePercentage({
      attendedEligible: 0,
      eligibleSessions: 0,
      excusedSessions: 0,
    });
    expect(result.value).toBeNull();
    expect(result.denominator).toBe(0);
  });

  it('distinguishes a measured zero-attendance from missing data', () => {
    // Attended 0 of 4 eligible (none excused) is a REAL 0%, not "no data".
    const result = computeAttendancePercentage({
      attendedEligible: 0,
      eligibleSessions: 4,
      excusedSessions: 0,
    });
    expect(result.value).toBe(0);
    expect(result.denominator).toBe(4);
  });
});

describe('computeLegacyWeightedAttendance (golden legacy)', () => {
  it('applies Practice 3, Fitness 2, Game 3, Throwing 4 minus late/absent', () => {
    // Fixture: legacy CANDIDATE weights; raw present = P2 F1 G3 T1, late 1,
    // absent 2 -> 2*3 + 1*2 + 3*3 + 1*4 - 1 - 2 = 6+2+9+4-3 = 18.
    const result = computeLegacyWeightedAttendance(
      {
        practicePresent: 2,
        fitnessPresent: 1,
        gamePresent: 3,
        throwingPresent: 1,
        lateCount: 1,
        absentCount: 2,
      },
      LEGACY_ATTENDANCE_WEIGHTS,
    );
    expect(result.value).toBe(18);
    expect(result.latePenalty).toBe(1);
    expect(result.absentPenalty).toBe(2);
    expect(result.lines).toEqual([
      { key: 'practice', present: 2, weight: 3, contribution: 6 },
      { key: 'fitness', present: 1, weight: 2, contribution: 2 },
      { key: 'game', present: 3, weight: 3, contribution: 9 },
      { key: 'throwing', present: 1, weight: 4, contribution: 4 },
    ]);
  });

  it('is zero (a measured value) when nothing was attended and no penalties', () => {
    const result = computeLegacyWeightedAttendance(
      {
        practicePresent: 0,
        fitnessPresent: 0,
        gamePresent: 0,
        throwingPresent: 0,
        lateCount: 0,
        absentCount: 0,
      },
      LEGACY_ATTENDANCE_WEIGHTS,
    );
    expect(result.value).toBe(0);
  });

  it('can go negative when penalties exceed earned weight', () => {
    const result = computeLegacyWeightedAttendance(
      {
        practicePresent: 0,
        fitnessPresent: 0,
        gamePresent: 0,
        throwingPresent: 0,
        lateCount: 2,
        absentCount: 3,
      },
      LEGACY_ATTENDANCE_WEIGHTS,
    );
    expect(result.value).toBe(-5);
  });
});
