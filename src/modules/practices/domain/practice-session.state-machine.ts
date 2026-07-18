import { SessionStatus } from '../model/practices.enums';

/**
 * Pure practice-session lifecycle state machine. Encodes the allowed transitions
 * from the product workflow: a draft is published, a published/rescheduled
 * session may be moved (rescheduled), cancelled (a status change that keeps all
 * RSVP/attendance history), completed, or archived; a cancelled session may be
 * re-opened (published) or archived; a completed session is locked except for
 * archival. Archived is terminal. No side effects, no time, no persistence —
 * every branch is unit-tested.
 */

const TRANSITIONS: ReadonlyMap<SessionStatus, readonly SessionStatus[]> =
  new Map([
    [
      SessionStatus.Draft,
      [
        SessionStatus.Published,
        SessionStatus.Cancelled,
        SessionStatus.Archived,
      ],
    ],
    [
      SessionStatus.Published,
      [
        SessionStatus.Rescheduled,
        SessionStatus.Cancelled,
        SessionStatus.Completed,
        SessionStatus.Archived,
      ],
    ],
    [
      SessionStatus.Rescheduled,
      [
        SessionStatus.Cancelled,
        SessionStatus.Completed,
        SessionStatus.Archived,
      ],
    ],
    [
      SessionStatus.Cancelled,
      [SessionStatus.Published, SessionStatus.Archived],
    ],
    [SessionStatus.Completed, [SessionStatus.Archived]],
    [SessionStatus.Archived, []],
  ]);

/** The set of states reachable from `from` in one transition. */
export function allowedTransitions(
  from: SessionStatus,
): readonly SessionStatus[] {
  return TRANSITIONS.get(from) ?? [];
}

/** True when moving from `from` to `to` is a permitted status transition. */
export function canTransition(from: SessionStatus, to: SessionStatus): boolean {
  if (from === to) {
    return false;
  }
  return allowedTransitions(from).includes(to);
}

/** Archived is terminal: no further transitions are permitted. */
export function isTerminal(status: SessionStatus): boolean {
  return allowedTransitions(status).length === 0;
}

/**
 * A session may be rescheduled (its times/venue moved) only while it is a live,
 * published or already-rescheduled occurrence. Rescheduling re-affirms the
 * `Rescheduled` status even from `Rescheduled`, so it is not a plain transition.
 */
export function canReschedule(status: SessionStatus): boolean {
  return (
    status === SessionStatus.Published || status === SessionStatus.Rescheduled
  );
}
