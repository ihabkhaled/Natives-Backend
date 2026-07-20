import type { AuditInput, DomainEventInput } from '@modules/platform';
import { AuditOutcome } from '@modules/platform';

import {
  isArchiveTarget,
  isLockTarget,
  isPublishTarget,
  isReviseTarget,
} from '../domain/roster.state-machine';
import { bucketGender } from '../domain/roster-composition.policy';
import {
  ROSTER_AGGREGATE,
  ROSTER_AVAILABILITY_DECLARED_ACTION,
  ROSTER_AVAILABILITY_RESOURCE_TYPE,
  ROSTER_CREATED_EVENT,
  ROSTER_ENTRY_RESOURCE_TYPE,
  ROSTER_LOCKED_EVENT,
  ROSTER_POLICY_VERSION,
  ROSTER_PUBLISHED_EVENT,
  ROSTER_RESOURCE_TYPE,
  ROSTER_REVISED_EVENT,
  ROSTER_SNAPSHOT_RESOURCE_TYPE,
  ROSTER_SNAPSHOT_TAKEN_ACTION,
  ROSTERS_EVENT_VERSION,
} from '../model/rosters.constants';
import type {
  RosterAvailabilitySource,
  RosterAvailabilityStatus,
  RosterKind,
  RosterStatus,
} from '../model/rosters.enums';
import {
  RosterEntryRole,
  RosterLine,
  RosterPosition,
} from '../model/rosters.enums';
import type {
  NewRoster,
  Roster,
  RosterAudiencePlan,
  RosterAvailabilityRecord,
  RosterAvailabilityUpsert,
  RosterCandidate,
  RosterConstraints,
  RosterEntryContent,
  RosterEntryRemoval,
  RosterEntryWrite,
  RosterOverride,
  RosterSnapshot,
  RosterSnapshotEntry,
  RosterStatusChange,
} from '../model/rosters.types';

// --- Row builders ------------------------------------------------------------

/** A brand-new competition roster: revision 1, superseding nothing. */
export function buildNewCompetitionRoster(
  id: string,
  teamId: string,
  seasonId: string,
  competitionId: string,
  squadId: string | null,
  name: string,
  constraints: RosterConstraints,
  selectionDeadline: string | null,
  notes: string | null,
  kind: RosterKind,
  revision: number,
  actorUserId: string,
  now: Date,
): NewRoster {
  return {
    id,
    teamId,
    seasonId,
    competitionId,
    fixtureId: null,
    squadId,
    sourceRosterId: null,
    supersedesRosterId: null,
    rosterKind: kind,
    name,
    division: constraints.division,
    minSize: constraints.minSize,
    maxSize: constraints.maxSize,
    minWomen: constraints.minWomen,
    requireCaptain: constraints.requireCaptain,
    policyVersion: ROSTER_POLICY_VERSION,
    selectionDeadline,
    notes,
    revision,
    createdBy: actorUserId,
    now,
  };
}

/** A per-fixture match roster, optionally copied from a competition roster. */
export function buildNewMatchRoster(
  id: string,
  teamId: string,
  seasonId: string,
  competitionId: string,
  fixtureId: string,
  sourceRosterId: string | null,
  name: string,
  constraints: RosterConstraints,
  notes: string | null,
  kind: RosterKind,
  revision: number,
  actorUserId: string,
  now: Date,
): NewRoster {
  return {
    id,
    teamId,
    seasonId,
    competitionId,
    fixtureId,
    squadId: null,
    sourceRosterId,
    supersedesRosterId: null,
    rosterKind: kind,
    name,
    division: constraints.division,
    minSize: constraints.minSize,
    maxSize: constraints.maxSize,
    minWomen: constraints.minWomen,
    requireCaptain: constraints.requireCaptain,
    policyVersion: ROSTER_POLICY_VERSION,
    selectionDeadline: null,
    notes,
    revision,
    createdBy: actorUserId,
    now,
  };
}

/**
 * The successor roster of a revision. It inherits the superseded roster's scope
 * and constraints, carries the next revision number, and points back at what it
 * replaced — the superseded row and its snapshot are never touched.
 */
export function buildSuccessorRoster(
  id: string,
  superseded: Roster,
  revision: number,
  actorUserId: string,
  now: Date,
): NewRoster {
  return {
    id,
    teamId: superseded.teamId,
    seasonId: superseded.seasonId,
    competitionId: superseded.competitionId,
    fixtureId: superseded.fixtureId,
    squadId: superseded.squadId,
    sourceRosterId: superseded.sourceRosterId,
    supersedesRosterId: superseded.rosterId,
    rosterKind: superseded.rosterKind,
    name: superseded.name,
    division: superseded.division,
    minSize: superseded.minSize,
    maxSize: superseded.maxSize,
    minWomen: superseded.minWomen,
    requireCaptain: superseded.requireCaptain,
    policyVersion: superseded.policyVersion,
    selectionDeadline:
      superseded.selectionDeadline === null
        ? null
        : superseded.selectionDeadline.toISOString(),
    notes: superseded.notes,
    revision,
    createdBy: actorUserId,
    now,
  };
}

