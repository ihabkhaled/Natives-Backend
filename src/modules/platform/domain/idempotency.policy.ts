import { IdempotencyOutcome, IdempotencyStatus } from '../model/platform.enums';
import type { IdempotencyRecord } from '../model/platform.types';

/**
 * Pure classification of an incoming idempotent request against any stored record
 * for the same key + principal:
 *
 *   - no record            -> New     (proceed and persist an in-progress record)
 *   - different hash       -> Conflict (same key, different request body)
 *   - same hash, completed -> Replay   (return the stored result verbatim)
 *   - same hash, in flight -> Conflict (a concurrent attempt is still running)
 *
 * No side effects; the service turns the outcome into inserts/throws.
 */
export function classifyIdempotency(
  existing: IdempotencyRecord | null,
  requestHash: string,
): IdempotencyOutcome {
  if (existing === null) {
    return IdempotencyOutcome.New;
  }
  if (existing.requestHash !== requestHash) {
    return IdempotencyOutcome.Conflict;
  }
  if (existing.status === IdempotencyStatus.Completed) {
    return IdempotencyOutcome.Replay;
  }
  return IdempotencyOutcome.Conflict;
}
