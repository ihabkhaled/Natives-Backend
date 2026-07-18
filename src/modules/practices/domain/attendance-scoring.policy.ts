import { AttendanceStatus } from '../model/attendance.enums';
import type {
  AttendanceScoringRule,
  ParticipationFact,
  ParticipationInputs,
} from '../model/attendance.types';
import { isAttended } from './attendance-status.policy';

/**
 * Pure projection of raw participation facts against a cited, versioned scoring
 * rule. This produces INPUTS only — counts, an unrounded rate, and a points
 * contribution — never a stored editable total. Every status contributes exactly
 * according to the rule; excused/injured are excluded from the denominator only
 * when the rule says so; and "not enough data" is represented as null (distinct
 * from a measured zero). No time, no persistence; every branch is golden-tested.
 */

interface StatusTally {
  readonly onTime: number;
  readonly late: number;
  readonly excused: number;
  readonly injured: number;
  readonly absent: number;
  readonly remoteApproved: number;
  readonly otherApproved: number;
  readonly total: number;
  readonly weightedPresent: number;
}

const EMPTY_TALLY: StatusTally = {
  onTime: 0,
  late: 0,
  excused: 0,
  injured: 0,
  absent: 0,
  remoteApproved: 0,
  otherApproved: 0,
  total: 0,
  weightedPresent: 0,
};

/** Resolve the weight for a session type, defaulting unknown types by the rule. */
export function weightForSessionType(
  rule: AttendanceScoringRule,
  sessionType: string,
): number {
  const weight = rule.weights[sessionType.toLowerCase()];
  return weight ?? rule.defaultWeight;
}

function countFor(status: AttendanceStatus, tally: StatusTally): number {
  switch (status) {
    case AttendanceStatus.PresentOnTime:
      return tally.onTime;
    case AttendanceStatus.PresentLate:
      return tally.late;
    case AttendanceStatus.Excused:
      return tally.excused;
    case AttendanceStatus.Injured:
      return tally.injured;
    case AttendanceStatus.Absent:
      return tally.absent;
    case AttendanceStatus.RemoteApproved:
      return tally.remoteApproved;
    case AttendanceStatus.OtherApproved:
      return tally.otherApproved;
  }
}

function applyFact(
  tally: StatusTally,
  fact: ParticipationFact,
  rule: AttendanceScoringRule,
): StatusTally {
  const bumped = countFor(fact.status, tally) + fact.count;
  const weighted = isAttended(fact.status)
    ? tally.weightedPresent +
      fact.count * weightForSessionType(rule, fact.sessionType)
    : tally.weightedPresent;
  return {
    ...tally,
    ...bucketFor(fact.status, bumped),
    total: tally.total + fact.count,
    weightedPresent: weighted,
  };
}

function bucketFor(
  status: AttendanceStatus,
  value: number,
): Partial<StatusTally> {
  switch (status) {
    case AttendanceStatus.PresentOnTime:
      return { onTime: value };
    case AttendanceStatus.PresentLate:
      return { late: value };
    case AttendanceStatus.Excused:
      return { excused: value };
    case AttendanceStatus.Injured:
      return { injured: value };
    case AttendanceStatus.Absent:
      return { absent: value };
    case AttendanceStatus.RemoteApproved:
      return { remoteApproved: value };
    case AttendanceStatus.OtherApproved:
      return { otherApproved: value };
  }
}

function tallyFacts(
  facts: readonly ParticipationFact[],
  rule: AttendanceScoringRule,
): StatusTally {
  return facts.reduce(
    (tally, fact) => applyFact(tally, fact, rule),
    EMPTY_TALLY,
  );
}

/**
 * Compute the raw participation inputs for one member from aggregated facts and a
 * rule version. `attendanceRate` is null when the denominator is not positive (no
 * scorable sessions); `pointsContribution` is null when there are no facts at all
 * (missing) — but 0 when the member had sessions yet earned nothing (measured zero).
 */
export function computeParticipation(
  facts: readonly ParticipationFact[],
  rule: AttendanceScoringRule,
): ParticipationInputs {
  const t = tallyFacts(facts, rule);
  const attended = t.onTime + t.late + t.remoteApproved + t.otherApproved;
  const excludedSessions = rule.excusedExcluded ? t.excused + t.injured : 0;
  const denominator = t.total - excludedSessions;
  const latePenaltyPoints = t.late * rule.latePenalty;
  const absentPenaltyPoints = t.absent * rule.absentPenalty;
  return {
    ruleVersion: rule.code,
    ruleStatus: rule.status,
    eligibleSessions: t.total,
    attended,
    onTime: t.onTime,
    late: t.late,
    excused: t.excused,
    injured: t.injured,
    absent: t.absent,
    remoteApproved: t.remoteApproved,
    otherApproved: t.otherApproved,
    excludedSessions,
    denominator,
    attendanceRate: denominator > 0 ? attended / denominator : null,
    weightedPresentPoints: t.weightedPresent,
    latePenaltyPoints,
    absentPenaltyPoints,
    pointsContribution:
      t.total === 0
        ? null
        : t.weightedPresent - latePenaltyPoints - absentPenaltyPoints,
  };
}
