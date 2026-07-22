import type { AuditInput, DomainEventInput } from '@modules/platform';
import { AuditOutcome } from '@modules/platform';

import {
  isArchiveTarget,
  isPublishTarget,
  isReviewTarget,
} from '../domain/clip.state-machine';
import {
  ANALYSIS_AGGREGATE,
  ANALYSIS_EVENT_VERSION,
  VIDEO_ACCESS_GRANTED_ACTION,
  VIDEO_CLIP_ACKNOWLEDGED_ACTION,
  VIDEO_CLIP_PUBLISHED_EVENT,
  VIDEO_CLIP_RESOURCE_TYPE,
  VIDEO_CLIP_REVISED_EVENT,
  VIDEO_SOURCE_REGISTERED_ACTION,
  VIDEO_SOURCE_RESOURCE_TYPE,
} from '../model/analysis.constants';
import type { ClipStatus } from '../model/analysis.enums';
import type {
  ClipImportReport,
  ClipStatusChange,
  NewVideoClip,
  NewVideoSource,
  VideoClip,
  VideoClipContent,
  VideoSource,
  VideoSourceContent,
} from '../model/analysis.types';

// --- Row builders ------------------------------------------------------------

export function buildNewVideoSource(
  id: string,
  teamId: string,
  seasonId: string,
  content: VideoSourceContent,
  actorUserId: string,
  now: Date,
): NewVideoSource {
  return {
    id,
    teamId,
    seasonId,
    matchId: content.matchId,
    provider: content.provider,
    externalRef: content.externalRef,
    title: content.title,
    durationSeconds: content.durationSeconds,
    syncOffsetSeconds: content.syncOffsetSeconds,
    processingStatus: content.processingStatus,
    accessPolicy: content.accessPolicy,
    registeredBy: actorUserId,
    now,
  };
}

/** A brand-new clip: revision 1, superseding nothing, authored by the actor. */
export function buildNewVideoClip(
  id: string,
  source: VideoSource,
  content: VideoClipContent,
  actorUserId: string,
  now: Date,
): NewVideoClip {
  return {
    id,
    teamId: source.teamId,
    seasonId: source.seasonId,
    sourceId: source.sourceId,
    matchId: source.matchId,
    pointId: content.pointId,
    eventId: content.eventId,
    startSecond: content.startSecond,
    endSecond: content.endSecond,
    playContext: content.playContext,
    clipType: content.clipType,
    title: content.title,
    comment: content.comment,
    visibility: content.visibility,
    revision: 1,
    supersedesClipId: null,
    importReference: null,
    authorUserId: actorUserId,
    now,
  };
}

/**
 * The successor clip of a revision. It inherits the superseded clip's scope,
 * carries the next revision number, and points back at what it replaced — the
 * superseded row is never edited.
 */
export function buildSuccessorClip(
  id: string,
  superseded: VideoClip,
  content: VideoClipContent,
  actorUserId: string,
  now: Date,
): NewVideoClip {
  return {
    id,
    teamId: superseded.teamId,
    seasonId: superseded.seasonId,
    sourceId: superseded.sourceId,
    matchId: superseded.matchId,
    pointId: content.pointId,
    eventId: content.eventId,
    startSecond: content.startSecond,
    endSecond: content.endSecond,
    playContext: content.playContext,
    clipType: content.clipType,
    title: content.title,
    comment: content.comment,
    visibility: content.visibility,
    revision: superseded.revision + 1,
    supersedesClipId: superseded.clipId,
    importReference: null,
    authorUserId: actorUserId,
    now,
  };
}

/** An imported clip, carrying the audited source reference for idempotency. */
export function buildImportedClip(
  id: string,
  source: VideoSource,
  content: VideoClipContent,
  reference: string,
  actorUserId: string,
  now: Date,
): NewVideoClip {
  return {
    ...buildNewVideoClip(id, source, content, actorUserId, now),
    importReference: reference,
  };
}

/** The optimistic-version-guarded status change, stamping only what it owns. */
export function buildClipStatusChange(
  clip: VideoClip,
  target: ClipStatus,
  actorUserId: string,
  expectedRecordVersion: number,
  now: Date,
): ClipStatusChange {
  const reviewing = isReviewTarget(target);
  const publishing = isPublishTarget(target);
  return {
    id: clip.clipId,
    teamId: clip.teamId,
    expectedRecordVersion,
    toStatus: target,
    reviewedBy: reviewing ? actorUserId : clip.reviewedBy,
    reviewedAt: reviewing ? now : clip.reviewedAt,
    publishedBy: publishing ? actorUserId : clip.publishedBy,
    publishedAt: publishing ? now : clip.publishedAt,
    archivedAt: isArchiveTarget(target) ? now : clip.archivedAt,
    now,
  };
}

