import { SessionStatus, SessionTransition } from '../model/measurements.enums';

/**
 * Pure lifecycle rules for a measurement session. A `scheduled` session may be
 * conducted or cancelled; a conducted or cancelled session is terminal. Returns
 * the resulting status for an allowed transition, or null when the verb is not
 * legal from the current state — the caller maps null to an invalid-transition
 * error. Every branch is unit-tested.
 */
export function nextSessionStatus(
  current: SessionStatus,
  transition: SessionTransition,
): SessionStatus | null {
  if (current !== SessionStatus.Scheduled) {
    return null;
  }
  if (transition === SessionTransition.Conduct) {
    return SessionStatus.Conducted;
  }
  return SessionStatus.Cancelled;
}

/** Whether a session in this state accepts newly recorded attempts. */
export function acceptsAttempts(status: SessionStatus): boolean {
  return (
    status === SessionStatus.Scheduled || status === SessionStatus.Conducted
  );
}
