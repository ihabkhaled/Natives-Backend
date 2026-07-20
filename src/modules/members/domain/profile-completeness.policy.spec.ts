import { describe, expect, it } from 'vitest';

import type { ProfileCompletenessRow } from '../model/members.rows';
import { scoreProfileCompleteness } from './profile-completeness.policy';

const EMPTY: ProfileCompletenessRow = {
  preferred_name: null,
  email: null,
  phone: null,
  gender: null,
  date_of_birth: null,
  jersey_number: null,
  positions: [],
  avatar_media_id: null,
  updated_at: '2026-07-20T12:00:00.000Z',
};

const FULL: ProfileCompletenessRow = {
  preferred_name: 'Ammar',
  email: 'ammar@example.test',
  phone: '+201000000000',
  gender: 'man',
  date_of_birth: '2000-01-15',
  jersey_number: 7,
  positions: ['handler'],
  avatar_media_id: 'media-1',
  updated_at: '2026-07-20T12:00:00.000Z',
};

describe('scoreProfileCompleteness', () => {
  it('scores an untouched profile at zero percent', () => {
    expect(scoreProfileCompleteness(EMPTY)).toBe(0);
  });

  it('scores a fully filled profile at a hundred percent', () => {
    expect(scoreProfileCompleteness(FULL)).toBe(100);
  });

  it('counts an empty positions list as unfilled', () => {
    expect(scoreProfileCompleteness({ ...FULL, positions: [] })).toBe(88);
  });

  it('rounds a partial score to a whole percent', () => {
    const partial: ProfileCompletenessRow = {
      ...EMPTY,
      preferred_name: 'Ammar',
      email: 'ammar@example.test',
      phone: '+201000000000',
    };

    expect(scoreProfileCompleteness(partial)).toBe(38);
  });
});
