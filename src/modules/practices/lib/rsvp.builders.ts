import {
  type AuditInput,
  AuditOutcome,
  type DomainEventInput,
} from '@modules/platform';

import {
  RSVP_AGGREGATE_TYPE,
  RSVP_EVENT_VERSION,
  RSVP_OVERRIDDEN_ACTION,
  RSVP_PROMOTED_ACTION,
  RSVP_PROMOTED_EVENT,
  RSVP_RECIPIENT_KEY,
  RSVP_RECORDED_ACTION,
  RSVP_RECORDED_EVENT,
  RSVP_RESOURCE_TYPE,
} from '../model/rsvp.constants';
import { RsvpSource } from '../model/rsvp.enums';
import type {
  NewRsvp,
  NewRsvpRevision,
  PracticeRsvp,
  RsvpUpdate,
  RsvpWriteContext,
} from '../model/rsvp.types';

/**
 * Pure builders that turn an RSVP write context (or a resulting row) into the
 * persistence, audit, and outbox-event payloads. Kept free of injected ports so
 * they stay trivially unit-testable and reusable by both write use cases. Audit
 * diffs and event payloads carry only non-sensitive scalars — never the free-text
 * note or the reason category — so redaction and privacy are total by construction.
 */

/** Build the insert row for a first-time response. */
export function buildNewRsvp(
  id: string,
  ctx: RsvpWriteContext,
  waitlisted: boolean,
): NewRsvp {
  return {
    id,
    sessionId: ctx.session.id,
    teamId: ctx.session.teamId,
    seasonId: ctx.session.seasonId,
    membershipId: ctx.membershipId,
    userId: ctx.userId,
    status: ctx.status,
    reasonCategory: ctx.reasonCategory,
    note: ctx.note,
    noteVisibility: ctx.noteVisibility,
    source: ctx.source,
    waitlisted,
    respondedAt: ctx.now,
    createdBy: ctx.actorUserId,
    now: ctx.now,
  };
}

/** Build a version-guarded update for an existing response. */
export function buildRsvpUpdate(
  existing: PracticeRsvp,
  ctx: RsvpWriteContext,
  waitlisted: boolean,
): RsvpUpdate {
  return {
    id: existing.id,
    status: ctx.status,
    reasonCategory: ctx.reasonCategory,
    note: ctx.note,
    noteVisibility: ctx.noteVisibility,
    source: ctx.source,
    waitlisted,
    respondedAt: ctx.now,
    updatedBy: ctx.actorUserId,
    expectedVersion: existing.version,
    now: ctx.now,
  };
}

/** Build the append-only revision row for a recorded response. */
export function buildRsvpRevision(
  id: string,
  previous: PracticeRsvp | null,
  rsvp: PracticeRsvp,
  ctx: RsvpWriteContext,
): NewRsvpRevision {
  return {
    id,
    rsvpId: rsvp.id,
    sessionId: rsvp.sessionId,
    membershipId: rsvp.membershipId,
    fromStatus: previous === null ? null : previous.status,
    toStatus: rsvp.status,
    reasonCategory: rsvp.reasonCategory,
    note: rsvp.note,
    waitlisted: rsvp.waitlisted,
    source: ctx.source,
    isOverride: ctx.isOverride,
    overrideReason: ctx.overrideReason,
    actorUserId: ctx.actorUserId,
    now: ctx.now,
  };
}

/** Build the revision row recorded when a waitlisted member is promoted. */
export function buildPromotionRevision(
  id: string,
  promoted: PracticeRsvp,
  previous: PracticeRsvp,
  now: Date,
): NewRsvpRevision {
  return {
    id,
    rsvpId: promoted.id,
    sessionId: promoted.sessionId,
    membershipId: promoted.membershipId,
    fromStatus: previous.status,
    toStatus: promoted.status,
    reasonCategory: promoted.reasonCategory,
    note: promoted.note,
    waitlisted: promoted.waitlisted,
    source: RsvpSource.System,
    isOverride: false,
    overrideReason: null,
    actorUserId: null,
    now,
  };
}

/** Build the audit entry for a recorded (self or override) response. */
export function buildRsvpAudit(
  ctx: RsvpWriteContext,
  rsvp: PracticeRsvp,
): AuditInput {
  return {
    actorUserId: ctx.actorUserId,
    action: ctx.isOverride ? RSVP_OVERRIDDEN_ACTION : RSVP_RECORDED_ACTION,
    resourceType: RSVP_RESOURCE_TYPE,
    resourceId: rsvp.id,
    teamId: rsvp.teamId,
    seasonId: rsvp.seasonId,
    correlationId: null,
    outcome: AuditOutcome.Success,
    diff: {
      status: rsvp.status,
      source: rsvp.source,
      waitlisted: rsvp.waitlisted,
      isOverride: ctx.isOverride,
    },
  };
}

/** Build the audit entry for a system waitlist promotion. */
export function buildPromotionAudit(promoted: PracticeRsvp): AuditInput {
  return {
    actorUserId: null,
    action: RSVP_PROMOTED_ACTION,
    resourceType: RSVP_RESOURCE_TYPE,
    resourceId: promoted.id,
    teamId: promoted.teamId,
    seasonId: promoted.seasonId,
    correlationId: null,
    outcome: AuditOutcome.Success,
    diff: {
      status: promoted.status,
      waitlisted: promoted.waitlisted,
      membershipId: promoted.membershipId,
    },
  };
}

/** Build the outbox event announcing a recorded response (a change reminder). */
export function buildRsvpEvent(
  rsvp: PracticeRsvp,
  ctx: RsvpWriteContext,
): DomainEventInput {
  return {
    aggregateType: RSVP_AGGREGATE_TYPE,
    aggregateId: rsvp.id,
    eventType: RSVP_RECORDED_EVENT,
    eventVersion: RSVP_EVENT_VERSION,
    actorUserId: ctx.actorUserId,
    teamId: rsvp.teamId,
    seasonId: rsvp.seasonId,
    correlationId: null,
    causationId: null,
    payload: {
      sessionId: rsvp.sessionId,
      membershipId: rsvp.membershipId,
      status: rsvp.status,
      source: rsvp.source,
      waitlisted: rsvp.waitlisted,
      [RSVP_RECIPIENT_KEY]: rsvp.userId,
    },
  };
}

/** Build the outbox event announcing a waitlist promotion (a promotion reminder). */
export function buildPromotionEvent(promoted: PracticeRsvp): DomainEventInput {
  return {
    aggregateType: RSVP_AGGREGATE_TYPE,
    aggregateId: promoted.id,
    eventType: RSVP_PROMOTED_EVENT,
    eventVersion: RSVP_EVENT_VERSION,
    actorUserId: null,
    teamId: promoted.teamId,
    seasonId: promoted.seasonId,
    correlationId: null,
    causationId: null,
    payload: {
      sessionId: promoted.sessionId,
      membershipId: promoted.membershipId,
      status: promoted.status,
      waitlisted: promoted.waitlisted,
      [RSVP_RECIPIENT_KEY]: promoted.userId,
    },
  };
}
