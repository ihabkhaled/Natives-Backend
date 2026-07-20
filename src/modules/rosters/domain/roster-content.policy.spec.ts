import { describe, expect, it } from 'vitest';

import { RosterValidationError } from '../errors/roster-validation.error';
import { RosterDivision } from '../model/rosters.enums';
import type { RosterConstraints } from '../model/rosters.types';
import { assertRosterConstraints } from './roster-content.policy';

function constraints(
  overrides: Partial<RosterConstraints> = {},
): RosterConstraints {
  return {
    division: RosterDivision.Mixed,
    minSize: 7,
    maxSize: 30,
    minWomen: null,
    requireCaptain: true,
    ...overrides,
  };
}

describe('roster-content.policy', () => {
  it('accepts a real size window inside the supported bounds', () => {
    expect(() => {
      assertRosterConstraints(constraints());
    }).not.toThrow();
    expect(() => {
      assertRosterConstraints(constraints({ minSize: 1, maxSize: 1 }));
    }).not.toThrow();
  });

  it('rejects a size window below the floor, above the ceiling, or inverted', () => {
    for (const invalid of [
      constraints({ minSize: 0 }),
      constraints({ maxSize: 61 }),
      constraints({ minSize: 20, maxSize: 10 }),
    ]) {
      expect(() => {
        assertRosterConstraints(invalid);
      }).toThrow(RosterValidationError);
    }
  });

  it('skips the gender rule entirely when no minimum is stated', () => {
    expect(() => {
      assertRosterConstraints(constraints({ minWomen: null }));
    }).not.toThrow();
  });

  it('accepts a reachable gender minimum, including an explicit zero', () => {
    expect(() => {
      assertRosterConstraints(constraints({ minWomen: 0 }));
    }).not.toThrow();
    expect(() => {
      assertRosterConstraints(constraints({ minWomen: 30, maxSize: 30 }));
    }).not.toThrow();
  });

  it('rejects a negative or unreachable gender minimum', () => {
    expect(() => {
      assertRosterConstraints(constraints({ minWomen: -1 }));
    }).toThrow(RosterValidationError);
    expect(() => {
      assertRosterConstraints(constraints({ minWomen: 31, maxSize: 30 }));
    }).toThrow(RosterValidationError);
  });
});
