import type { AuditInput, DomainEventInput } from '@modules/platform';
import { AuditOutcome } from '@modules/platform';

import {
  initialStatusOf,
  waitlistPositionOf,
} from '../domain/tryout-registration.policy';
import {
  TRYOUT_AGGREGATE,
  TRYOUT_CANDIDATE_CONVERTED_EVENT,
  TRYOUT_CANDIDATE_RESOURCE_TYPE,
  TRYOUT_EVENT_RESOURCE_TYPE,
  TRYOUT_OFFER_SENT_EVENT,
  TRYOUTS_EVENT_VERSION,
} from '../model/tryouts.constants';
import type { OfferStatus, TryoutEventStatus } from '../model/tryouts.enums';
import {
  CandidateStatus,
  EvaluationStatus,
  TryoutEventStatus as EventStatus,
} from '../model/tryouts.enums';
import type {
  CandidateContent,
  CandidateStatusChange,
  EvaluationContent,
  EvaluationUpsert,
  EvaluatorCompletion,
  NewTryoutCandidate,
  NewTryoutDecision,
  NewTryoutEvent,
  NewTryoutOffer,
  OfferStatusChange,
  RegistrationVerdict,
  TryoutCandidate,
  TryoutDecision,
  TryoutEvent,
  TryoutEventContent,
  TryoutEventStatusChange,
  TryoutFunnelReport,
  TryoutOffer,
} from '../model/tryouts.types';

// --- Row builders ------------------------------------------------------------

export function buildNewTryoutEvent(
  id: string,
  teamId: string,
  content: TryoutEventContent,
  actorUserId: string,
  now: Date,
): NewTryoutEvent {
  return {
    id,
    teamId,
    seasonId: content.seasonId,
    venueId: content.venueId,
    name: content.name,
    capacity: content.capacity,
    registrationOpensAt: content.registrationOpensAt,
    registrationClosesAt: content.registrationClosesAt,
    startsAt: content.startsAt,
    endsAt: content.endsAt,
    visibility: content.visibility,
    consentVersion: content.consentVersion,
    eligibilityNote: content.eligibilityNote,
    retentionDays: content.retentionDays,
    createdBy: actorUserId,
    now,
  };
}

export function buildEventStatusChange(
  event: TryoutEvent,
  target: TryoutEventStatus,
  expectedRecordVersion: number,
  now: Date,
): TryoutEventStatusChange {
  return {
    id: event.eventId,
    teamId: event.teamId,
    expectedRecordVersion,
    toStatus: target,
    openedAt: target === EventStatus.Open ? now : event.openedAt,
    closedAt: target === EventStatus.Closed ? now : event.closedAt,
    completedAt: target === EventStatus.Completed ? now : event.completedAt,
    cancelledAt: target === EventStatus.Cancelled ? now : event.cancelledAt,
    now,
  };
}

/** A registrant, seated or waitlisted, with its retention deadline resolved. */
export function buildNewCandidate(
  id: string,
  event: TryoutEvent,
  content: CandidateContent,
  identityHash: string,
  verdict: RegistrationVerdict,
  registeredCount: number,
  retentionExpiresAt: Date,
  actorUserId: string | null,
  now: Date,
): NewTryoutCandidate {
  return {
    id,
    teamId: event.teamId,
    eventId: event.eventId,
    displayName: content.displayName,
    identityHash,
    contactChannel: content.contactChannel,
    contactReference: content.contactReference,
    priorSport: content.priorSport,
    referralSource: content.referralSource,
    motivation: content.motivation,
    communicationOptIn: content.communicationOptIn,
    consentVersion: content.consentVersion,
    readiness: content.readiness,
    restrictedNotes: content.restrictedNotes,
    status: initialStatusOf(verdict),
    waitlistPosition: waitlistPositionOf(verdict, event, registeredCount),
    retentionExpiresAt,
    createdBy: actorUserId,
    now,
  };
}

export function buildCandidateStatusChange(
  candidate: TryoutCandidate,
  target: CandidateStatus,
  expectedRecordVersion: number,
  checkedIn: boolean,
  withdrawn: boolean,
  now: Date,
): CandidateStatusChange {
  return {
    id: candidate.candidateId,
    teamId: candidate.teamId,
    expectedRecordVersion,
    toStatus: target,
    checkedInAt: checkedIn ? now : candidate.checkedInAt,
    withdrawnAt: withdrawn ? now : candidate.withdrawnAt,
    now,
  };
}

export function buildEvaluationUpsert(
  id: string,
  candidate: TryoutCandidate,
  evaluatorUserId: string,
  content: EvaluationContent,
  now: Date,
): EvaluationUpsert {
  return {
    id,
    teamId: candidate.teamId,
    candidateId: candidate.candidateId,
    evaluatorUserId,
    criteriaVersion: content.criteriaVersion,
    attended: content.attended,
    ratings: content.ratings,
    observations: content.observations,
    privateNotes: content.privateNotes,
    recommendation: content.recommendation,
    status: content.submit
      ? EvaluationStatus.Submitted
      : EvaluationStatus.Draft,
    submittedAt: content.submit ? now : null,
    now,
  };
}

export function buildNewDecision(
  id: string,
  candidate: TryoutCandidate,
  decision: TryoutDecision['decision'],
  reasons: string,
  criteriaVersion: string,
  evaluatorCount: number,
  actorUserId: string,
  now: Date,
): NewTryoutDecision {
  return {
    id,
    teamId: candidate.teamId,
    candidateId: candidate.candidateId,
    decision,
    reasons,
    criteriaVersion,
    evaluatorCount,
    decidedBy: actorUserId,
    now,
  };
}

