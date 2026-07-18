import { describe, expect, it } from 'vitest';

import {
  CatalogName,
  ResourceStatus,
  SeasonStatus,
  SettingKey,
} from '../model/teams.enums';
import {
  isIsoCalendarDate,
  parseCatalogName,
  parseResourceStatus,
  parseSeasonStatus,
  parseSettingKey,
  resolvePage,
  toDate,
  toNullableDate,
  toNullableNumber,
} from './teams.helpers';

describe('teams.helpers', () => {
  describe('date conversion', () => {
    it('converts strings and Dates', () => {
      const iso = '2026-01-01T00:00:00.000Z';
      expect(toDate(iso)).toEqual(new Date(iso));
      const date = new Date(iso);
      expect(toDate(date)).toBe(date);
    });

    it('preserves null for nullable dates', () => {
      expect(toNullableDate(null)).toBeNull();
      const date = new Date('2026-01-01T00:00:00.000Z');
      expect(toNullableDate(date)).toBe(date);
      expect(toNullableDate('2026-01-01T00:00:00.000Z')).toEqual(date);
    });
  });

  describe('toNullableNumber', () => {
    it('preserves null and parses numeric strings (null-not-zero)', () => {
      expect(toNullableNumber(null)).toBeNull();
      expect(toNullableNumber('0')).toBe(0);
      expect(toNullableNumber('30.123456')).toBeCloseTo(30.123456);
    });
  });

  describe('isIsoCalendarDate', () => {
    it('accepts a real calendar date', () => {
      expect(isIsoCalendarDate('2026-02-28')).toBe(true);
    });

    it('rejects malformed strings and impossible dates', () => {
      expect(isIsoCalendarDate('2026-1-1')).toBe(false);
      expect(isIsoCalendarDate('2026/01/01')).toBe(false);
      expect(isIsoCalendarDate('2026-02-31')).toBe(false);
      expect(isIsoCalendarDate('2026-13-01')).toBe(false);
    });
  });

  describe('resolvePage', () => {
    it('applies defaults when values are absent', () => {
      expect(resolvePage(undefined, undefined)).toEqual({
        limit: 20,
        offset: 0,
      });
    });

    it('clamps the limit to the maximum and floors negatives', () => {
      expect(resolvePage(9999, 5)).toEqual({ limit: 100, offset: 5 });
      expect(resolvePage(0, -3)).toEqual({ limit: 1, offset: 0 });
    });
  });

  describe('enum parsing', () => {
    it('parses known values', () => {
      expect(parseResourceStatus('active')).toBe(ResourceStatus.Active);
      expect(parseSeasonStatus('draft')).toBe(SeasonStatus.Draft);
      expect(parseCatalogName('division')).toBe(CatalogName.Division);
      expect(parseSettingKey('badge_tiers')).toBe(SettingKey.BadgeTiers);
    });

    it('throws on unrecognized values', () => {
      expect(() => parseResourceStatus('ghost')).toThrow(/resource status/u);
      expect(() => parseSeasonStatus('ghost')).toThrow(/season status/u);
      expect(() => parseCatalogName('ghost')).toThrow(/catalog name/u);
      expect(() => parseSettingKey('ghost')).toThrow(/setting key/u);
    });
  });
});
