import type { AuditInput, DomainEventInput } from '@modules/platform';
import { AuditOutcome } from '@modules/platform';

import {
  isActivateTarget,
  isArchiveTarget,
  isCancelTarget as isCompetitionCancelTarget,
  isCompleteTarget,
  isPublishTarget,
} from '../domain/competition.state-machine';
import {
  isFinalizeTarget,
  isFixtureCancelTarget,
} from '../domain/fixture.state-machine';
import {
  COMPETITION_AGGREGATE,
  COMPETITION_CANCELLED_EVENT,
  COMPETITION_CREATED_EVENT,
  COMPETITION_PUBLISHED_EVENT,
  COMPETITION_RESOURCE_TYPE,
  COMPETITIONS_EVENT_VERSION,
  FIXTURE_AGGREGATE,
  FIXTURE_CANCELLED_EVENT,
  FIXTURE_RESCHEDULED_EVENT,
  FIXTURE_RESOURCE_TYPE,
  FIXTURE_SCHEDULED_EVENT,
  OPPONENT_CREATED_ACTION,
  OPPONENT_RESOURCE_TYPE,
  ROUND_CREATED_ACTION,
  ROUND_RESOURCE_TYPE,
  STAGE_CREATED_ACTION,
  STAGE_RESOURCE_TYPE,
} from '../model/competitions.constants';
import type {
  CompetitionStatus,
  FixtureStatus,
  StageFormat,
} from '../model/competitions.enums';
import type {
  Competition,
  CompetitionContent,
  CompetitionStatusChange,
  Fixture,
  FixtureContent,
  FixtureReschedule,
  FixtureStatusChange,
  NewCompetition,
  NewFixture,
  NewOpponent,
  NewRound,
  NewStage,
  Opponent,
  OpponentContent,
  Round,
  Stage,
} from '../model/competitions.types';

// --- Row builders ------------------------------------------------------------

export function buildNewCompetition(
  id: string,
  teamId: string,
  content: CompetitionContent,
  actorUserId: string,
  now: Date,
): NewCompetition {
  return { id, teamId, content, createdBy: actorUserId, now };
}

/**
 * Build the optimistic-version-guarded status change for a competition
 * transition, stamping the instant the target owns and, for a cancellation, the
 * required reason. The prior publication trail is preserved on other transitions.
 */
export function buildCompetitionStatusChange(
  competition: Competition,
  teamId: string,
  target: CompetitionStatus,
  actorUserId: string,
  reason: string | null,
  expectedRecordVersion: number,
  now: Date,
): CompetitionStatusChange {
  const publishing = isPublishTarget(target);
  const cancelling = isCompetitionCancelTarget(target);
  return {
    id: competition.competitionId,
    teamId,
    expectedRecordVersion,
    toStatus: target,
    publishedBy: publishing ? actorUserId : competition.publishedBy,
    publishedAt: publishing ? now : competition.publishedAt,
    activatedAt: isActivateTarget(target) ? now : competition.activatedAt,
    completedAt: isCompleteTarget(target) ? now : competition.completedAt,
    cancelledAt: cancelling ? now : competition.cancelledAt,
    archivedAt: isArchiveTarget(target) ? now : competition.archivedAt,
    cancellationReason: cancelling ? reason : competition.cancellationReason,
    now,
  };
}

export function buildNewStage(
  id: string,
  competitionId: string,
  name: string,
  stageFormat: StageFormat,
  ordinal: number,
  now: Date,
): NewStage {
  return { id, competitionId, name, stageFormat, ordinal, now };
}

export function buildNewRound(
  id: string,
  stageId: string,
  competitionId: string,
  name: string,
  ordinal: number,
  now: Date,
): NewRound {
  return { id, stageId, competitionId, name, ordinal, now };
}

export function buildNewOpponent(
  id: string,
  teamId: string,
  content: OpponentContent,
  actorUserId: string,
  now: Date,
): NewOpponent {
  return { id, teamId, content, createdBy: actorUserId, now };
}

export function buildNewFixture(
  id: string,
  competitionId: string,
  teamId: string,
  seasonId: string,
  content: FixtureContent,
  scheduledAt: Date,
  actorUserId: string,
  now: Date,
): NewFixture {
  return {
    id,
    competitionId,
    teamId,
    seasonId,
    content,
    scheduledAt,
    createdBy: actorUserId,
    now,
  };
}

export function buildFixtureReschedule(
  fixture: Fixture,
  teamId: string,
  newScheduledAt: Date,
  venueId: string | null,
  reason: string | null,
  expectedRecordVersion: number,
  now: Date,
): FixtureReschedule {
  return {
    id: fixture.fixtureId,
    teamId,
    expectedRecordVersion,
    newScheduledAt,
    previousScheduledAt: fixture.scheduledAt,
    venueId: venueId ?? fixture.venueId,
    reason,
    now,
  };
}

/**
 * Build the optimistic-version-guarded status change for a fixture transition,
 * stamping the settled instant for final/abandoned and the cancellation reason for
 * a cancel. A cancelled fixture is kept for history — never deleted.
 */
export function buildFixtureStatusChange(
  fixture: Fixture,
  teamId: string,
  target: FixtureStatus,
  reason: string | null,
  expectedRecordVersion: number,
  now: Date,
): FixtureStatusChange {
  const cancelling = isFixtureCancelTarget(target);
  return {
    id: fixture.fixtureId,
    teamId,
    expectedRecordVersion,
    toStatus: target,
    finalizedAt: isFinalizeTarget(target) ? now : fixture.finalizedAt,
    cancelledAt: cancelling ? now : fixture.cancelledAt,
    cancellationReason: cancelling ? reason : fixture.cancellationReason,
    now,
  };
}

