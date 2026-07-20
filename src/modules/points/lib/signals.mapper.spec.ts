import { describe, expect, it } from 'vitest';

import { EMPTY_POINTS_STANDING, toPointsStanding } from './signals.mapper';

describe('toPointsStanding', () => {
  it('projects the ranked ledger row, coercing the numeric total', () => {
    expect(
      toPointsStanding([
        {
          total: '42',
          rank: 2,
          population: 11,
          latest_at: '2026-07-18T00:00:00.000Z',
        },
      ]),
    ).toEqual({
      total: 42,
      rank: 2,
      population: 11,
      asOf: new Date('2026-07-18T00:00:00.000Z'),
    });
  });

  it('accepts a driver-supplied Date without re-parsing it', () => {
    const latest = new Date('2026-07-18T00:00:00.000Z');

    expect(
      toPointsStanding([
        { total: 1, rank: 1, population: 1, latest_at: latest },
      ]).asOf,
    ).toBe(latest);
  });

  it('keeps a standing whose latest instant is unknown', () => {
    expect(
      toPointsStanding([{ total: 1, rank: 1, population: 1, latest_at: null }])
        .asOf,
    ).toBeNull();
  });

  it('reports nothing evaluated when the member has no ledger history', () => {
    expect(toPointsStanding([])).toBe(EMPTY_POINTS_STANDING);
    expect(EMPTY_POINTS_STANDING.total).toBeNull();
    expect(EMPTY_POINTS_STANDING.rank).toBeNull();
  });
});
