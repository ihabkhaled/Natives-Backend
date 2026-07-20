import { PERCENT_SCALE } from '../model/squads.constants';
import {
  AvailabilityStatus,
  CandidateStatus,
  SignalCode,
  SignalStatus,
} from '../model/squads.enums';
import type {
  EligibilityInputs,
  EligibilitySignal,
  MemberEligibility,
} from '../model/squads.types';

/**
 * Pure eligibility-signal computation for a squad candidate (UN-501). Signals are
 * ADVISORY, never gates: a `Warning` or `Failed` outcome flags a candidate for a
 * human decision — it never removes a player automatically. Missing data is
 * `Unknown` (null-not-zero), never coerced to zero or to ineligible. Attendance
 * under the configurable threshold is only ever a `Warning`, never a `Failed`, so
 * a low percentage can never auto-exclude or auto-discipline. No side effects, no
 * time, no persistence — every branch is unit-tested.
 */

const FAILED_STATUSES: ReadonlySet<CandidateStatus> = new Set([
  CandidateStatus.Suspended,
  CandidateStatus.Left,
  CandidateStatus.Archived,
  CandidateStatus.Anonymized,
]);

/**
 * Attendance percentage from a numerator/denominator pair. Returns null when
 * there are no eligible sessions — "not enough data", never a division by zero or
 * an implied 0%. The denominator already excludes excused/injured sessions.
 */
export function computeAttendancePercent(
  attendedSessions: number,
  eligibleSessions: number,
): number | null {
  if (eligibleSessions <= 0) {
    return null;
  }
  return Math.round((attendedSessions / eligibleSessions) * PERCENT_SCALE);
}

/** Active membership drives the strongest signal; terminal states fail advisory. */
export function evaluateActiveStatusSignal(
  status: CandidateStatus,
): EligibilitySignal {
  if (status === CandidateStatus.Active) {
    return signal(SignalCode.ActiveStatus, SignalStatus.Passed);
  }
  if (FAILED_STATUSES.has(status)) {
    return signal(SignalCode.ActiveStatus, SignalStatus.Failed);
  }
  return signal(SignalCode.ActiveStatus, SignalStatus.Warning);
}

/** Registration in the season is a hard eligibility input; absence fails advisory. */
export function evaluateRegistrationSignal(
  registeredInSeason: boolean,
): EligibilitySignal {
  return signal(
    SignalCode.Registration,
    registeredInSeason ? SignalStatus.Passed : SignalStatus.Failed,
  );
}

/**
 * Attendance signal against the configurable threshold. `null` percentage is
 * `Unknown` (no data), at/above threshold is `Passed`, below is only ever a
 * `Warning` — attendance never fails a candidate.
 */
export function evaluateAttendanceSignal(
  attendancePct: number | null,
  thresholdPct: number,
): EligibilitySignal {
  if (attendancePct === null) {
    return signal(SignalCode.Attendance, SignalStatus.Unknown);
  }
  if (attendancePct >= thresholdPct) {
    return signal(SignalCode.Attendance, SignalStatus.Passed);
  }
  return signal(SignalCode.Attendance, SignalStatus.Warning);
}

/** Availability declaration; an undeclared member is `Unknown`, not unavailable. */
export function evaluateAvailabilitySignal(
  availability: AvailabilityStatus | null,
): EligibilitySignal {
  if (availability === null) {
    return signal(SignalCode.Availability, SignalStatus.Unknown);
  }
  if (availability === AvailabilityStatus.Available) {
    return signal(SignalCode.Availability, SignalStatus.Passed);
  }
  return signal(SignalCode.Availability, SignalStatus.Warning);
}

/**
 * Injury signal derived from approved-injury attendance records. Surfaced only as
 * a limited-availability classification (a `Warning`), never with medical detail.
 */
export function evaluateInjurySignal(
  injuredSessions: number,
): EligibilitySignal {
  return signal(
    SignalCode.Injury,
    injuredSessions > 0 ? SignalStatus.Warning : SignalStatus.Passed,
  );
}

/** Jersey availability; a missing jersey number is a soft `Warning`. */
export function evaluateJerseySignal(
  jerseyNumber: number | null,
): EligibilitySignal {
  return signal(
    SignalCode.Jersey,
    jerseyNumber === null ? SignalStatus.Warning : SignalStatus.Passed,
  );
}

/**
 * Precedence overall: any `Failed` dominates, then any `Warning`, then any
 * `Unknown`, else `Passed`. This is the advisory summary — it never itself
 * excludes a player.
 */
export function overallSignalStatus(
  signals: readonly EligibilitySignal[],
): SignalStatus {
  if (signals.some(item => item.status === SignalStatus.Failed)) {
    return SignalStatus.Failed;
  }
  if (signals.some(item => item.status === SignalStatus.Warning)) {
    return SignalStatus.Warning;
  }
  if (signals.some(item => item.status === SignalStatus.Unknown)) {
    return SignalStatus.Unknown;
  }
  return SignalStatus.Passed;
}

/** A flagged candidate has a `Failed` or `Warning` overall — a human must decide. */
export function isFlaggedOverall(overall: SignalStatus): boolean {
  return overall === SignalStatus.Failed || overall === SignalStatus.Warning;
}

/**
 * The full advisory evaluation for a candidate. A selection accepted via an
 * explicit override reports `Overridden`, recording that a permitted human
 * consciously accepted the flag; otherwise the overall is the signal precedence.
 */
export function computeMemberEligibility(
  inputs: EligibilityInputs,
  thresholdPct: number,
): MemberEligibility {
  const attendancePct = computeAttendancePercent(
    inputs.attendedSessions,
    inputs.eligibleSessions,
  );
  const signals = buildSignals(inputs, attendancePct, thresholdPct);
  const precedence = overallSignalStatus(signals);
  const overall =
    inputs.selected && inputs.selectionOverridden
      ? SignalStatus.Overridden
      : precedence;
  return {
    membershipId: inputs.membershipId,
    fullName: inputs.fullName,
    jerseyNumber: inputs.jerseyNumber,
    attendancePct,
    availability: inputs.availability,
    selected: inputs.selected,
    signals,
    overall,
    flagged: isFlaggedOverall(precedence),
  };
}

function buildSignals(
  inputs: EligibilityInputs,
  attendancePct: number | null,
  thresholdPct: number,
): readonly EligibilitySignal[] {
  return [
    evaluateActiveStatusSignal(inputs.status),
    evaluateRegistrationSignal(inputs.registeredInSeason),
    evaluateAttendanceSignal(attendancePct, thresholdPct),
    evaluateAvailabilitySignal(inputs.availability),
    evaluateInjurySignal(inputs.injuredSessions),
    evaluateJerseySignal(inputs.jerseyNumber),
  ];
}

function signal(code: SignalCode, status: SignalStatus): EligibilitySignal {
  return { code, status };
}
