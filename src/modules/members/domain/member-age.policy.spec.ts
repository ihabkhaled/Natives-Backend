import { describe, expect, it } from 'vitest';

import { AgeClassification } from '../model/members.enums';
import { classifyAge, computeAgeYears } from './member-age.policy';

const AS_OF = new Date('2026-07-18T12:00:00.000Z');

describe('member-age.policy', () => {
  describe('computeAgeYears', () => {
    it('computes whole completed years', () => {
      expect(computeAgeYears('2000-01-01', AS_OF)).toBe(26);
    });

    it('does not count a birthday later this year', () => {
      // Birthday 2026-12-01 has not occurred by 2026-07-18.
      expect(computeAgeYears('2005-12-01', AS_OF)).toBe(20);
    });

    it('counts a birthday earlier this year', () => {
      expect(computeAgeYears('2005-01-01', AS_OF)).toBe(21);
    });

    it('handles a birthday on the same month, later day', () => {
      expect(computeAgeYears('2005-07-20', AS_OF)).toBe(20);
    });

    it('handles a birthday on the same month and day', () => {
      expect(computeAgeYears('2005-07-18', AS_OF)).toBe(21);
    });

    it('returns null for a malformed date', () => {
      expect(computeAgeYears('not-a-date', AS_OF)).toBeNull();
    });

    it('returns null for an impossible calendar date', () => {
      expect(computeAgeYears('2005-02-30', AS_OF)).toBeNull();
    });

    it('returns null for a future birth date (negative age)', () => {
      expect(computeAgeYears('2030-01-01', AS_OF)).toBeNull();
    });
  });

  describe('classifyAge', () => {
    it('returns null for a missing date of birth (null-not-zero)', () => {
      expect(classifyAge(null, AS_OF)).toBeNull();
    });

    it('returns null when the date cannot be parsed', () => {
      expect(classifyAge('13/02/2005', AS_OF)).toBeNull();
    });

    it('classifies under-17', () => {
      expect(classifyAge('2015-01-01', AS_OF)).toBe(AgeClassification.Under17);
    });

    it('classifies under-20', () => {
      expect(classifyAge('2008-01-01', AS_OF)).toBe(AgeClassification.Under20);
    });

    it('classifies senior', () => {
      expect(classifyAge('2000-01-01', AS_OF)).toBe(AgeClassification.Senior);
    });

    it('classifies masters at 33', () => {
      expect(classifyAge('1993-01-01', AS_OF)).toBe(AgeClassification.Masters);
    });

    it('classifies grand-masters at 40', () => {
      expect(classifyAge('1980-01-01', AS_OF)).toBe(
        AgeClassification.GrandMasters,
      );
    });
  });
});
