import { describe, expect, it } from 'vitest';

import { SignalStatus } from '../model/squads.enums';
import type { MemberEligibility } from '../model/squads.types';
import {
  isOverrideMissing,
  requiresOverride,
  resolvedSelectionOutcome,
} from './selection-override.policy';

function eligibility(
  overrides: Partial<MemberEligibility> = {},
): MemberEligibility {
  return {
    membershipId: 'm-1',
    fullName: 'Player One',
    jerseyNumber: 7,
    attendancePct: 80,
    availability: null,
    selected: false,
    signals: [],
    overall: SignalStatus.Passed,
    flagged: false,
    ...overrides,
  };
}

describe('selection-override.policy', () => {
  it('requires an override only for a flagged candidate', () => {
    expect(requiresOverride(eligibility({ flagged: true }))).toBe(true);
    expect(requiresOverride(eligibility({ flagged: false }))).toBe(false);
  });

  it('reports a missing override when flagged and none supplied', () => {
    expect(isOverrideMissing(eligibility({ flagged: true }), null)).toBe(true);
    expect(
      isOverrideMissing(eligibility({ flagged: true }), {
        overrideReason: 'coach cleared',
      }),
    ).toBe(false);
    expect(isOverrideMissing(eligibility({ flagged: false }), null)).toBe(
      false,
    );
  });

  it('records Overridden only when a flagged candidate is overridden', () => {
    expect(
      resolvedSelectionOutcome(
        eligibility({ flagged: true, overall: SignalStatus.Warning }),
        { overrideReason: 'accepted' },
      ),
    ).toBe(SignalStatus.Overridden);
  });

  it('records the computed overall when not overriding a flag', () => {
    expect(
      resolvedSelectionOutcome(
        eligibility({ flagged: false, overall: SignalStatus.Passed }),
        null,
      ),
    ).toBe(SignalStatus.Passed);
    expect(
      resolvedSelectionOutcome(
        eligibility({ flagged: false, overall: SignalStatus.Passed }),
        { overrideReason: 'unnecessary but allowed' },
      ),
    ).toBe(SignalStatus.Passed);
  });
});
