import { describe, expect, it } from 'vitest';

import {
  aliasesCollide,
  isMatchableAlias,
  normalizeAlias,
} from './alias-normalization.policy';

describe('alias-normalization.policy', () => {
  describe('normalizeAlias', () => {
    it('lowercases, trims, and collapses whitespace', () => {
      expect(normalizeAlias('  Ahmed   Hassan  ')).toBe('ahmed hassan');
    });

    it('strips diacritics', () => {
      expect(normalizeAlias('José')).toBe('jose');
    });

    it('folds full-width compatibility forms', () => {
      // Full-width "ＡＢ" normalizes to ascii "ab".
      expect(normalizeAlias('ＡＢ')).toBe('ab');
    });

    it('reduces a whitespace-only alias to empty', () => {
      expect(normalizeAlias('   \t  ')).toBe('');
    });
  });

  describe('isMatchableAlias', () => {
    it('is true for a non-empty normalized alias', () => {
      expect(isMatchableAlias('Native')).toBe(true);
    });

    it('is false for whitespace-only input', () => {
      expect(isMatchableAlias('   ')).toBe(false);
    });
  });

  describe('aliasesCollide', () => {
    it('detects a collision across casing and diacritics', () => {
      expect(aliasesCollide('José  García', 'jose garcia')).toBe(true);
    });

    it('is false for distinct aliases', () => {
      expect(aliasesCollide('Handler One', 'Cutter Two')).toBe(false);
    });

    it('is false when the normalized key is empty', () => {
      expect(aliasesCollide('   ', '   ')).toBe(false);
    });
  });
});
