import type { AuditInput, DomainEventInput } from '@modules/platform';
import { AuditOutcome } from '@modules/platform';

import {
  isArchiveTarget,
  isLockTarget,
  isPublishTarget,
} from '../domain/squad.state-machine';
import {
  AVAILABILITY_DECLARED_ACTION,
  AVAILABILITY_RESOURCE_TYPE,
  SELECTION_RESOURCE_TYPE,
  SQUAD_AGGREGATE,
  SQUAD_CREATED_EVENT,
  SQUAD_LOCKED_EVENT,
  SQUAD_PUBLISHED_EVENT,
  SQUAD_RESOURCE_TYPE,
  SQUADS_EVENT_VERSION,
} from '../model/squads.constants';
import type {
  AvailabilitySource,
  AvailabilityStatus,
  SelectionEventType,
  SelectionRole,
  SquadStatus,
} from '../model/squads.enums';
import type {
  Availability,
  AvailabilityUpsert,
  NewSelectionEvent,
  NewSquad,
  SelectionOverride,
  SelectionRemoval,
  SelectionWrite,
  Squad,
  SquadContent,
  SquadStatusChange,
} from '../model/squads.types';

// --- Row builders ------------------------------------------------------------

export function buildNewSquad(
  id: string,
  teamId: string,
  content: SquadContent,
  policyVersion: string,
  actorUserId: string,
  now: Date,
): NewSquad {
  return { id, teamId, content, policyVersion, createdBy: actorUserId, now };
}

/**
 * Build the optimistic-version-guarded status change for a squad transition,
 * stamping the instant the target owns. Revising bumps the revision so a prior
 * published/locked squad version is preserved as history.
 */
export function buildSquadStatusChange(
  squad: Squad,
  teamId: string,
  target: SquadStatus,
  actorUserId: string,
  bumpRevision: boolean,
  expectedRecordVersion: number,
  now: Date,
): SquadStatusChange {
  const publishing = isPublishTarget(target);
  return {
    id: squad.squadId,
    teamId,
    expectedRecordVersion,
    toStatus: target,
    bumpRevision,
    publishedBy: publishing ? actorUserId : squad.publishedBy,
    publishedAt: publishing ? now : squad.publishedAt,
    lockedAt: isLockTarget(target) ? now : squad.lockedAt,
    archivedAt: isArchiveTarget(target) ? now : squad.archivedAt,
    now,
  };
}

export function buildSelectionWrite(
  id: string,
  squadId: string,
  teamId: string,
  membershipId: string,
  selectionRole: SelectionRole,
  reason: string | null,
  override: SelectionOverride | null,
  eligibilitySnapshot: string,
  actorUserId: string,
  now: Date,
): SelectionWrite {
  return {
    id,
    squadId,
    teamId,
    membershipId,
    selectionRole,
    reason,
    eligibilityOverridden: override !== null,
    overrideReason: override === null ? null : override.overrideReason,
    overriddenBy: override === null ? null : actorUserId,
    eligibilitySnapshot,
    selectedBy: actorUserId,
    now,
  };
}

export function buildSelectionRemoval(
  squadId: string,
  membershipId: string,
  actorUserId: string,
  reason: string | null,
  now: Date,
): SelectionRemoval {
  return { squadId, membershipId, removedBy: actorUserId, reason, now };
}

export function buildSelectionEvent(
  id: string,
  squadId: string,
  membershipId: string,
  eventType: SelectionEventType,
  selectionRole: SelectionRole | null,
  reason: string | null,
  eligibilitySnapshot: string,
  actorUserId: string,
  now: Date,
): NewSelectionEvent {
  return {
    id,
    squadId,
    membershipId,
    eventType,
    selectionRole,
    reason,
    eligibilitySnapshot,
    actorUserId,
    now,
  };
}

export function buildAvailabilityUpsert(
  id: string,
  squadId: string,
  teamId: string,
  membershipId: string,
  availability: AvailabilityStatus,
  reason: string | null,
  source: AvailabilitySource,
  actorUserId: string,
  now: Date,
): AvailabilityUpsert {
  return {
    id,
    squadId,
    teamId,
    membershipId,
    availability,
    reason,
    source,
    declaredBy: actorUserId,
    now,
  };
}

// --- Audit -------------------------------------------------------------------

export function buildSquadAudit(
  action: string,
  actorUserId: string,
  squad: Squad,
): AuditInput {
  return {
    actorUserId,
    action,
    resourceType: SQUAD_RESOURCE_TYPE,
    resourceId: squad.squadId,
    teamId: squad.teamId,
    seasonId: squad.seasonId,
    correlationId: null,
    outcome: AuditOutcome.Success,
    diff: {
      status: squad.status,
      revision: squad.revision,
      recordVersion: squad.recordVersion,
    },
  };
}

/**
 * Audit a selection change. The diff carries the eligibility snapshot and whether
 * an override was used — the immutable evidence that a flagged player was accepted
 * by a permitted human — and never any medical detail.
 */
export function buildSelectionAudit(
  action: string,
  actorUserId: string,
  squad: Squad,
  membershipId: string,
  eligibilitySnapshot: string,
  overridden: boolean,
): AuditInput {
  return {
    actorUserId,
    action,
    resourceType: SELECTION_RESOURCE_TYPE,
    resourceId: membershipId,
    teamId: squad.teamId,
    seasonId: squad.seasonId,
    correlationId: null,
    outcome: AuditOutcome.Success,
    diff: {
      squadId: squad.squadId,
      eligibilitySnapshot,
      overridden,
    },
  };
}

export function buildAvailabilityAudit(
  actorUserId: string,
  availability: Availability,
  seasonId: string,
): AuditInput {
  return {
    actorUserId,
    action: AVAILABILITY_DECLARED_ACTION,
    resourceType: AVAILABILITY_RESOURCE_TYPE,
    resourceId: availability.membershipId,
    teamId: availability.teamId,
    seasonId,
    correlationId: null,
    outcome: AuditOutcome.Success,
    diff: {
      squadId: availability.squadId,
      availability: availability.availability,
      source: availability.source,
    },
  };
}

// --- Domain events (past-tense, versioned, privacy-safe payloads) ------------

export function buildSquadCreatedEvent(
  squad: Squad,
  actorUserId: string,
): DomainEventInput {
  return squadEvent(SQUAD_CREATED_EVENT, squad, actorUserId, 0);
}

export function buildSquadPublishedEvent(
  squad: Squad,
  actorUserId: string,
  selectionCount: number,
): DomainEventInput {
  return squadEvent(SQUAD_PUBLISHED_EVENT, squad, actorUserId, selectionCount);
}

export function buildSquadLockedEvent(
  squad: Squad,
  actorUserId: string,
  selectionCount: number,
): DomainEventInput {
  return squadEvent(SQUAD_LOCKED_EVENT, squad, actorUserId, selectionCount);
}

function squadEvent(
  eventType: string,
  squad: Squad,
  actorUserId: string,
  selectionCount: number,
): DomainEventInput {
  return {
    aggregateType: SQUAD_AGGREGATE,
    aggregateId: squad.squadId,
    eventType,
    eventVersion: SQUADS_EVENT_VERSION,
    actorUserId,
    teamId: squad.teamId,
    seasonId: squad.seasonId,
    correlationId: null,
    causationId: null,
    payload: {
      competitionId: squad.competitionId,
      status: squad.status,
      revision: squad.revision,
      selectionCount,
    },
  };
}