export function buildNewOffer(
  id: string,
  candidate: TryoutCandidate,
  candidateMessage: string | null,
  expiresAt: Date,
  actorUserId: string,
  now: Date,
): NewTryoutOffer {
  return {
    id,
    teamId: candidate.teamId,
    candidateId: candidate.candidateId,
    candidateMessage,
    expiresAt,
    createdBy: actorUserId,
    now,
  };
}

export function buildOfferStatusChange(
  offer: TryoutOffer,
  target: OfferStatus,
  expectedRecordVersion: number,
  sent: boolean,
  responded: boolean,
  now: Date,
): OfferStatusChange {
  return {
    id: offer.offerId,
    teamId: offer.teamId,
    expectedRecordVersion,
    toStatus: target,
    sentAt: sent ? now : offer.sentAt,
    respondedAt: responded ? now : offer.respondedAt,
    now,
  };
}

// --- Audit -------------------------------------------------------------------

export function buildEventAudit(
  action: string,
  actorUserId: string,
  event: TryoutEvent,
): AuditInput {
  return {
    actorUserId,
    action,
    resourceType: TRYOUT_EVENT_RESOURCE_TYPE,
    resourceId: event.eventId,
    teamId: event.teamId,
    seasonId: event.seasonId,
    correlationId: null,
    outcome: AuditOutcome.Success,
    diff: {
      status: event.status,
      visibility: event.visibility,
      consentVersion: event.consentVersion,
      capacity: event.capacity,
    },
  };
}

/**
 * Audit a candidate change. The diff carries CLASSIFICATIONS only — status,
 * readiness, consent version — and never the display name, the contact
 * reference, the motivation, or the restricted health note.
 */
export function buildCandidateAudit(
  action: string,
  actorUserId: string | null,
  candidate: TryoutCandidate,
  seasonId: string | null,
): AuditInput {
  return {
    actorUserId,
    action,
    resourceType: TRYOUT_CANDIDATE_RESOURCE_TYPE,
    resourceId: candidate.candidateId,
    teamId: candidate.teamId,
    seasonId,
    correlationId: null,
    outcome: AuditOutcome.Success,
    diff: {
      eventId: candidate.eventId,
      status: candidate.status,
      readiness: candidate.readiness,
      consentVersion: candidate.consentVersion,
      waitlisted: candidate.waitlistPosition !== null,
    },
  };
}

/** Audit a decision. Reasons are recorded on the decision row, not the diff. */
export function buildDecisionAudit(
  action: string,
  actorUserId: string,
  decision: TryoutDecision,
  seasonId: string | null,
): AuditInput {
  return {
    actorUserId,
    action,
    resourceType: TRYOUT_CANDIDATE_RESOURCE_TYPE,
    resourceId: decision.candidateId,
    teamId: decision.teamId,
    seasonId,
    correlationId: null,
    outcome: AuditOutcome.Success,
    diff: {
      decision: decision.decision,
      criteriaVersion: decision.criteriaVersion,
      evaluatorCount: decision.evaluatorCount,
    },
  };
}

// --- Domain events -----------------------------------------------------------

/**
 * `tryout.offer.sent` is the notify signal. Its payload carries the candidate
 * id and the expiry only — never the internal notes, the ratings, or the
 * committee's reasons.
 */
export function buildOfferSentEvent(
  offer: TryoutOffer,
  seasonId: string | null,
  actorUserId: string,
): DomainEventInput {
  return {
    aggregateType: TRYOUT_AGGREGATE,
    aggregateId: offer.candidateId,
    eventType: TRYOUT_OFFER_SENT_EVENT,
    eventVersion: TRYOUTS_EVENT_VERSION,
    actorUserId,
    teamId: offer.teamId,
    seasonId,
    correlationId: null,
    causationId: null,
    payload: {
      offerId: offer.offerId,
      expiresAt: offer.expiresAt.toISOString(),
    },
  };
}

export function buildCandidateConvertedEvent(
  candidate: TryoutCandidate,
  membershipId: string,
  seasonId: string | null,
  actorUserId: string,
): DomainEventInput {
  return {
    aggregateType: TRYOUT_AGGREGATE,
    aggregateId: candidate.candidateId,
    eventType: TRYOUT_CANDIDATE_CONVERTED_EVENT,
    eventVersion: TRYOUTS_EVENT_VERSION,
    actorUserId,
    teamId: candidate.teamId,
    seasonId,
    correlationId: null,
    causationId: null,
    payload: { membershipId, eventId: candidate.eventId },
  };
}

/**
 * Assemble the privacy-safe funnel report from per-status counts and evaluator
 * completion. Every status is read with a zero default so an empty stage still
 * appears — an anonymized candidate still counts, and a missing count is zero,
 * never absent.
 */
export function buildFunnelReport(
  eventId: string,
  counts: ReadonlyMap<string, number>,
  evaluators: readonly EvaluatorCompletion[],
): TryoutFunnelReport {
  return {
    eventId,
    registered: counts.get(CandidateStatus.Registered) ?? 0,
    waitlisted: counts.get(CandidateStatus.Waitlisted) ?? 0,
    checkedIn: counts.get(CandidateStatus.CheckedIn) ?? 0,
    noShow: counts.get(CandidateStatus.NoShow) ?? 0,
    withdrawn: counts.get(CandidateStatus.Withdrawn) ?? 0,
    accepted: counts.get(CandidateStatus.Accepted) ?? 0,
    rejected: counts.get(CandidateStatus.Rejected) ?? 0,
    converted: counts.get(CandidateStatus.Converted) ?? 0,
    evaluators,
  };
}