// --- Audit -------------------------------------------------------------------

export function buildCompetitionAudit(
  action: string,
  actorUserId: string,
  competition: Competition,
): AuditInput {
  return {
    actorUserId,
    action,
    resourceType: COMPETITION_RESOURCE_TYPE,
    resourceId: competition.competitionId,
    teamId: competition.teamId,
    seasonId: competition.seasonId,
    correlationId: null,
    outcome: AuditOutcome.Success,
    diff: {
      status: competition.status,
      competitionType: competition.competitionType,
      recordVersion: competition.recordVersion,
    },
  };
}

export function buildStageAudit(
  actorUserId: string,
  stage: Stage,
  teamId: string,
): AuditInput {
  return {
    actorUserId,
    action: STAGE_CREATED_ACTION,
    resourceType: STAGE_RESOURCE_TYPE,
    resourceId: stage.stageId,
    teamId,
    seasonId: null,
    correlationId: null,
    outcome: AuditOutcome.Success,
    diff: {
      competitionId: stage.competitionId,
      ordinal: stage.ordinal,
      stageFormat: stage.stageFormat,
    },
  };
}

export function buildRoundAudit(
  actorUserId: string,
  round: Round,
  teamId: string,
): AuditInput {
  return {
    actorUserId,
    action: ROUND_CREATED_ACTION,
    resourceType: ROUND_RESOURCE_TYPE,
    resourceId: round.roundId,
    teamId,
    seasonId: null,
    correlationId: null,
    outcome: AuditOutcome.Success,
    diff: {
      competitionId: round.competitionId,
      stageId: round.stageId,
      ordinal: round.ordinal,
    },
  };
}

export function buildOpponentAudit(
  actorUserId: string,
  opponent: Opponent,
): AuditInput {
  return {
    actorUserId,
    action: OPPONENT_CREATED_ACTION,
    resourceType: OPPONENT_RESOURCE_TYPE,
    resourceId: opponent.opponentId,
    teamId: opponent.teamId,
    seasonId: null,
    correlationId: null,
    outcome: AuditOutcome.Success,
    diff: {
      status: opponent.status,
      recordVersion: opponent.recordVersion,
    },
  };
}

export function buildFixtureAudit(
  action: string,
  actorUserId: string,
  fixture: Fixture,
): AuditInput {
  return {
    actorUserId,
    action,
    resourceType: FIXTURE_RESOURCE_TYPE,
    resourceId: fixture.fixtureId,
    teamId: fixture.teamId,
    seasonId: fixture.seasonId,
    correlationId: null,
    outcome: AuditOutcome.Success,
    diff: {
      status: fixture.status,
      competitionId: fixture.competitionId,
      opponentId: fixture.opponentId,
      recordVersion: fixture.recordVersion,
    },
  };
}

// --- Domain events (privacy-safe scalar payloads) ----------------------------

export function buildCompetitionCreatedEvent(
  competition: Competition,
  actorUserId: string,
): DomainEventInput {
  return competitionEvent(COMPETITION_CREATED_EVENT, competition, actorUserId);
}

export function buildCompetitionPublishedEvent(
  competition: Competition,
  actorUserId: string,
): DomainEventInput {
  return competitionEvent(
    COMPETITION_PUBLISHED_EVENT,
    competition,
    actorUserId,
  );
}

export function buildCompetitionCancelledEvent(
  competition: Competition,
  actorUserId: string,
): DomainEventInput {
  return competitionEvent(
    COMPETITION_CANCELLED_EVENT,
    competition,
    actorUserId,
  );
}

export function buildFixtureScheduledEvent(
  fixture: Fixture,
  actorUserId: string,
): DomainEventInput {
  return fixtureEvent(FIXTURE_SCHEDULED_EVENT, fixture, actorUserId, null);
}

export function buildFixtureRescheduledEvent(
  fixture: Fixture,
  actorUserId: string,
): DomainEventInput {
  return fixtureEvent(
    FIXTURE_RESCHEDULED_EVENT,
    fixture,
    actorUserId,
    fixture.previousScheduledAt,
  );
}

export function buildFixtureCancelledEvent(
  fixture: Fixture,
  actorUserId: string,
): DomainEventInput {
  return fixtureEvent(FIXTURE_CANCELLED_EVENT, fixture, actorUserId, null);
}

function competitionEvent(
  eventType: string,
  competition: Competition,
  actorUserId: string,
): DomainEventInput {
  return {
    aggregateType: COMPETITION_AGGREGATE,
    aggregateId: competition.competitionId,
    eventType,
    eventVersion: COMPETITIONS_EVENT_VERSION,
    actorUserId,
    teamId: competition.teamId,
    seasonId: competition.seasonId,
    correlationId: null,
    causationId: null,
    payload: {
      competitionType: competition.competitionType,
      status: competition.status,
    },
  };
}

function fixtureEvent(
  eventType: string,
  fixture: Fixture,
  actorUserId: string,
  previousScheduledAt: Date | null,
): DomainEventInput {
  return {
    aggregateType: FIXTURE_AGGREGATE,
    aggregateId: fixture.fixtureId,
    eventType,
    eventVersion: COMPETITIONS_EVENT_VERSION,
    actorUserId,
    teamId: fixture.teamId,
    seasonId: fixture.seasonId,
    correlationId: null,
    causationId: null,
    payload: {
      competitionId: fixture.competitionId,
      status: fixture.status,
      scheduledAt: fixture.scheduledAt.toISOString(),
      previousScheduledAt:
        previousScheduledAt === null ? null : previousScheduledAt.toISOString(),
    },
  };
}
