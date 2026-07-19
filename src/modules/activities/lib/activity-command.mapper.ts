import { REVIEW_QUEUE_DEFAULT_STATUSES } from '../model/activities.constants';
import type { ReviewDecision, SubmissionStatus } from '../model/activity.enums';
import type {
  EvidenceInput,
  EvidenceItem,
  PageRequest,
  ReviewCorrectionCommand,
  ReviewCorrectionInput,
  ReviewDecisionCommand,
  ReviewDecisionInput,
  ReviewQueueQuery,
  SubmissionContent,
  SubmissionContentInput,
} from '../model/activity.types';

/** Normalize the transport submission content into the null-not-zero command shape. */
export function toSubmissionContent(
  input: SubmissionContentInput,
): SubmissionContent {
  return {
    activityTypeId: input.activityTypeId,
    seasonId: input.seasonId ?? null,
    performedOn: input.performedOn,
    durationMinutes: input.durationMinutes ?? null,
    quantity: input.quantity ?? null,
    notes: input.notes ?? null,
  };
}

/** Normalize evidence attachments, defaulting optional metadata to null. */
export function toEvidenceItems(
  inputs: readonly EvidenceInput[] | undefined,
): readonly EvidenceItem[] {
  return (inputs ?? []).map(input => ({
    kind: input.kind,
    storageReference: input.storageReference,
    contentType: input.contentType ?? null,
    byteSize: input.byteSize ?? null,
    description: input.description ?? null,
  }));
}

/** Normalize the optional buddy membership id list to a bounded array. */
export function toBuddyMembershipIds(
  ids: readonly string[] | undefined,
): readonly string[] {
  return ids ?? [];
}

/**
 * Normalize the reviewer queue filter into an allowlisted, bounded query. With no
 * explicit status the queue defaults to the actionable states; a supplied status
 * (already allowlisted by the DTO) narrows to exactly that one.
 */
export function toReviewQueueQuery(
  status: SubmissionStatus | undefined,
  activityTypeId: string | undefined,
  membershipId: string | undefined,
  page: PageRequest,
): ReviewQueueQuery {
  return {
    page,
    statuses: status === undefined ? REVIEW_QUEUE_DEFAULT_STATUSES : [status],
    activityTypeId: activityTypeId ?? null,
    membershipId: membershipId ?? null,
  };
}

/** Normalize a reviewer decision body plus its fixed decision into a command. */
export function toReviewDecisionCommand(
  input: ReviewDecisionInput,
  decision: ReviewDecision,
): ReviewDecisionCommand {
  return {
    expectedRecordVersion: input.expectedRecordVersion,
    decision,
    reviewNote: input.reviewNote ?? null,
  };
}

/** Normalize a correction body into the compensating-reversal command. */
export function toReviewCorrectionCommand(
  input: ReviewCorrectionInput,
): ReviewCorrectionCommand {
  return {
    expectedRecordVersion: input.expectedRecordVersion,
    reason: input.reason,
  };
}
