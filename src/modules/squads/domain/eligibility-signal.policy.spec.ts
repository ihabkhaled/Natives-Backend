import { describe, expect, it } from 'vitest';

import {
  AvailabilityStatus,
  CandidateStatus,
  SignalCode,
  SignalStatus,
} from '../model/squads.enums';
import type {
  EligibilityInputs,
  EligibilitySignal,
} from '../model/squads.types';
import {
  computeAttendancePercent,
  computeMemberEligibility,
  evaluateActiveStatusSignal,
  evaluateAttendanceSignal,
  evaluateAvailabilitySignal,
  evaluateInjurySignal,
  evaluateJerseySignal,
  evaluateRegistrationSignal,
  isFlaggedOverall,
  overallSignalStatus,
} from './eligibility-signal.policy';

const THRESHOLD = 70;

function inputs(overrides: Partial<EligibilityInputs> = {}): EligibilityInputs {
  return {
    membershipId: 'm-1',
    fullName: 'Player One',
    status: CandidateStatus.Active,
    registeredInSeason: true,
    gender: 'man',
    jerseyNumber: 7,
    attendedSessions: 8,
    eligibleSessions: 10,
    injuredSessions: 0,
    availability: AvailabilityStatus.Available,
    selected: false,
    selectionOverridden: false,
    ...overrides,
  };
}

function sig(status: SignalStatus): EligibilitySignal {
  return { code: SignalCode.Attendance, status };
}

describe('computeAttendancePercent', () => {
  it('returns null when there are no eligible sessions (null-not-zero)', () => {
    expect(computeAttendancePercent(0, 0)).toBeNull();
    expect(computeAttendancePercent(5, 0)).toBeNull();
  });

  it('rounds a real percentage from a numerator/denominator pair', () => {
    expect(computeAttendancePercent(8, 10)).toBe(80);
    expect(computeAttendancePercent(2, 3)).toBe(67);
    expect(computeAttendancePercent(0, 4)).toBe(0);
  });
});

describe('evaluateActiveStatusSignal', () => {
  it('passes an active membership', () => {
    expect(evaluateActiveStatusSignal(CandidateStatus.Active).status).toBe(
      SignalStatus.Passed,
    );
  });

  it('fails terminal/suspended states', () => {
    for (const status of [
      CandidateStatus.Suspended,
      CandidateStatus.Left,
      CandidateStatus.Archived,
      CandidateStatus.Anonymized,
    ]) {
      expect(evaluateActiveStatusSignal(status).status).toBe(
        SignalStatus.Failed,
      );
    }
  });

  it('warns for invited or inactive members', () => {
    expect(evaluateActiveStatusSignal(CandidateStatus.Invited).status).toBe(
      SignalStatus.Warning,
    );
    expect(evaluateActiveStatusSignal(CandidateStatus.Inactive).status).toBe(
      SignalStatus.Warning,
    );
  });
});

describe('evaluateRegistrationSignal', () => {
  it('passes when registered and fails when not', () => {
    expect(evaluateRegistrationSignal(true).status).toBe(SignalStatus.Passed);
    expect(evaluateRegistrationSignal(false).status).toBe(SignalStatus.Failed);
  });
});

describe('evaluateAttendanceSignal', () => {
  it('is unknown with no data, never zero or ineligible', () => {
    expect(evaluateAttendanceSignal(null, THRESHOLD).status).toBe(
      SignalStatus.Unknown,
    );
  });

  it('passes at or above the threshold', () => {
    expect(evaluateAttendanceSignal(70, THRESHOLD).status).toBe(
      SignalStatus.Passed,
    );
    expect(evaluateAttendanceSignal(95, THRESHOLD).status).toBe(
      SignalStatus.Passed,
    );
  });

  it('only warns below the threshold — attendance never fails', () => {
    expect(evaluateAttendanceSignal(40, THRESHOLD).status).toBe(
      SignalStatus.Warning,
    );
  });
});

describe('evaluateAvailabilitySignal', () => {
  it('is unknown when undeclared (not treated as unavailable)', () => {
    expect(evaluateAvailabilitySignal(null).status).toBe(SignalStatus.Unknown);
  });

  it('passes an available declaration', () => {
    expect(
      evaluateAvailabilitySignal(AvailabilityStatus.Available).status,
    ).toBe(SignalStatus.Passed);
  });

  it('warns for tentative or unavailable declarations', () => {
    expect(
      evaluateAvailabilitySignal(AvailabilityStatus.Tentative).status,
    ).toBe(SignalStatus.Warning);
    expect(
      evaluateAvailabilitySignal(AvailabilityStatus.Unavailable).status,
    ).toBe(SignalStatus.Warning);
  });
});

