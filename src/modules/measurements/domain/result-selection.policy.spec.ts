import { describe, expect, it } from 'vitest';

import {
  MeasurementDirection,
  ResultPolicy,
} from '../model/measurements.enums';
import type { SelectableAttempt } from '../model/measurements.types';
import { selectResult } from './result-selection.policy';

function attempt(
  overrides: Partial<SelectableAttempt> = {},
): SelectableAttempt {
  return {
    attemptNumber: 1,
    value: 10,
    valid: true,
    disqualified: false,
    ...overrides,
  };
}

describe('selectResult', () => {
  it('returns all-null with no considered attempts (never zero)', () => {
    const result = selectResult(
      [],
      MeasurementDirection.BetterHigher,
      ResultPolicy.Best,
    );
    expect(result.selected).toBeNull();
    expect(result.best).toBeNull();
    expect(result.average).toBeNull();
    expect(result.latest).toBeNull();
    expect(result.consideredCount).toBe(0);
    expect(result.excludedCount).toBe(0);
  });

  it('excludes invalid, disqualified, and null-valued attempts', () => {
    const result = selectResult(
      [
        attempt({ attemptNumber: 1, value: 5, valid: false }),
        attempt({ attemptNumber: 2, value: 6, disqualified: true }),
        attempt({ attemptNumber: 3, value: null }),
        attempt({ attemptNumber: 4, value: 9 }),
      ],
      MeasurementDirection.BetterHigher,
      ResultPolicy.Best,
    );
    expect(result.selected).toBe(9);
    expect(result.consideredCount).toBe(1);
    expect(result.excludedCount).toBe(3);
  });

  it('picks the maximum when higher is better', () => {
    const result = selectResult(
      [
        attempt({ attemptNumber: 1, value: 7 }),
        attempt({ attemptNumber: 2, value: 12 }),
      ],
      MeasurementDirection.BetterHigher,
      ResultPolicy.Best,
    );
    expect(result.best).toBe(12);
    expect(result.selected).toBe(12);
  });

  it('picks the minimum when lower is better', () => {
    const result = selectResult(
      [
        attempt({ attemptNumber: 1, value: 3.1 }),
        attempt({ attemptNumber: 2, value: 2.9 }),
      ],
      MeasurementDirection.BetterLower,
      ResultPolicy.Best,
    );
    expect(result.best).toBe(2.9);
    expect(result.selected).toBe(2.9);
  });

  it('averages the considered values under the average policy', () => {
    const result = selectResult(
      [
        attempt({ attemptNumber: 1, value: 2 }),
        attempt({ attemptNumber: 2, value: 4 }),
        attempt({ attemptNumber: 3, value: 6 }),
      ],
      MeasurementDirection.BetterLower,
      ResultPolicy.Average,
    );
    expect(result.average).toBe(4);
    expect(result.selected).toBe(4);
  });

  it('selects the latest by attempt number under the latest policy', () => {
    const result = selectResult(
      [
        attempt({ attemptNumber: 3, value: 8 }),
        attempt({ attemptNumber: 1, value: 5 }),
        attempt({ attemptNumber: 2, value: 6 }),
      ],
      MeasurementDirection.BetterHigher,
      ResultPolicy.Latest,
    );
    expect(result.latest).toBe(8);
    expect(result.selected).toBe(8);
  });
});
