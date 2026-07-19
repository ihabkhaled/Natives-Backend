import type { AuditInput, DomainEventInput } from '@modules/platform';
import { AuditOutcome } from '@modules/platform';

import {
  DEVELOPMENT_EVENT_VERSION,
  FEEDBACK_ACKNOWLEDGED_EVENT,
  FEEDBACK_AGGREGATE,
  FEEDBACK_CLARIFICATION_EVENT,
  FEEDBACK_PUBLISHED_EVENT,
  FEEDBACK_REMINDER_EVENT,
  FEEDBACK_RESOURCE_TYPE,
  FEEDBACK_REVISED_EVENT,
  FIRST_REVISION,
} from '../model/development.constants';
import { FeedbackStatus } from '../model/feedback.enums';
import type { FeedbackReminderRow } from '../model/feedback.rows';
import type {
  AcknowledgeFeedbackCommand,
  CoachFeedback,
  CreateFeedbackCommand,
  FeedbackAcknowledgement,
  FeedbackFields,
  FeedbackSupersede,
  FeedbackTransition,
  NewCoachFeedback,
  NewFeedbackAcknowledgement,
} from '../model/feedback.types';

/** Build the initial DRAFT revision (revision 1, its own family). */
export function buildNewFeedback(
  id: string,
  teamId: string,
  command: CreateFeedbackCommand,
  actorUserId: string,
  now: Date,
): NewCoachFeedback {
  return {
    id,
    familyId: id,
    teamId,
    seasonId: command.seasonId,
    membershipId: command.membershipId,
    authorUserId: actorUserId,
    status: FeedbackStatus.Draft,
    revision: FIRST_REVISION,
    fields: command.fields,
    submittedAt: null,
    submittedBy: null,
    publishedAt: null,
    publishedBy: null,
    createdBy: actorUserId,
    now,
  };
}

/** Build the superseding REVISED revision that corrects a published feedback. */
export function buildCorrectionFeedback(
  id: string,
  previous: CoachFeedback,
  fields: FeedbackFields,
  actorUserId: string,
  now: Date,
): NewCoachFeedback {
  return {
    id,
    familyId: previous.familyId,
    teamId: previous.teamId,
    seasonId: previous.seasonId,
    membershipId: previous.membershipId,
    authorUserId: previous.authorUserId,
    status: FeedbackStatus.Revised,
    revision: previous.revision + 1,
    fields,
    submittedAt: previous.submittedAt,
    submittedBy: previous.submittedBy,
    publishedAt: now,
    publishedBy: actorUserId,
    createdBy: actorUserId,
    now,
  };
}

export function buildSubmitTransition(
  id: string,
  teamId: string,
  expectedRecordVersion: number,
  actorUserId: string,
  now: Date,
): FeedbackTransition {
  return {
    id,
    teamId,
    toStatus: FeedbackStatus.InReview,
    expectedRecordVersion,
    submittedAt: now,
    submittedBy: actorUserId,
    publishedAt: null,
    publishedBy: null,
    now,
  };
}

export function buildReopenTransition(
  id: string,
  teamId: string,
  expectedRecordVersion: number,
  now: Date,
): FeedbackTransition {
  return {
    id,
    teamId,
    toStatus: FeedbackStatus.Draft,
    expectedRecordVersion,
    submittedAt: null,
    submittedBy: null,
    publishedAt: null,
    publishedBy: null,
    now,
  };
}

export function buildPublishTransition(
  id: string,
  teamId: string,
  expectedRecordVersion: number,
  actorUserId: string,
  now: Date,
): FeedbackTransition {
  return {
    id,
    teamId,
    toStatus: FeedbackStatus.Published,
    expectedRecordVersion,
    submittedAt: null,
    submittedBy: null,
    publishedAt: now,
    publishedBy: actorUserId,
    now,
  };
}

export function buildFeedbackSupersede(
  previousId: string,
  supersededById: string,
  now: Date,
): FeedbackSupersede {
  return { id: previousId, supersededById, now };
}

export function buildNewAcknowledgement(
  id: string,
  feedback: CoachFeedback,
  actorUserId: string,
  command: AcknowledgeFeedbackCommand,
  now: Date,
): NewFeedbackAcknowledgement {
  return {
    id,
    feedbackId: feedback.id,
    membershipId: feedback.membershipId,
    userId: actorUserId,
    clarificationRequested: command.clarificationRequested,
    clarificationNote: command.clarificationNote,
    now,
  };
}

export function buildFeedbackAudit(
  action: string,
  actorUserId: string,
  feedback: CoachFeedback,
): AuditInput {
  return {
    actorUserId,
    action,
    resourceType: FEEDBACK_RESOURCE_TYPE,
    resourceId: feedback.id,
    teamId: feedback.teamId,
    seasonId: feedback.seasonId,
    correlationId: null,
    outcome: AuditOutcome.Success,
    diff: {
      status: feedback.status,
      revision: feedback.revision,
      recordVersion: feedback.recordVersion,
    },
  };
}

/** Published/revised events carry only identifiers — never any free-text field. */
export function buildFeedbackPublishedEvent(
  feedback: CoachFeedback,
): DomainEventInput {
  return feedbackEvent(
    FEEDBACK_PUBLISHED_EVENT,
    feedback,
    feedback.publishedBy,
  );
}

export function buildFeedbackRevisedEvent(
  feedback: CoachFeedback,
  supersededId: string,
): DomainEventInput {
  return {
    ...feedbackEvent(FEEDBACK_REVISED_EVENT, feedback, feedback.publishedBy),
    payload: {
      feedbackId: feedback.id,
      familyId: feedback.familyId,
      membershipId: feedback.membershipId,
      revision: feedback.revision,
      supersededId,
    },
  };
}

export function buildFeedbackAcknowledgedEvent(
  feedback: CoachFeedback,
  acknowledgement: FeedbackAcknowledgement,
): DomainEventInput {
  const eventType = acknowledgement.clarificationRequested
    ? FEEDBACK_CLARIFICATION_EVENT
    : FEEDBACK_ACKNOWLEDGED_EVENT;
  return {
    ...feedbackEvent(eventType, feedback, acknowledgement.userId),
    payload: {
      feedbackId: feedback.id,
      familyId: feedback.familyId,
      membershipId: feedback.membershipId,
      revision: feedback.revision,
      clarificationRequested: acknowledgement.clarificationRequested,
    },
  };
}

export function buildFeedbackReminderEvent(
  row: FeedbackReminderRow,
): DomainEventInput {
  return {
    aggregateType: FEEDBACK_AGGREGATE,
    aggregateId: row.id,
    eventType: FEEDBACK_REMINDER_EVENT,
    eventVersion: DEVELOPMENT_EVENT_VERSION,
    actorUserId: null,
    teamId: row.team_id,
    seasonId: row.season_id,
    correlationId: null,
    causationId: null,
    payload: {
      feedbackId: row.id,
      membershipId: row.membership_id,
    },
  };
}

function feedbackEvent(
  eventType: string,
  feedback: CoachFeedback,
  actorUserId: string | null,
): DomainEventInput {
  return {
    aggregateType: FEEDBACK_AGGREGATE,
    aggregateId: feedback.id,
    eventType,
    eventVersion: DEVELOPMENT_EVENT_VERSION,
    actorUserId,
    teamId: feedback.teamId,
    seasonId: feedback.seasonId,
    correlationId: null,
    causationId: null,
    payload: {
      feedbackId: feedback.id,
      familyId: feedback.familyId,
      membershipId: feedback.membershipId,
      revision: feedback.revision,
    },
  };
}
