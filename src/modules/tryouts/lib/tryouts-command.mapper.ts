import { RETENTION_DAYS_DEFAULT } from '../model/tryouts.constants';
import {
  CandidateReadiness,
  ContactChannel,
  EvaluationRecommendation,
  TryoutVisibility,
} from '../model/tryouts.enums';
import type {
  CandidateContent,
  CandidateContentInput,
  CandidateListFilter,
  CandidateListFilterInput,
  EvaluationContent,
  EvaluationContentInput,
  TryoutEventContent,
  TryoutEventContentInput,
} from '../model/tryouts.types';
import { sanitizeRatings } from './tryouts.helpers';

/**
 * Normalizes loosely-typed transport input into the strict command shapes.
 *
 * The defaults are deliberately the SAFEST option, not the most convenient one:
 * an event defaults to invite-only, a candidate defaults to no contact channel,
 * no communication opt-in, and `unknown` readiness. An absent capacity stays
 * null (no seat limit) and is never read as zero.
 */
export function toTryoutEventContent(
  input: TryoutEventContentInput,
): TryoutEventContent {
  return {
    seasonId: input.seasonId,
    venueId: input.venueId ?? null,
    name: input.name.trim(),
    capacity: input.capacity ?? null,
    registrationOpensAt: input.registrationOpensAt,
    registrationClosesAt: input.registrationClosesAt,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    visibility: input.visibility ?? TryoutVisibility.InviteOnly,
    consentVersion: input.consentVersion.trim(),
    eligibilityNote: input.eligibilityNote ?? null,
    retentionDays: input.retentionDays ?? RETENTION_DAYS_DEFAULT,
  };
}

export function toCandidateContent(
  input: CandidateContentInput,
): CandidateContent {
  return {
    eventId: input.eventId,
    displayName: input.displayName.trim(),
    contactChannel: input.contactChannel ?? ContactChannel.None,
    contactReference: input.contactReference ?? null,
    priorSport: input.priorSport ?? null,
    referralSource: input.referralSource ?? null,
    motivation: input.motivation ?? null,
    communicationOptIn: input.communicationOptIn ?? false,
    consentVersion: input.consentVersion.trim(),
    readiness: input.readiness ?? CandidateReadiness.Unknown,
    restrictedNotes: input.restrictedNotes ?? null,
  };
}

export function toEvaluationContent(
  input: EvaluationContentInput,
): EvaluationContent {
  return {
    criteriaVersion: input.criteriaVersion.trim(),
    attended: input.attended ?? true,
    ratings: sanitizeRatings(input.ratings ?? {}),
    observations: input.observations ?? null,
    privateNotes: input.privateNotes ?? null,
    recommendation: input.recommendation ?? EvaluationRecommendation.Undecided,
    submit: input.submit ?? false,
  };
}

export function toCandidateListFilter(
  input: CandidateListFilterInput,
): CandidateListFilter {
  return {
    eventId: input.eventId ?? null,
    status: input.status ?? null,
    readiness: input.readiness ?? null,
  };
}
