import { RsvpStatus } from '../model/rsvp.enums';
import type {
  PracticeRsvp,
  RsvpCounts,
  RsvpSummary,
  RsvpView,
} from '../model/rsvp.types';

/**
 * Pure mappers from RSVP domain rows to the API response projections. The summary
 * mapper derives `spotsRemaining` from capacity and the confirmed-going count — a
 * projection from source, never a stored editable total; an uncapped session keeps
 * a null remaining (null-not-zero).
 */

/** Map a stored RSVP to the member-facing view. */
export function toRsvpView(rsvp: PracticeRsvp): RsvpView {
  return {
    sessionId: rsvp.sessionId,
    membershipId: rsvp.membershipId,
    status: rsvp.status,
    reasonCategory: rsvp.reasonCategory,
    note: rsvp.note,
    noteVisibility: rsvp.noteVisibility,
    source: rsvp.source,
    waitlisted: rsvp.waitlisted,
    respondedAt: rsvp.respondedAt,
    version: rsvp.version,
  };
}

/**
 * The explicit "not answered yet" view for a member with no stored row. Absence is
 * modelled as `no_response` rather than a 404, so the client always has a status.
 */
export function noResponseView(
  sessionId: string,
  membershipId: string,
): RsvpView {
  return {
    sessionId,
    membershipId,
    status: RsvpStatus.NoResponse,
    reasonCategory: null,
    note: null,
    noteVisibility: null,
    source: null,
    waitlisted: false,
    respondedAt: null,
    version: null,
  };
}

/** Map projected counts + session capacity to the privacy-safe summary. */
export function toRsvpSummary(
  sessionId: string,
  capacity: number | null,
  counts: RsvpCounts,
): RsvpSummary {
  return {
    sessionId,
    capacity,
    going: counts.going,
    waitlisted: counts.waitlisted,
    notGoing: counts.notGoing,
    maybe: counts.maybe,
    noResponse: counts.noResponse,
    spotsRemaining:
      capacity === null ? null : Math.max(0, capacity - counts.going),
  };
}
