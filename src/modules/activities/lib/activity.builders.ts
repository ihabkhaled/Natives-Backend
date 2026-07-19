import type { AuditInput, DomainEventInput } from '@modules/platform';
import { AuditOutcome } from '@modules/platform';

import {
  ACTIVITIES_EVENT_VERSION,
  ACTIVITY_SUBMITTED_EVENT,
  ACTIVITY_WITHDRAWN_EVENT,
  BUDDY_RESOURCE_TYPE,
  SUBMISSION_AGGREGATE,
  SUBMISSION_RESOURCE_TYPE,
} from '../model/activities.constants';
import type { BuddyStatus, SubmissionStatus } from '../model/activity.enums';
import { SubmissionStatus as Status } from '../model/activity.enums';
import type {
  ActivityBuddy,
  ActivitySubmission,
  BuddyResponseUpdate,
  CreateSubmissionCommand,
  EvidenceItem,
  NewActivityBuddy,
  NewActivityEvidence,
  NewActivitySubmission,
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
