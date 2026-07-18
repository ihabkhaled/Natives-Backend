import { describe, expect, it } from 'vitest';

import { REDACTED_VALUE } from '../model/platform.constants';
import { isSensitiveKey, redactScalarPayload } from './redaction.policy';

describe('redaction.policy', () => {
  describe('isSensitiveKey', () => {
    it('flags token, password, contact, and health keys case-insensitively', () => {
      expect(isSensitiveKey('refreshToken')).toBe(true);
      expect(isSensitiveKey('Password_Hash')).toBe(true);
      expect(isSensitiveKey('phone-number')).toBe(true);
      expect(isSensitiveKey('EMAIL')).toBe(true);
      expect(isSensitiveKey('injuryNote')).toBe(true);
    });

    it('leaves non-sensitive identifiers alone', () => {
      expect(isSensitiveKey('membershipId')).toBe(false);
      expect(isSensitiveKey('teamId')).toBe(false);
      expect(isSensitiveKey('status')).toBe(false);
    });
  });

  describe('redactScalarPayload', () => {
    it('masks sensitive values but preserves safe ones and their types', () => {
      const result = redactScalarPayload({
        membershipId: 'mem-1',
        email: 'a@example.test',
        count: 3,
        active: true,
        seasonId: null,
      });
      expect(result).toEqual({
        membershipId: 'mem-1',
        email: REDACTED_VALUE,
        count: 3,
        active: true,
        seasonId: null,
      });
    });

    it('returns an empty object unchanged', () => {
      expect(redactScalarPayload({})).toEqual({});
    });
  });
});
