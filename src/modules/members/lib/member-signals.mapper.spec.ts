import { describe, expect, it } from 'vitest';

import type { ProfileCompletenessRow } from '../model/members.rows';
import {
  toMemberCountSignal,
  toProfileSignal,
  UNSCORED_PROFILE_SIGNAL,
} from './member-signals.mapper';

const PROFILE_ROW: ProfileCompletenessRow = {
  preferred_name: 'Ammar',
  email: null,
  phone: null,
  gender: null,
  date_of_birth: null,
  jersey_number: null,
  positions: [],
  avatar_media_id: null,
  updated_at: '2026-07-20T12:00:00.000Z',
};

describe('toMemberCountSignal', () => {
  it('reports a real count with its boundary instant', () => {
    const signal = toMemberCountSignal([
      { count: 3, boundary_at: '2026-07-01T00:00:00.000Z' },
    ]);

    expect(signal).toEqual({
      count: 3,
      asOf: new Date('2026-07-01T00:00:00.000Z'),
    });
  });

  it('reports null rather than zero when the aggregate found nothing', () => {
    expect(toMemberCountSignal([{ count: 0, boundary_at: null }])).toEqual({
      count: null,
      asOf: null,
    });
  });

  it('reports null when the aggregate returned no row at all', () => {
    expect(toMemberCountSignal([])).toEqual({ count: null, asOf: null });
  });

  it('keeps a count whose boundary instant is unknown', () => {
    expect(toMemberCountSignal([{ count: 2, boundary_at: null }])).toEqual({
      count: 2,
      asOf: null,
    });
  });
});

describe('toProfileSignal', () => {
  it('scores the profile and stamps its freshness', () => {
    expect(toProfileSignal([PROFILE_ROW])).toEqual({
      profileCompletenessPercent: 13,
      profileAsOf: new Date('2026-07-20T12:00:00.000Z'),
    });
  });

  it('reports nothing measured when the member has no profile row', () => {
    expect(toProfileSignal([])).toBe(UNSCORED_PROFILE_SIGNAL);
  });
});
