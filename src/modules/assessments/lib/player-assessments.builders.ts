import type { AuditInput, DomainEventInput } from '@modules/platform';
import { AuditOutcome } from '@modules/platform';

import { resolveReviewTarget } from '../domain/player-assessment.state-machine';
import {
  ASSESSMENT_PUBLISHED_EVENT,
  ASSESSMENT_REVISED_EVENT,
  ASSESSMENT_SUBMITTED_EVENT,
  FIRST_REVISION,
  PLAYER_ASSESSMENT_AGGREGATE,
  PLAYER_ASSESSMENT_EVENT_VERSION,
  PLAYER_ASSESSMENT_RESOURCE_TYPE,
} from '../model/player-assessments.constants';
import {
  PlayerAssessmentStatus,
  ReviewDecision,
} from '../model/player-assessments.enums';
import type {
  AssessmentSupersede,
  AssessmentTransition,
  AssessmentValueInput,
  CreatePlayerAssessmentCommand,
  NewPlayerAssessment,
  NewPlayerAssessmentValue,
  PlayerAssessment,
  PlayerAssessmentContext,
} from '../model/player-assessments.types';

/** Build the initial DRAFT revision (revision 1, its own family). */
export function buildNewAssessment(
  id: string,
  teamId: string,
  context: PlayerAssessmentContext,
  command: CreatePlayerAssessmentCommand,
  actorUserId: string,
  now: Date,
): NewPlayerAssessment {
  return {
    id,
    familyId: id,
    teamId,
    seasonId: context.seasonId,
    periodId: command.periodId,
    templateId: context.templateId,
    membershipId: command.membershipId,
    evaluatorUserId: actorUserId,
    status: PlayerAssessmentStatus.Draft,
    revision: FIRST_REVISION,
    summary: command.summary,
    reviewedBy: null,
    reviewedAt: null,
    publishedBy: null,
    publishedAt: null,
    createdBy: actorUserId,
    now,
  };
}

/** Build the superseding REVISED revision that corrects a published assessment. */
export function buildCorrectionAssessment(
  id: string,
  previous: PlayerAssessment,
  summary: string | null,
  actorUserId: string,
  now: Date,
): NewPlayerAssessment {
  return {
    id,
    familyId: previous.familyId,
    teamId: previous.teamId,
    seasonId: previous.seasonId,
    periodId: previous.periodId,
    templateId: previous.templateId,
    membershipId: previous.membershipId,
    evaluatorUserId: previous.evaluatorUserId,
    status: PlayerAssessmentStatus.Revised,
    revision: previous.revision + 1,
    summary,
    reviewedBy: previous.reviewedBy,
    reviewedAt: previous.reviewedAt,
    publishedBy: actorUserId,
    publishedAt: now,
    createdBy: actorUserId,
    now,
  };
}

/** Map value inputs onto insertable rows, one generated id per value. */
export function buildValueRows(
  assessmentId: string,
  values: readonly AssessmentValueInput[],
  generateId: () => string,
  now: Date,
): readonly NewPlayerAssessmentValue[] {
  return values.map(value => ({
    id: generateId(),
    assessmentId,
    metricDefinitionId: value.metricDefinitionId,
    numericValue: value.numericValue,
    textValue: value.textValue,
    note: value.note,
    confidence: value.confidence,
    observationCount: value.observationCount,
    now,
  }));
}

export function buildSubmitTransition(
  id: string,
  teamId: string,
  expectedRecordVersion: number,
  actorUserId: string,
  now: Date,
): AssessmentTransition {
  return {
    id,
    teamId,
    toStatus: PlayerAssessmentStatus.Submitted,
    expectedRecordVersion,
    submittedAt: now,
    submittedBy: actorUserId,
    reviewedAt: null,
    reviewedBy: null,
    publishedAt: null,
    publishedBy: null,
    now,
  };
}

export function buildReviewTransition(
  id: string,
  teamId: string,
  decision: ReviewDecision,
  expectedRecordVersion: number,
  actorUserId: string,
  now: Date,
): AssessmentTransition {
  const approving = decision === ReviewDecision.Approve;
  return {
    id,
    teamId,
    toStatus: resolveReviewTarget(decision),
    expectedRecordVersion,
    submittedAt: null,
    submittedBy: null,
    reviewedAt: approving ? now : null,
    reviewedBy: approving ? actorUserId : null,
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
): AssessmentTransition {
  return {
    id,
    teamId,
    toStatus: PlayerAssessmentStatus.Published,
    expectedRecordVersion,
    submittedAt: null,
    submittedBy: null,
    reviewedAt: null,
    reviewedBy: null,
    publishedAt: now,
    publishedBy: actorUserId,
    now,
  };
}

export function buildSupersede(
  previousId: string,
  supersededById: string,
  now: Date,
): AssessmentSupersede {
  return { id: previousId, supersededById, now };
}

export function buildSubmittedEvent(
  assessment: PlayerAssessment,
): DomainEventInput {
  return workflowEvent(ASSESSMENT_SUBMITTED_EVENT, assessment, null);
}

export function buildPublishedEvent(
  assessment: PlayerAssessment,
): DomainEventInput {
  return workflowEvent(ASSESSMENT_PUBLISHED_EVENT, assessment, null);
}

export function buildRevisedEvent(
  assessment: PlayerAssessment,
  supersededId: string,
): DomainEventInput {
  return workflowEvent(ASSESSMENT_REVISED_EVENT, assessment, supersededId);
}

export function buildAudit(
  action: string,
  actorUserId: string,
  assessment: PlayerAssessment,
): AuditInput {
  return {
    actorUserId,
    action,
    resourceType: PLAYER_ASSESSMENT_RESOURCE_TYPE,
    resourceId: assessment.id,
    teamId: assessment.teamId,
    seasonId: assessment.seasonId,
    correlationId: null,
    outcome: AuditOutcome.Success,
    diff: {
      status: assessment.status,
      revision: assessment.revision,
      recordVersion: assessment.recordVersion,
    },
  };
}

function workflowEvent(
  eventType: string,
  assessment: PlayerAssessment,
  supersededId: string | null,
): DomainEventInput {
  return {
    aggregateType: PLAYER_ASSESSMENT_AGGREGATE,
    aggregateId: assessment.id,
    eventType,
    eventVersion: PLAYER_ASSESSMENT_EVENT_VERSION,
    actorUserId: assessment.publishedBy ?? assessment.submittedBy,
    teamId: assessment.teamId,
    seasonId: assessment.seasonId,
    correlationId: null,
    causationId: null,
    payload: {
      assessmentId: assessment.id,
      familyId: assessment.familyId,
      membershipId: assessment.membershipId,
      periodId: assessment.periodId,
      templateId: assessment.templateId,
      revision: assessment.revision,
      supersededId,
    },
  };
}
