import { describe, expect, it } from 'vitest';

import type { SeasonDateRange } from '../model/teams.types';
import {
  findOverlappingSeason,
  isValidSeasonRange,
  rangesOverlap,
} from './season-schedule.policy';

describe('season-schedule.policy', () => {
  describe('isValidSeasonRange', () => {
    it('accepts an ordered range and an equal single-day range', () => {
      expect(isValidSeasonRange('2026-01-01', '2026-06-30')).toBe(true);
      expect(isValidSeasonRange('2026-01-01', '2026-01-01')).toBe(true);
    });

    it('rejects a range that ends before it starts', () => {
      expect(isValidSeasonRange('2026-06-30', '2026-01-01')).toBe(false);
    });
  });

  describe('rangesOverlap', () => {
    it('detects overlapping ranges', () => {
      expect(
        rangesOverlap('2026-01-01', '2026-06-30', '2026-06-01', '2026-12-31'),
      ).toBe(true);
    });

    it('treats touching inclusive bounds as overlapping', () => {
      expect(
        rangesOverlap('2026-01-01', '2026-06-30', '2026-06-30', '2026-12-31'),
      ).toBe(true);
    });

    it('returns false for disjoint ranges', () => {
      expect(
        rangesOverlap('2026-01-01', '2026-06-30', '2026-07-01', '2026-12-31'),
      ).toBe(false);
    });
  });

  describe('findOverlappingSeason', () => {
    const existing: readonly SeasonDateRange[] = [
      { id: 'spring', startsOn: '2026-01-01', endsOn: '2026-06-30' },
      { id: 'fall', startsOn: '2026-09-01', endsOn: '2026-12-31' },
    ];

    it('returns null when the candidate range is free', () => {
      expect(
        findOverlappingSeason(existing, '2026-07-01', '2026-08-31', null),
      ).toBeNull();
    });

    it('returns the first overlapping season', () => {
      expect(
        findOverlappingSeason(existing, '2026-06-15', '2026-07-15', null),
      ).toEqual(existing[0]);
    });

    it('excludes the season being updated', () => {
      expect(
        findOverlappingSeason(existing, '2026-01-01', '2026-06-30', 'spring'),
      ).toBeNull();
    });

    it('returns null for an empty existing set', () => {
      expect(
        findOverlappingSeason([], '2026-01-01', '2026-06-30', null),
      ).toBeNull();
    });
  });
});
