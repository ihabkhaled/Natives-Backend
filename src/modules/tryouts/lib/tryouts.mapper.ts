import {
  CANDIDATE_READINESS_VALUES,
  CANDIDATE_STATUS_VALUES,
  CONTACT_CHANNEL_VALUES,
  EVALUATION_RECOMMENDATION_VALUES,
  EVALUATION_STATUS_VALUES,
  OFFER_STATUS_VALUES,
  TRYOUT_DECISION_VALUE_VALUES,
  TRYOUT_EVENT_STATUS_VALUES,
  TRYOUT_VISIBILITY_VALUES,
} from '../model/tryouts.enums';
import type {
  CandidateRow,
  DecisionRow,
  EvaluationRow,
  EvaluatorCompletionRow,
  FunnelCountRow,
  OfferRow,
  TryoutEventRow,
} from '../model/tryouts.rows';
import type {
  EvaluatorCompletion,
  TryoutCandidate,
  TryoutDecision,
  TryoutEvaluation,
  TryoutEvent,
  TryoutOffer,
} from '../model/tryouts.types';
import {
  asRatingRecord,
  parseEnumValue,
  sanitizeRatings,
  toDate,
  toNullableDate,
  toNullableNumber,
  toNumber,
} from './tryouts.helpers';

export function toTryoutEvent(row: TryoutEventRow): TryoutEvent {
  return {
    eventId: row.id,
    teamId: row.team_id,
    seasonId: row.season_id,
    venueId: row.venue_id,
    name: row.name,
    capacity: toNullableNumber(row.capacity),
    registrationOpensAt: toDate(row.registration_opens_at),
    registrationClosesAt: toDate(row.registration_closes_at),
    startsAt: toDate(row.starts_at),
    endsAt: toDate(row.ends_at),
    visibility: parseEnumValue(
      TRYOUT_VISIBILITY_VALUES,
      row.visibility,
      'visibility',
    ),
    consentVersion: row.consent_version,
    eligibilityNote: row.eligibility_note,
    retentionDays: toNumber(row.retention_days),
    status: parseEnumValue(
      TRYOUT_EVENT_STATUS_VALUES,
      row.status,
      'event status',
    ),
    recordVersion: toNumber(row.record_version),
    createdBy: row.created_by,
    openedAt: toNullableDate(row.opened_at),
    closedAt: toNullableDate(row.closed_at),
    completedAt: toNullableDate(row.completed_at),
    cancelledAt: toNullableDate(row.cancelled_at),
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  };
}

export function toCandidate(row: CandidateRow): TryoutCandidate {
  return {
    candidateId: row.id,
    teamId: row.team_id,
    eventId: row.event_id,
    displayName: row.display_name,
    identityHash: row.identity_hash,
    contactChannel: parseEnumValue(
      CONTACT_CHANNEL_VALUES,
      row.contact_channel,
      'contact channel',
    ),
    contactReference: row.contact_reference,
    priorSport: row.prior_sport,
    referralSource: row.referral_source,
    motivation: row.motivation,
    communicationOptIn: row.communication_opt_in,
    consentVersion: row.consent_version,
    consentedAt: toDate(row.consented_at),
    readiness: parseEnumValue(
      CANDIDATE_READINESS_VALUES,
      row.readiness,
      'readiness',
    ),
    restrictedNotes: row.restricted_notes,
    status: parseEnumValue(
      CANDIDATE_STATUS_VALUES,
      row.status,
      'candidate status',
    ),
    waitlistPosition: toNullableNumber(row.waitlist_position),
    checkedInAt: toNullableDate(row.checked_in_at),
    withdrawnAt: toNullableDate(row.withdrawn_at),
    duplicateOfCandidateId: row.duplicate_of_candidate_id,
    convertedMembershipId: row.converted_membership_id,
    convertedAt: toNullableDate(row.converted_at),
    retentionExpiresAt: toDate(row.retention_expires_at),
    anonymizedAt: toNullableDate(row.anonymized_at),
    recordVersion: toNumber(row.record_version),
    createdBy: row.created_by,
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  };
}

export function toEvaluation(row: EvaluationRow): TryoutEvaluation {
  return {
    evaluationId: row.id,
    teamId: row.team_id,
    candidateId: row.candidate_id,
    evaluatorUserId: row.evaluator_user_id,
    criteriaVersion: row.criteria_version,
    attended: row.attended,
    ratings: sanitizeRatings(asRatingRecord(row.ratings)),
    observations: row.observations,
    privateNotes: row.private_notes,
    recommendation: parseEnumValue(
      EVALUATION_RECOMMENDATION_VALUES,
      row.recommendation,
      'recommendation',
    ),
    status: parseEnumValue(
      EVALUATION_STATUS_VALUES,
      row.status,
      'evaluation status',
    ),
    recordVersion: toNumber(row.record_version),
    submittedAt: toNullableDate(row.submitted_at),
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  };
}

export function toDecision(row: DecisionRow): TryoutDecision {
  return {
    decisionId: row.id,
    teamId: row.team_id,
    candidateId: row.candidate_id,
    decision: parseEnumValue(
      TRYOUT_DECISION_VALUE_VALUES,
      row.decision,
      'decision',
    ),
    reasons: row.reasons,
    criteriaVersion: row.criteria_version,
    evaluatorCount: toNumber(row.evaluator_count),
    decidedBy: row.decided_by,
    decidedAt: toDate(row.decided_at),
  };
}

export function toOffer(row: OfferRow): TryoutOffer {
  return {
    offerId: row.id,
    teamId: row.team_id,
    candidateId: row.candidate_id,
    status: parseEnumValue(OFFER_STATUS_VALUES, row.status, 'offer status'),
    candidateMessage: row.candidate_message,
    expiresAt: toDate(row.expires_at),
    sentAt: toNullableDate(row.sent_at),
    respondedAt: toNullableDate(row.responded_at),
    recordVersion: toNumber(row.record_version),
    createdBy: row.created_by,
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  };
}

/** Fold the per-status counts into a keyed lookup for the funnel report. */
export function toFunnelCounts(
  rows: readonly FunnelCountRow[],
): ReadonlyMap<string, number> {
  return new Map(rows.map(row => [row.status, toNumber(row.count)]));
}

export function toEvaluatorCompletion(
  row: EvaluatorCompletionRow,
): EvaluatorCompletion {
  return {
    evaluatorUserId: row.evaluator_user_id,
    assigned: toNumber(row.assigned),
    submitted: toNumber(row.submitted),
  };
}