/**
 * Build the optimistic-version-guarded status change, stamping only the instants
 * and actors the target owns and preserving every instant already recorded.
 */
export function buildRosterStatusChange(
  roster: Roster,
  teamId: string,
  target: RosterStatus,
  actorUserId: string,
  expectedRecordVersion: number,
  revisionReason: string | null,
  now: Date,
): RosterStatusChange {
  const publishing = isPublishTarget(target);
  const locking = isLockTarget(target);
  const revising = isReviseTarget(target);
  return {
    id: roster.rosterId,
    teamId,
    expectedRecordVersion,
    toStatus: target,
    publishedBy: publishing ? actorUserId : roster.publishedBy,
    publishedAt: publishing ? now : roster.publishedAt,
    lockedBy: locking ? actorUserId : roster.lockedBy,
    lockedAt: locking ? now : roster.lockedAt,
    revisedBy: revising ? actorUserId : roster.revisedBy,
    revisedAt: revising ? now : roster.revisedAt,
    revisionReason: revising ? revisionReason : roster.revisionReason,
    archivedAt: isArchiveTarget(target) ? now : roster.archivedAt,
    now,
  };
}

/** A roster entry written from an explicit coach selection. */
export function buildRosterEntryWrite(
  id: string,
  rosterId: string,
  teamId: string,
  content: RosterEntryContent,
  candidate: RosterCandidate,
  override: RosterOverride | null,
  overrideExercised: boolean,
  actorUserId: string,
  now: Date,
): RosterEntryWrite {
  return {
    id,
    rosterId,
    teamId,
    membershipId: content.membershipId,
    jerseyNumber: content.jerseyNumber ?? candidate.jerseyNumber,
    entryRole: content.entryRole,
    lineAssignment: content.lineAssignment,
    fieldPosition: content.fieldPosition,
    genderBucket: bucketGender(candidate.gender),
    availability: candidate.availability,
    selectionReason: content.selectionReason,
    constraintOverridden: overrideExercised,
    overrideReason: overrideExercised ? overrideReasonOf(override) : null,
    overriddenBy: overrideExercised ? actorUserId : null,
    selectedBy: actorUserId,
    now,
  };
}

/** A roster entry generated in bulk from a season squad selection. */
export function buildGeneratedEntryWrite(
  id: string,
  rosterId: string,
  teamId: string,
  candidate: RosterCandidate,
  actorUserId: string,
  now: Date,
): RosterEntryWrite {
  return {
    id,
    rosterId,
    teamId,
    membershipId: candidate.membershipId,
    jerseyNumber: candidate.jerseyNumber,
    entryRole: RosterEntryRole.Player,
    lineAssignment: RosterLine.Any,
    fieldPosition: RosterPosition.Unspecified,
    genderBucket: bucketGender(candidate.gender),
    availability: candidate.availability,
    selectionReason: null,
    constraintOverridden: false,
    overrideReason: null,
    overriddenBy: null,
    selectedBy: actorUserId,
    now,
  };
}

/**
 * A roster entry carried forward from a frozen snapshot into a successor
 * revision. The classification is copied verbatim from history so a revision
 * starts from exactly what was locked, never from a re-derived selection.
 */
export function buildCarriedEntryWrite(
  id: string,
  rosterId: string,
  teamId: string,
  entry: RosterSnapshotEntry,
  actorUserId: string,
  now: Date,
): RosterEntryWrite {
  return {
    id,
    rosterId,
    teamId,
    membershipId: entry.membershipId,
    jerseyNumber: entry.jerseyNumber,
    entryRole: entry.entryRole,
    lineAssignment: entry.lineAssignment,
    fieldPosition: entry.fieldPosition,
    genderBucket: entry.genderBucket,
    availability: entry.availability,
    selectionReason: null,
    constraintOverridden: entry.constraintOverridden,
    overrideReason: null,
    overriddenBy: null,
    selectedBy: actorUserId,
    now,
  };
}

export function buildEntryRemoval(
  rosterId: string,
  membershipId: string,
  actorUserId: string,
  reason: string | null,
  now: Date,
): RosterEntryRemoval {
  return { rosterId, membershipId, removedBy: actorUserId, reason, now };
}

