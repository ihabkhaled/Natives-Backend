import type {
  ActivityBuddy,
  ActivityEvidence,
  ActivitySubmission,
  ActivitySubmissionDetail,
  ActivityType,
  ReviewSubmissionDetail,
} from '../model/activity.types';
import type {
  ActivityTypeView,
  BuddyView,
  EvidenceView,
  ReviewDetailView,
  ReviewSubmissionView,
  SubmissionDetailView,
  SubmissionView,
} from '../model/activity.views';

function nullableIso(value: Date | null): string | null {
  return value === null ? null : value.toISOString();
}

export function toActivityTypeView(type: ActivityType): ActivityTypeView {
  return {
    id: type.id,
    typeKey: type.typeKey,
    name: type.name,
    description: type.description,
    category: type.category,
    unit: type.unit,
    defaultPointValue: type.defaultPointValue,
    pointsApproval: type.pointsApproval,
    requiresEvidence: type.requiresEvidence,
    minDurationMinutes: type.minDurationMinutes,
    maxDurationMinutes: type.maxDurationMinutes,
    catalogVersion: type.catalogVersion,
  };
}

/** Project a submission to the member-safe view (reviewer note deliberately dropped). */
export function toSubmissionView(
  submission: ActivitySubmission,
): SubmissionView {
  return {
    id: submission.id,
    teamId: submission.teamId,
    seasonId: submission.seasonId,
    membershipId: submission.membershipId,
    activityTypeId: submission.activityTypeId,
    status: submission.status,
    performedOn: submission.performedOn,
    durationMinutes: submission.durationMinutes,
    quantity: submission.quantity,
    notes: submission.notes,
    recordVersion: submission.recordVersion,
    submittedAt: nullableIso(submission.submittedAt),
    withdrawnAt: nullableIso(submission.withdrawnAt),
    createdAt: submission.createdAt.toISOString(),
    updatedAt: submission.updatedAt.toISOString(),
  };
}

export function toBuddyView(buddy: ActivityBuddy): BuddyView {
  return {
    id: buddy.id,
    submissionId: buddy.submissionId,
    membershipId: buddy.membershipId,
    status: buddy.status,
    respondedAt: nullableIso(buddy.respondedAt),
    createdAt: buddy.createdAt.toISOString(),
  };
}

export function toSubmissionDetailView(
  detail: ActivitySubmissionDetail,
): SubmissionDetailView {
  return {
    submission: toSubmissionView(detail.submission),
    buddies: detail.buddies.map(buddy => toBuddyView(buddy)),
    evidenceCount: detail.evidenceCount,
  };
}

/**
 * Reviewer-scoped submission projection: carries the reviewer note, review actor/
 * instant, reversal reason, and submitter identity. Still omits any evidence
 * storage reference — that stays behind the dedicated reviewer evidence endpoint.
 */
export function toReviewSubmissionView(
  submission: ActivitySubmission,
): ReviewSubmissionView {
  return {
    id: submission.id,
    teamId: submission.teamId,
    seasonId: submission.seasonId,
    membershipId: submission.membershipId,
    activityTypeId: submission.activityTypeId,
    submitterUserId: submission.submitterUserId,
    status: submission.status,
    performedOn: submission.performedOn,
    durationMinutes: submission.durationMinutes,
    quantity: submission.quantity,
    notes: submission.notes,
    reviewNote: submission.reviewNote,
    recordVersion: submission.recordVersion,
    submittedAt: nullableIso(submission.submittedAt),
    reviewedAt: nullableIso(submission.reviewedAt),
    reviewedBy: submission.reviewedBy,
    reviewerUserId: submission.reviewerUserId,
    reversalReason: submission.reversalReason,
    reversedAt: nullableIso(submission.reversedAt),
    createdAt: submission.createdAt.toISOString(),
    updatedAt: submission.updatedAt.toISOString(),
  };
}

/** Reviewer detail: the submission, credited buddies, count, and abuse signals. */
export function toReviewDetailView(
  detail: ReviewSubmissionDetail,
): ReviewDetailView {
  return {
    submission: toReviewSubmissionView(detail.submission),
    buddies: detail.buddies.map(buddy => toBuddyView(buddy)),
    evidenceCount: detail.evidenceCount,
    signals: detail.signals,
  };
}

/** Reviewer-only: carries the private storage reference. */
export function toEvidenceView(evidence: ActivityEvidence): EvidenceView {
  return {
    id: evidence.id,
    submissionId: evidence.submissionId,
    kind: evidence.kind,
    storageReference: evidence.storageReference,
    contentType: evidence.contentType,
    byteSize: evidence.byteSize,
    description: evidence.description,
    scanStatus: evidence.scanStatus,
    createdAt: evidence.createdAt.toISOString(),
  };
}
