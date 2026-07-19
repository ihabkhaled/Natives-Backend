import type {
  AttendancePercentageInput,
  AttendancePercentageResult,
  WeightedAttendanceInput,
  WeightedAttendanceLine,
  WeightedAttendanceResult,
  WeightedAttendanceWeights,
} from '../model/scoring.types';

/**
 * Pure, deterministic attendance calculators (UN-303). No clock, no persistence,
 * no rounding — an attendance figure is a projection of these functions over the
 * raw records of module 202 under a named, versioned weight set. Excused/injured
 * sessions are excluded from the denominator (never counted as absences); a member
 * with no eligible session yields null "not enough data", never a divide-by-zero
 * or a misleading 0%. Every branch here is unit- and golden-tested.
 */

/**
 * Legacy attendance percentage: attendedEligible / (eligibleSessions -
 * excusedSessions). The excused/injured count is removed from the denominator.
 * With no eligible session left, the value is null (not zero) — the arithmetic is
 * still reported so the "not enough data" outcome is explainable.
 */
export function computeAttendancePercentage(
  input: AttendancePercentageInput,
): AttendancePercentageResult {
  const denominator = input.eligibleSessions - input.excusedSessions;
  const value = denominator > 0 ? input.attendedEligible / denominator : null;
  return {
    value,
    numerator: input.attendedEligible,
    denominator,
    excludedCount: input.excusedSessions,
  };
}

/**
 * Legacy weighted attendance score:
 *   practicePresent*wPractice + fitnessPresent*wFitness + gamePresent*wGame
 *   + throwingPresent*wThrowing - lateCount*latePenalty - absentCount*absentPenalty
 * Each session-type line and the two penalties are preserved so the total can be
 * reproduced and shown. The weights are a named CANDIDATE, supplied by the caller.
 */
export function computeLegacyWeightedAttendance(
  input: WeightedAttendanceInput,
  weights: WeightedAttendanceWeights,
): WeightedAttendanceResult {
  const lines: readonly WeightedAttendanceLine[] = [
    attendanceLine('practice', input.practicePresent, weights.practice),
    attendanceLine('fitness', input.fitnessPresent, weights.fitness),
    attendanceLine('game', input.gamePresent, weights.game),
    attendanceLine('throwing', input.throwingPresent, weights.throwing),
  ];
  const latePenalty = input.lateCount * weights.latePenalty;
  const absentPenalty = input.absentCount * weights.absentPenalty;
  const earned = lines.reduce((sum, line) => sum + line.contribution, 0);
  return {
    value: earned - latePenalty - absentPenalty,
    lines,
    latePenalty,
    absentPenalty,
  };
}

function attendanceLine(
  key: string,
  present: number,
  weight: number,
): WeightedAttendanceLine {
  return { key, present, weight, contribution: present * weight };
}