// --- Audit -------------------------------------------------------------------

export function buildSourceAudit(
  action: string,
  actorUserId: string,
  source: VideoSource,
): AuditInput {
  return {
    actorUserId,
    action,
    resourceType: VIDEO_SOURCE_RESOURCE_TYPE,
    resourceId: source.sourceId,
    teamId: source.teamId,
    seasonId: source.seasonId,
    correlationId: null,
    outcome: AuditOutcome.Success,
    diff: {
      provider: source.provider,
      processingStatus: source.processingStatus,
      accessPolicy: source.accessPolicy,
      matchId: source.matchId,
    },
  };
}

export function buildSourceRegisteredAudit(
  actorUserId: string,
  source: VideoSource,
): AuditInput {
  return buildSourceAudit(VIDEO_SOURCE_REGISTERED_ACTION, actorUserId, source);
}

export function buildAccessGrantedAudit(
  actorUserId: string,
  source: VideoSource,
): AuditInput {
  return buildSourceAudit(VIDEO_ACCESS_GRANTED_ACTION, actorUserId, source);
}

/** Audit a clip change. Never carries the note body, only classifications. */
export function buildClipAudit(
  action: string,
  actorUserId: string,
  clip: VideoClip,
): AuditInput {
  return {
    actorUserId,
    action,
    resourceType: VIDEO_CLIP_RESOURCE_TYPE,
    resourceId: clip.clipId,
    teamId: clip.teamId,
    seasonId: clip.seasonId,
    correlationId: null,
    outcome: AuditOutcome.Success,
    diff: {
      sourceId: clip.sourceId,
      clipType: clip.clipType,
      status: clip.status,
      visibility: clip.visibility,
      revision: clip.revision,
    },
  };
}

export function buildAcknowledgementAudit(
  actorUserId: string,
  clip: VideoClip,
  membershipId: string,
): AuditInput {
  return {
    actorUserId,
    action: VIDEO_CLIP_ACKNOWLEDGED_ACTION,
    resourceType: VIDEO_CLIP_RESOURCE_TYPE,
    resourceId: clip.clipId,
    teamId: clip.teamId,
    seasonId: clip.seasonId,
    correlationId: null,
    outcome: AuditOutcome.Success,
    diff: { membershipId, revision: clip.revision },
  };
}

/** Audit an import run with reconciliation totals only — never a row payload. */
export function buildImportAudit(
  action: string,
  actorUserId: string,
  teamId: string,
  seasonId: string,
  report: ClipImportReport,
): AuditInput {
  return {
    actorUserId,
    action,
    resourceType: VIDEO_CLIP_RESOURCE_TYPE,
    resourceId: null,
    teamId,
    seasonId,
    correlationId: null,
    outcome: AuditOutcome.Success,
    diff: {
      dryRun: report.dryRun,
      received: report.received,
      imported: report.imported,
      skippedDuplicate: report.skippedDuplicate,
      rejectedTimestamp: report.rejectedTimestamp,
      rejectedAlias: report.rejectedAlias,
    },
  };
}

// --- Domain events -----------------------------------------------------------

export function buildClipPublishedEvent(
  clip: VideoClip,
  actorUserId: string,
  audienceCount: number,
): DomainEventInput {
  return {
    ...clipEvent(VIDEO_CLIP_PUBLISHED_EVENT, clip, actorUserId),
    payload: {
      sourceId: clip.sourceId,
      clipType: clip.clipType,
      visibility: clip.visibility,
      revision: clip.revision,
      audienceCount,
    },
  };
}

export function buildClipRevisedEvent(
  superseded: VideoClip,
  successorClipId: string,
  actorUserId: string,
): DomainEventInput {
  return {
    ...clipEvent(VIDEO_CLIP_REVISED_EVENT, superseded, actorUserId),
    payload: {
      successorClipId,
      supersededRevision: superseded.revision,
      sourceId: superseded.sourceId,
    },
  };
}

function clipEvent(
  eventType: string,
  clip: VideoClip,
  actorUserId: string,
): Omit<DomainEventInput, 'payload'> {
  return {
    aggregateType: ANALYSIS_AGGREGATE,
    aggregateId: clip.clipId,
    eventType,
    eventVersion: ANALYSIS_EVENT_VERSION,
    actorUserId,
    teamId: clip.teamId,
    seasonId: clip.seasonId,
    correlationId: null,
    causationId: null,
  };
}