export function buildAvailabilityUpsert(
  id: string,
  rosterId: string,
  teamId: string,
  membershipId: string,
  availability: RosterAvailabilityStatus,
  reason: string | null,
  source: RosterAvailabilitySource,
  actorUserId: string,
  now: Date,
): RosterAvailabilityUpsert {
  return {
    id,
    rosterId,
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

export function buildRosterAudit(
  action: string,
  actorUserId: string,
  roster: Roster,
): AuditInput {
  return {
    actorUserId,
    action,
    resourceType: ROSTER_RESOURCE_TYPE,
    resourceId: roster.rosterId,
    teamId: roster.teamId,
    seasonId: roster.seasonId,
    correlationId: null,
    outcome: AuditOutcome.Success,
    diff: {
      rosterKind: roster.rosterKind,
      status: roster.status,
      revision: roster.revision,
      recordVersion: roster.recordVersion,
    },
  };
}

/**
 * Audit an entry change. The diff carries the accepted flag codes and whether an
 * override was exercised — the immutable evidence that a permitted human accepted
 * a flagged player — and never any medical detail or excuse note.
 */
export function buildEntryAudit(
  action: string,
  actorUserId: string,
  roster: Roster,
  membershipId: string,
  flagSummary: string,
  overridden: boolean,
): AuditInput {
  return {
    actorUserId,
    action,
    resourceType: ROSTER_ENTRY_RESOURCE_TYPE,
    resourceId: membershipId,
    teamId: roster.teamId,
    seasonId: roster.seasonId,
    correlationId: null,
    outcome: AuditOutcome.Success,
    diff: { rosterId: roster.rosterId, flags: flagSummary, overridden },
  };
}

export function buildAvailabilityAudit(
  actorUserId: string,
  record: RosterAvailabilityRecord,
  seasonId: string,
): AuditInput {
  return {
    actorUserId,
    action: ROSTER_AVAILABILITY_DECLARED_ACTION,
    resourceType: ROSTER_AVAILABILITY_RESOURCE_TYPE,
    resourceId: record.membershipId,
    teamId: record.teamId,
    seasonId,
    correlationId: null,
    outcome: AuditOutcome.Success,
    diff: {
      rosterId: record.rosterId,
      availability: record.availability,
      source: record.source,
    },
  };
}

export function buildSnapshotAudit(
  actorUserId: string,
  snapshot: RosterSnapshot,
): AuditInput {
  return {
    actorUserId,
    action: ROSTER_SNAPSHOT_TAKEN_ACTION,
    resourceType: ROSTER_SNAPSHOT_RESOURCE_TYPE,
    resourceId: snapshot.snapshotId,
    teamId: snapshot.teamId,
    seasonId: snapshot.seasonId,
    correlationId: null,
    outcome: AuditOutcome.Success,
    diff: {
      rosterId: snapshot.rosterId,
      revision: snapshot.revision,
      reason: snapshot.reason,
      entryCount: snapshot.entryCount,
      checksum: snapshot.checksum,
    },
  };
}

// --- Domain events (past-tense, versioned, privacy-safe payloads) ------------

export function buildRosterCreatedEvent(
  roster: Roster,
  actorUserId: string,
  entryCount: number,
): DomainEventInput {
  return {
    ...rosterEvent(ROSTER_CREATED_EVENT, roster, actorUserId),
    payload: { ...scopePayload(roster), entryCount },
  };
}

/**
 * `roster.published` is the notify signal. Its payload carries the privacy-aware
 * audience decision and the two counts, never a list of who was left out.
 */
export function buildRosterPublishedEvent(
  roster: Roster,
  actorUserId: string,
  plan: RosterAudiencePlan,
  snapshotId: string,
): DomainEventInput {
  return {
    ...rosterEvent(ROSTER_PUBLISHED_EVENT, roster, actorUserId),
    payload: {
      ...scopePayload(roster),
      snapshotId,
      audience: plan.audience,
      selectedCount: plan.selectedCount,
      notSelectedCount: plan.notSelectedCount,
    },
  };
}

export function buildRosterLockedEvent(
  roster: Roster,
  actorUserId: string,
  snapshotId: string,
  entryCount: number,
): DomainEventInput {
  return {
    ...rosterEvent(ROSTER_LOCKED_EVENT, roster, actorUserId),
    payload: { ...scopePayload(roster), snapshotId, entryCount },
  };
}

export function buildRosterRevisedEvent(
  superseded: Roster,
  successorRosterId: string,
  actorUserId: string,
  snapshotId: string,
): DomainEventInput {
  return {
    ...rosterEvent(ROSTER_REVISED_EVENT, superseded, actorUserId),
    payload: {
      ...scopePayload(superseded),
      snapshotId,
      successorRosterId,
      supersededRevision: superseded.revision,
    },
  };
}

function rosterEvent(
  eventType: string,
  roster: Roster,
  actorUserId: string,
): Omit<DomainEventInput, 'payload'> {
  return {
    aggregateType: ROSTER_AGGREGATE,
    aggregateId: roster.rosterId,
    eventType,
    eventVersion: ROSTERS_EVENT_VERSION,
    actorUserId,
    teamId: roster.teamId,
    seasonId: roster.seasonId,
    correlationId: null,
    causationId: null,
  };
}

function scopePayload(roster: Roster): Record<string, string | number | null> {
  return {
    rosterKind: roster.rosterKind,
    competitionId: roster.competitionId,
    fixtureId: roster.fixtureId,
    revision: roster.revision,
  };
}

function overrideReasonOf(override: RosterOverride | null): string | null {
  return override === null ? null : override.overrideReason;
}
