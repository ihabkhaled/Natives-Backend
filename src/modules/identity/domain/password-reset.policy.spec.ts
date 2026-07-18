import { describe, expect, it } from 'vitest';

import type { PasswordResetToken } from '../model/identity.types';
import { isResetTokenUsable } from './password-reset.policy';

const NOW = new Date('2026-06-01T12:00:00.000Z');
const FUTURE = new Date(NOW.getTime() + 60_000);
const PAST = new Date(NOW.getTime() - 60_000);

function makeToken(
  overrides: Partial<PasswordResetToken> = {},
): PasswordResetToken {
  return {
    id: 'reset-1',
    userId: 'user-1',
    expiresAt: FUTURE,
    consumedAt: null,
    ...overrides,
  };
}

describe('isResetTokenUsable', () => {
  it('is usable when unconsumed and unexpired', () => {
    expect(isResetTokenUsable(makeToken(), NOW)).toBe(true);
  });

  it('is unusable once consumed', () => {
    expect(isResetTokenUsable(makeToken({ consumedAt: PAST }), NOW)).toBe(
      false,
    );
  });

  it('is unusable when expired', () => {
    expect(isResetTokenUsable(makeToken({ expiresAt: PAST }), NOW)).toBe(false);
  });

  it('is unusable when expiring exactly now (boundary)', () => {
    expect(isResetTokenUsable(makeToken({ expiresAt: NOW }), NOW)).toBe(false);
  });

  it('is unusable when both consumed and expired', () => {
    expect(
      isResetTokenUsable(makeToken({ consumedAt: PAST, expiresAt: PAST }), NOW),
    ).toBe(false);
  });
});
