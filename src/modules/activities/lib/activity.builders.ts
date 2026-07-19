import type { AuditInput, DomainEventInput } from '@modules/platform';
import { AuditOutcome } from '@modules/platform';

import {
  ACTIVITIES_EVENT_VERSION,
  ACTIVITY_APPROVED_EVENT,
  ACTIVITY_CHANGES_REQUESTED_EVENT,
  ACTIVITY_CORRECTED_EVENT,
  ACTIVITY_REJECTED_EVENT,
  ACTIVITY_SUBMITTED_EVENT,
  ACTIVITY_WITHDRAWN_EVENT,
  BUDDY_RESOURCE_TYPE,
  SUBMISSION_AGGREGATE,
  SUBMISSION_RESOURCE_TYPE,
} from '../model/activities.constants';
import type { BuddyStatus, SubmissionStatus } from '../model/activity.enums';
import {
  ReviewDecision,
  SubmissionStatus as Status,
} from '../model/activity.enums';
import type {
  AbuseCounts,
  AbuseSignalFacts,
  ActivityBuddy,
  ActivitySubmission,
  BuddyResponseUpdate,
  CreateSubmissionCommand,
  EvidenceItem,
  NewActivityBuddy,
  NewActivityEvidence,
  NewActivitySubmission,
  ReviewClaimChange,
  ReviewDecisionChange,
  ReviewReversalChange,
  SubmissionContent,
  SubmissionContentUpdate,
  SubmissionStatusChange,
} from '../model/activity.types';

/** Build a DRAFT submission from a create command and the resolved identity. */
export function buildNewSubmission(
  id: string,
  teamId: string,
  membershipId: string,
  submitterUserId: string,
  command: CreateSubmissionCommand,
  now: Date,
): NewActivitySubmission {
  return {
    id,
    teamId,
    membershipId,
    submitterUserId,
    status: Status.Draft,
    content: command.content,
    now,
  };
}

/** Map buddy membership ids onto insertable rows with a resolved initial status. */
export function buildBuddyRows(
  submissionId: string,
  membershipIds: readonly string[],
  status: BuddyStatus,
  generateId: () => string,
  now: Date,
): readonly NewActivityBuddy[] {
  return membershipIds.map(membershipId => ({
    id: generateId(),
    submissionId,
    membershipId,
    status,
    now,
  }));
}

/** Map evidence inputs onto insertable rows, one generated id per item. */
export function buildEvidenceRows(
  submissionId: string,
  items: readonly EvidenceItem[],
  createdBy: string,
  generateId: () => string,
  now: Date,
): readonly NewActivityEvidence[] {
  return items.map(item => ({
    id: generateId(),
    submissionId,
    item,
    createdBy,
    now,
  }));
}

export function buildContentUpdate(
  submissionId: string,
  teamId: string,
  expectedRecordVersion: number,
  content: SubmissionContent,
  now: Date,
): SubmissionContentUpdate {
  return {
    id: submissionId,
    teamId,
    expectedRecordVersion,
    content,
    now,
  };
}

export function buildStatusChange(
  submissionId: string,
  teamId: string,
  expectedRecordVersion: number,
  toStatus: SubmissionStatus,
  actorUserId: string,
  now: Date,
): SubmissionStatusChange {
  return {
    id: submissionId,
    teamId,
    expectedRecordVersion,
    toStatus,
    actorUserId,
    now,
  };
}

export function buildBuddyResponseUpdate(
  buddyId: string,
  toStatus: BuddyStatus,
  actorUserId: string,
  now: Date,
): BuddyResponseUpdate {
  return { id: buddyId, toStatus, actorUserId, now };
}

export function buildSubmissionAudit(
  action: string,
  actorUserId: string,
  submission: ActivitySubmission,
): AuditInput {
  return {
    actorUserId,
    action,
    resourceType: SUBMISSION_RESOURCE_TYPE,
    resourceId: submission.id,
    teamId: submission.teamId,
    seasonId: submission.seasonId,
    correlationId: null,
    outcome: AuditOutcome.Success,
    diff: {
      status: submission.status,
      recordVersion: submission.recordVersion,
      activityTypeId: submission.activityTypeId,
    },
  };
}

export function buildBuddyAudit(
  action: string,
  actorUserId: string,
  buddy: ActivityBuddy,
  teamId: string,
): AuditInput {
  return {
    actorUserId,
    action,
    resourceType: BUDDY_RESOURCE_TYPE,
    resourceId: buddy.id,
    teamId,
    seasonId: null,
    correlationId: null,
    outcome: AuditOutcome.Success,
    diff: {
      status: buddy.status,
      submissionId: buddy.submissionId,
    },
  };
}

