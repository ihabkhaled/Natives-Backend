import { FeedbackStatus } from '../model/feedback.enums';
import type {
  CoachFeedback,
  FeedbackAcknowledgement,
  SharedFeedback,
} from '../model/feedback.types';

/**
 * Pure field-visibility rules for coach feedback. The coach-only note is the
 * privacy-critical field: it is NEVER shaped into a player-facing view. This
 * policy is the single place that projects the internal aggregate down to the
 * member-visible {@link SharedFeedback}, which does not even declare a coachNote
 * property — so a private note cannot leak by omission or accident. No side
 * effects, no time, no persistence — every branch is unit-tested.
 */

/** A player may only ever see PUBLISHED or REVISED feedback about themselves. */
export function isPlayerVisible(status: FeedbackStatus): boolean {
  return (
    status === FeedbackStatus.Published || status === FeedbackStatus.Revised
  );
}

/**
 * Project a coach feedback aggregate into the member-visible shape, dropping the
 * private coach note and every workflow/actor field. An acknowledgement, when
 * present, contributes only its acknowledged instant and clarification flag.
 */
export function toSharedFeedback(
  feedback: CoachFeedback,
  acknowledgement: FeedbackAcknowledgement | null,
): SharedFeedback {
  return {
    id: feedback.id,
    teamId: feedback.teamId,
    membershipId: feedback.membershipId,
    status: feedback.status,
    revision: feedback.revision,
    positiveFrisbee: feedback.positiveFrisbee,
    frisbeeImprovement: feedback.frisbeeImprovement,
    positiveMental: feedback.positiveMental,
    mentalImprovement: feedback.mentalImprovement,
    teamRole: feedback.teamRole,
    recommendedPosition: feedback.recommendedPosition,
    summary: feedback.summary,
    publishedAt: feedback.publishedAt,
    acknowledgedAt:
      acknowledgement === null ? null : acknowledgement.acknowledgedAt,
    clarificationRequested:
      acknowledgement === null ? false : acknowledgement.clarificationRequested,
  };
}
