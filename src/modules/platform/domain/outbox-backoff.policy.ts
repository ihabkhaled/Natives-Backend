import {
  OUTBOX_BACKOFF_BASE_MS,
  OUTBOX_BACKOFF_CAP_MS,
  OUTBOX_MAX_ATTEMPTS,
} from '../model/platform.constants';
import type { RetryPlan } from '../model/platform.types';

/**
 * Pure retry/backoff policy for the transactional outbox. Given how many times an
 * event has now been attempted, decide whether to dead-letter it (attempt ceiling
 * reached) or reschedule it with a capped exponential backoff. Deterministic — the
 * caller supplies `now`, so tests freeze time.
 */
export function planRetry(attempts: number, now: Date): RetryPlan {
  if (attempts >= OUTBOX_MAX_ATTEMPTS) {
    return { deadLettered: true, availableAt: now };
  }
  return { deadLettered: false, availableAt: nextAvailableAt(attempts, now) };
}

/** Exponential backoff (base * 2^(attempts-1)) clamped to the cap. */
export function backoffDelayMs(attempts: number): number {
  const exponent = Math.max(0, attempts - 1);
  const raw = OUTBOX_BACKOFF_BASE_MS * 2 ** exponent;
  return Math.min(raw, OUTBOX_BACKOFF_CAP_MS);
}

function nextAvailableAt(attempts: number, now: Date): Date {
  return new Date(now.getTime() + backoffDelayMs(attempts));
}