/** ActivitySubmitted carries only privacy-safe scalars — never notes or evidence. */
export function buildActivitySubmittedEvent(
  submission: ActivitySubmission,
  buddyCount: number,
): DomainEventInput {
  return {
    aggregateType: SUBMISSION_AGGREGATE,
    aggregateId: submission.id,
    eventType: ACTIVITY_SUBMITTED_EVENT,
    eventVersion: ACTIVITIES_EVENT_VERSION,
    actorUserId: submission.submitterUserId,
    teamId: submission.teamId,
    seasonId: submission.seasonId,
    correlationId: null,
    causationId: null,
    payload: {
      submissionId: submission.id,
      membershipId: submission.membershipId,
      activityTypeId: submission.activityTypeId,
      status: submission.status,
      performedOn: submission.performedOn,
      durationMinutes: submission.durationMinutes,
      buddyCount,
    },
  };
}

export function buildActivityWithdrawnEvent(
  submission: ActivitySubmission,
): DomainEventInput {
  return {
    aggregateType: SUBMISSION_AGGREGATE,
    aggregateId: submission.id,
    eventType: ACTIVITY_WITHDRAWN_EVENT,
    eventVersion: ACTIVITIES_EVENT_VERSION,
    actorUserId: submission.submitterUserId,
    teamId: submission.teamId,
    seasonId: submission.seasonId,
    correlationId: null,
    causationId: null,
    payload: {
      submissionId: submission.id,
      membershipId: submission.membershipId,
      activityTypeId: submission.activityTypeId,
      status: submission.status,
    },
  };
}

// --- Review / moderation (401) -----------------------------------------------

const DECISION_EVENT: ReadonlyMap<ReviewDecision, string> = new Map([
  [ReviewDecision.Approve, ACTIVITY_APPROVED_EVENT],
  [ReviewDecision.Reject, ACTIVITY_REJECTED_EVENT],
  [ReviewDecision.RequestChanges, ACTIVITY_CHANGES_REQUESTED_EVENT],
]);

export function buildReviewClaim(
  submissionId: string,
  teamId: string,
  expectedRecordVersion: number,
  reviewerUserId: string,
  now: Date,
): ReviewClaimChange {
  return {
    id: submissionId,
    teamId,
    expectedRecordVersion,
    reviewerUserId,
    now,
  };
}

export function buildReviewDecisionChange(
  submissionId: string,
  teamId: string,
  expectedRecordVersion: number,
  toStatus: SubmissionStatus,
  reviewNote: string | null,
  reviewerUserId: string,
  now: Date,
): ReviewDecisionChange {
  return {
    id: submissionId,
    teamId,
    expectedRecordVersion,
    toStatus,
    reviewNote,
    reviewerUserId,
    now,
  };
}

export function buildReviewReversalChange(
  submissionId: string,
  teamId: string,
  expectedRecordVersion: number,
  reversalReason: string,
  actorUserId: string,
  now: Date,
): ReviewReversalChange {
  return {
    id: submissionId,
    teamId,
    expectedRecordVersion,
    reversalReason,
    actorUserId,
    now,
  };
}

/** The outbox event type a moderation decision publishes. */
export function resolveReviewDecisionEvent(decision: ReviewDecision): string {
  const eventType = DECISION_EVENT.get(decision);
  if (eventType === undefined) {
    throw new Error(`Unrecognized review decision: ${decision}`);
  }
  return eventType;
}

/**
 * A moderation-outcome event (approved / rejected / changes-requested / corrected).
 * Carries only privacy-safe scalars — never the member's notes, the reviewer note,
 * or the reversal reason. The reviewing actor is passed explicitly.
 */
export function buildReviewOutcomeEvent(
  submission: ActivitySubmission,
  eventType: string,
  actorUserId: string,
): DomainEventInput {
  return {
    aggregateType: SUBMISSION_AGGREGATE,
    aggregateId: submission.id,
    eventType,
    eventVersion: ACTIVITIES_EVENT_VERSION,
    actorUserId,
    teamId: submission.teamId,
    seasonId: submission.seasonId,
    correlationId: null,
    causationId: null,
    payload: {
      submissionId: submission.id,
      membershipId: submission.membershipId,
      activityTypeId: submission.activityTypeId,
      status: submission.status,
      performedOn: submission.performedOn,
    },
  };
}

/** The corrected (reversal) event for an approved claim that was compensated. */
export function buildActivityCorrectedEvent(
  submission: ActivitySubmission,
  actorUserId: string,
): DomainEventInput {
  return buildReviewOutcomeEvent(
    submission,
    ACTIVITY_CORRECTED_EVENT,
    actorUserId,
  );
}

/** Assemble the pure anti-abuse facts for a submission from its probe counts. */
export function buildAbuseFacts(
  submission: ActivitySubmission,
  today: string,
  counts: AbuseCounts,
): AbuseSignalFacts {
  return {
    performedOn: submission.performedOn,
    today,
    durationMinutes: submission.durationMinutes,
    sameDayLiveCount: counts.sameDay,
    windowLiveCount: counts.windowCount,
    maxBuddyRepeatCount: counts.buddyRepeat,
  };
}
