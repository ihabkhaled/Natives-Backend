import { describe, expect, it } from 'vitest';

import type { RefreshSession } from '../model/identity.types';
import { isSessionActive, isSessionReuse } from './refresh-session.policy';

const NOW = new Date('2026-06-01T12:00:00.000Z');
const FUTURE = new Date(NOW.getTime() + 60_000);
const PAST = new Date(NOW.getTime() - 60_000);

function makeSession(overrides: Partial<RefreshSession> = {}): RefreshSession {
  return {
    id: 'session-1',
    userId: 'user-1',
    familyId: 'family-1',
    deviceLabel: null,
    issuedAt: PAST,
    expiresAt: FUTURE,
    rotatedAt: null,
    revokedAt: null,
    reuseDetectedAt: null,
    ...overrides,
  };
}

describe('isSessionActive', () => {
  it('is active when not rotated, revoked, reused, and unexpired', () => {
    expect(isSessionActive(makeSession(), NOW)).toBe(true);
  });

  it('is inactive when rotated', () => {
    expect(isSessionActive(makeSession({ rotatedAt: PAST }), NOW)).toBe(false);
  });

  it('is inactive when revoked', () => {
    expect(isSessionActive(makeSession({ revokedAt: PAST }), NOW)).toBe(false);
  });

  it('is inactive when reuse was detected', () => {
    expect(isSessionActive(makeSession({ reuseDetectedAt: PAST }), NOW)).toBe(
      false,
    );
  });

  it('is inactive when expired', () => {
    expect(isSessionActive(makeSession({ expiresAt: PAST }), NOW)).toBe(false);
  });

  it('is inactive when expiring exactly now (boundary)', () => {
    expect(isSessionActive(makeSession({ expiresAt: NOW }), NOW)).toBe(false);
  });
});

describe('isSessionReuse', () => {
  it('flags reuse when the session was rotated', () => {
    expect(isSessionReuse(makeSession({ rotatedAt: PAST }))).toBe(true);
  });

  it('flags reuse when the session was revoked', () => {
    expect(isSessionReuse(makeSession({ revokedAt: PAST }))).toBe(true);
  });

  it('flags reuse when both rotated and revoked', () => {
    expect(
      isSessionReuse(makeSession({ rotatedAt: PAST, revokedAt: PAST })),
    ).toBe(true);
  });

  it('does not flag reuse for a pristine session', () => {
    expect(isSessionReuse(makeSession())).toBe(false);
  });
});
