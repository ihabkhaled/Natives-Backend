import { describe, expect, it } from 'vitest';

import { toAssessmentCountSignal } from './signals.mapper';

describe('toAssessmentCountSignal', () => {
  it('reports a real count with its boundary instant', () => {
    expect(
      toAssessmentCountSignal([
        { count: 3, boundary_at: '2026-07-01T00:00:00.000Z' },
      ]),
    ).toEqual({ count: 3, asOf: new Date('2026-07-01T00:00:00.000Z') });
  });

  it('accepts a driver-supplied Date without re-parsing it', () => {
    const boundary = new Date('2026-07-01T00:00:00.000Z');

    expect(
      toAssessmentCountSignal([{ count: 1, boundary_at: boundary }]).asOf,
    ).toBe(boundary);
  });

  it('reports null rather than zero for an empty aggregate', () => {
    expect(toAssessmentCountSignal([{ count: 0, boundary_at: null }])).toEqual({
      count: null,
      asOf: null,
    });
  });

  it('reports null when no aggregate row came back', () => {
    expect(toAssessmentCountSignal([])).toEqual({ count: null, asOf: null });
  });

  it('keeps a count whose boundary is unknown', () => {
    expect(toAssessmentCountSignal([{ count: 2, boundary_at: null }])).toEqual({
      count: 2,
      asOf: null,
    });
  });
});
