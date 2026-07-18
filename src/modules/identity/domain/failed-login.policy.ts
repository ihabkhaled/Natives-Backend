import { MILLISECONDS_PER_SECOND } from '../model/identity.constants';
import type {
  FailedLoginDecision,
  FailedLoginState,
} from '../model/identity.types';

/** The identity is currently locked out when the lockout instant is in the future. */
export function isLockedOut(state: FailedLoginState, now: Date): boolean {
  return (
    state.lockedUntil !== null && state.lockedUntil.getTime() > now.getTime()
  );
}

/** The recorded attempt window has elapsed, so the counter should reset. */
export function isWindowExpired(
  state: FailedLoginState,
  now: Date,
  windowSeconds: number,
): boolean {
  const windowEnd = state.firstAttemptAt.getTime() + windowSeconds * 1000;
  return now.getTime() > windowEnd;
}

/** A fresh failure count reaching the configured ceiling triggers a lockout. */
export function shouldLock(attemptCount: number, maxAttempts: number): boolean {
  return attemptCount >= maxAttempts;
}

/**
 * Derive the next failed-login accounting from the current state and the
 * configured window/ceiling/lockout. Resets the counter when the window has
 * elapsed and computes the lockout instant when the ceiling is reached.
 */
export function computeFailedLoginDecision(
  state: FailedLoginState,
  now: Date,
  windowSeconds: number,
  maxAttempts: number,
  lockoutSeconds: number,
): FailedLoginDecision {
  const reset = isWindowExpired(state, now, windowSeconds);
  const attemptCount = reset ? 1 : state.attemptCount + 1;
  const firstAttemptAt = reset ? now : state.firstAttemptAt;
  const locked = shouldLock(attemptCount, maxAttempts);
  const lockedUntil = locked
    ? new Date(now.getTime() + lockoutSeconds * MILLISECONDS_PER_SECOND)
    : null;
  return { attemptCount, firstAttemptAt, lockedUntil, locked };
}