describe('evaluateInjurySignal', () => {
  it('warns when injured sessions exist, otherwise passes', () => {
    expect(evaluateInjurySignal(1).status).toBe(SignalStatus.Warning);
    expect(evaluateInjurySignal(0).status).toBe(SignalStatus.Passed);
  });
});

describe('evaluateJerseySignal', () => {
  it('warns without a jersey number, passes with one', () => {
    expect(evaluateJerseySignal(null).status).toBe(SignalStatus.Warning);
    expect(evaluateJerseySignal(10).status).toBe(SignalStatus.Passed);
  });
});

describe('overallSignalStatus / isFlaggedOverall', () => {
  it('applies failed > warning > unknown > passed precedence', () => {
    expect(
      overallSignalStatus([sig(SignalStatus.Passed), sig(SignalStatus.Failed)]),
    ).toBe(SignalStatus.Failed);
    expect(
      overallSignalStatus([
        sig(SignalStatus.Passed),
        sig(SignalStatus.Warning),
        sig(SignalStatus.Unknown),
      ]),
    ).toBe(SignalStatus.Warning);
    expect(
      overallSignalStatus([
        sig(SignalStatus.Passed),
        sig(SignalStatus.Unknown),
      ]),
    ).toBe(SignalStatus.Unknown);
    expect(overallSignalStatus([sig(SignalStatus.Passed)])).toBe(
      SignalStatus.Passed,
    );
  });

  it('flags failed and warning overalls only', () => {
    expect(isFlaggedOverall(SignalStatus.Failed)).toBe(true);
    expect(isFlaggedOverall(SignalStatus.Warning)).toBe(true);
    expect(isFlaggedOverall(SignalStatus.Unknown)).toBe(false);
    expect(isFlaggedOverall(SignalStatus.Passed)).toBe(false);
    expect(isFlaggedOverall(SignalStatus.Overridden)).toBe(false);
  });
});

describe('computeMemberEligibility', () => {
  it('computes a clear candidate with all signals passing', () => {
    const result = computeMemberEligibility(inputs(), THRESHOLD);
    expect(result.attendancePct).toBe(80);
    expect(result.overall).toBe(SignalStatus.Passed);
    expect(result.flagged).toBe(false);
    expect(result.signals).toHaveLength(6);
  });

  it('flags a candidate under the attendance threshold as a warning', () => {
    const result = computeMemberEligibility(
      inputs({ attendedSessions: 3, eligibleSessions: 10 }),
      THRESHOLD,
    );
    expect(result.attendancePct).toBe(30);
    expect(result.overall).toBe(SignalStatus.Warning);
    expect(result.flagged).toBe(true);
  });

  it('flags a suspended candidate as failed but never auto-excludes', () => {
    const result = computeMemberEligibility(
      inputs({ status: CandidateStatus.Suspended }),
      THRESHOLD,
    );
    expect(result.overall).toBe(SignalStatus.Failed);
    expect(result.flagged).toBe(true);
  });

  it('keeps a missing attendance percentage null (not zero)', () => {
    const result = computeMemberEligibility(
      inputs({ attendedSessions: 0, eligibleSessions: 0, jerseyNumber: 5 }),
      THRESHOLD,
    );
    expect(result.attendancePct).toBeNull();
    expect(result.overall).toBe(SignalStatus.Unknown);
    expect(result.flagged).toBe(false);
  });

  it('reports Overridden when a flagged, selected candidate was overridden', () => {
    const result = computeMemberEligibility(
      inputs({
        status: CandidateStatus.Suspended,
        selected: true,
        selectionOverridden: true,
      }),
      THRESHOLD,
    );
    expect(result.overall).toBe(SignalStatus.Overridden);
    expect(result.flagged).toBe(true);
  });

  it('does not report Overridden for a selected but non-overridden candidate', () => {
    const result = computeMemberEligibility(
      inputs({ selected: true, selectionOverridden: false }),
      THRESHOLD,
    );
    expect(result.overall).toBe(SignalStatus.Passed);
  });
});
