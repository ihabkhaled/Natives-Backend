import { OperationOutcome } from '../model/matches.enums';
import type { RequestHashCarrier } from '../model/matches.types';

/**
 * Pure idempotency rules for a client operation id. This is the contract an
 * offline scorekeeper replays against: the SAME operation id carrying the SAME
 * payload always yields exactly one authoritative score change, and the same id
 * carrying a DIFFERENT payload is an explicit conflict that is rejected — never
 * silently merged into the score.
 *
 * No side effects, no time, no persistence — every branch is unit-tested.
 */

/** Classify an incoming operation against any event already stored under its id. */
export function classifyOperation(
  existing: RequestHashCarrier | null,
  requestHash: string,
): OperationOutcome {
  if (existing === null) {
    return OperationOutcome.Applied;
  }
  if (existing.requestHash === requestHash) {
    return OperationOutcome.Replayed;
  }
  return OperationOutcome.Conflict;
}

/** True when the classification means the caller must be told 409, not 200. */
export function isOperationConflict(outcome: OperationOutcome): boolean {
  return outcome === OperationOutcome.Conflict;
}

/** True when the stored event should be returned verbatim without re-applying. */
export function isOperationReplay(outcome: OperationOutcome): boolean {
  return outcome === OperationOutcome.Replayed;
}

/**
 * True when a caller-supplied expected stream version still matches the server's.
 * `null` means the device did not claim a base version and defers to the server —
 * a deliberate affordance, not a silent overwrite, because the operation id still
 * guarantees at-most-once application.
 */
export function matchesStreamVersion(
  expected: number | null,
  actual: number,
): boolean {
  return expected === null || expected === actual;
}

/** The sequence number the next appended event takes. */
export function nextSequence(streamVersion: number): number {
  return streamVersion + 1;
}
