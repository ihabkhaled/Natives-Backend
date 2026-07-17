import { describe, expect, it } from 'vitest';

import type { FailedLoginState } from '../model/identity.types';
import {
  computeFailedLoginDecision,
  isLockedOut,
  isWindowExpired,
  shouldLock,
} from './failed-login.policy';

const NOW = new Date('2026-06-01T12:00:00.000Z');
const WINDOW_SECONDS = 900;
const MAX_ATTEMPTS = 3;
const LOCKOUT_SECONDS = 900;

function makeState(
  overrides: Partial<FailedLoginState> = {},
): FailedLoginState {
  return {
    id: 'state-1',
    email: 'coach@example.test',
    attemptCount: 1,
    firstAttemptAt: NOW,
    lockedUntil: null,
    ...overrides,
  };
}

describe('isLockedOut', () => {
  it('is locked when lockedUntil is in the future', () => {
    const lockedUntil = new Date(NOW.getTime() + 60_000);
    expect(isLockedOut(makeState({ lockedUntil }), NOW)).toBe(true);
  });

  it('is not locked when lockedUntil is null', () => {
    expect(isLockedOut(makeState({ lockedUntil: null }), NOW)).toBe(false);
  });

  it('is not locked when lockedUntil is in the past', () => {
    const lockedUntil = new Date(NOW.getTime() - 60_000);
    expect(isLockedOut(makeState({ lockedUntil }), NOW)).toBe(false);
  });

  it('is not locked when lockedUntil equals now (boundary)', () => {
    expect(isLockedOut(makeState({ lockedUntil: NOW }), NOW)).toBe(false);
  });
});

describe('isWindowExpired', () => {
  it('is expired when now is past the window end', () => {
    const firstAttemptAt = new Date(NOW.getTime() - 3_600_000);
    expect(
      isWindowExpired(makeState({ firstAttemptAt }), NOW, WINDOW_SECONDS),
    ).toBe(true);
  });

  it('is not expired within the window', () => {
    const firstAttemptAt = new Date(NOW.getTime() - 60_000);
    expect(
      isWindowExpired(makeState({ firstAttemptAt }), NOW, WINDOW_SECONDS),
    ).toBe(false);
  });

  it('is not expired exactly at the window end (boundary)', () => {
    const firstAttemptAt = new Date(NOW.getTime() - WINDOW_SECONDS * 1000);
    expect(
      isWindowExpired(makeState({ firstAttemptAt }), NOW, WINDOW_SECONDS),
    ).toBe(false);
  });
});

describe('shouldLock', () => {
  it('locks when the count reaches the ceiling', () => {
    expect(shouldLock(MAX_ATTEMPTS, MAX_ATTEMPTS)).toBe(true);
  });

  it('locks when the count exceeds the ceiling', () => {
    expect(shouldLock(MAX_ATTEMPTS + 1, MAX_ATTEMPTS)).toBe(true);
  });

  it('does not lock below the ceiling', () => {
    expect(shouldLock(MAX_ATTEMPTS - 1, MAX_ATTEMPTS)).toBe(false);
  });
});

describe('computeFailedLoginDecision', () => {
  it('increments the counter within an unexpired window', () => {
    const state = makeState({
      attemptCount: 1,
      firstAttemptAt: new Date(NOW.getTime() - 60_000),
    });

    const decision = computeFailedLoginDecision(
      state,
      NOW,
      WINDOW_SECONDS,
      MAX_ATTEMPTS,
      LOCKOUT_SECONDS,
    );

    expect(decision).toEqual({
      attemptCount: 2,
      firstAttemptAt: state.firstAttemptAt,
      lockedUntil: null,
      locked: false,
    });
  });

  it('resets the counter and firstAttemptAt after the window elapses', () => {
    const state = makeState({
      attemptCount: 2,
      firstAttemptAt: new Date(NOW.getTime() - 3_600_000),
    });

    const decision = computeFailedLoginDecision(
      state,
      NOW,
      WINDOW_SECONDS,
      MAX_ATTEMPTS,
      LOCKOUT_SECONDS,
    );

    expect(decision).toEqual({
      attemptCount: 1,
      firstAttemptAt: NOW,
      lockedUntil: null,
      locked: false,
    });
  });

  it('locks and computes the lockout instant when the ceiling is reached', () => {
    const state = makeState({
      attemptCount: 2,
      firstAttemptAt: new Date(NOW.getTime() - 60_000),
    });

    const decision = computeFailedLoginDecision(
      state,
      NOW,
      WINDOW_SECONDS,
      MAX_ATTEMPTS,
      LOCKOUT_SECONDS,
    );

    expect(decision.attemptCount).toBe(3);
    expect(decision.locked).toBe(true);
    expect(decision.firstAttemptAt).toEqual(state.firstAttemptAt);
    expect(decision.lockedUntil).toEqual(
      new Date(NOW.getTime() + LOCKOUT_SECONDS * 1000),
    );
  });
});
