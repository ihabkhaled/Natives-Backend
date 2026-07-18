import { SessionStatus } from '../model/practices.enums';

/**
 * Pure RSVP availability-window rules. Times are compared as UTC instants (the
 * clock is injected upstream via ClockPort, never read here). No persistence, no
 * side effects — every branch is unit-tested.
 */

/**
 * True when self-service RSVP is still open at `now`. A null cutoff means no
 * deadline (always open); otherwise the response must be at or before the cutoff
 * instant. Coaches bypass this via the override path, which does not call this.
 */
export function isRsvpWindowOpen(now: Date, cutoffAt: Date | null): boolean {
  if (cutoffAt === null) {
    return true;
  }
  return now.getTime() <= cutoffAt.getTime();
}

/**
 * True when a session is in a state that accepts RSVP at all. Only announced
 * occurrences (published or rescheduled) are answerable; a draft is not yet
 * visible, and cancelled/completed/archived sessions are closed to new responses
 * while their existing RSVP history is preserved.
 */
export function canMemberRespond(status: SessionStatus): boolean {
  return (
    status === SessionStatus.Published || status === SessionStatus.Rescheduled
  );
}
