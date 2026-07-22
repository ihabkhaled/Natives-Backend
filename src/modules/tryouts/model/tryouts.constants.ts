import type { ErrorMessageKey } from '@core/errors/error.types';

// --- API surface -------------------------------------------------------------

export const TRYOUTS_API_TAG = 'tryouts';
export const TRYOUT_EVENTS_ROUTE = 'teams/:teamId/tryout-events';
export const TRYOUT_CANDIDATES_ROUTE = 'teams/:teamId/tryout-candidates';

export const TEAM_ID_PARAM = 'teamId';
export const EVENT_ID_PARAM = 'eventId';
export const CANDIDATE_ID_PARAM = 'candidateId';

export const EVENT_ITEM_ROUTE = ':eventId';
export const EVENT_TRANSITION_ROUTE = ':eventId/transition';
export const EVENT_FUNNEL_ROUTE = ':eventId/funnel';
export const CANDIDATE_ITEM_ROUTE = ':candidateId';
export const CANDIDATE_CHECK_IN_ROUTE = ':candidateId/check-in';
export const CANDIDATE_WITHDRAWAL_ROUTE = ':candidateId/withdrawal';
export const CANDIDATE_EVALUATION_ROUTE = ':candidateId/evaluation';
export const CANDIDATE_DECISION_ROUTE = ':candidateId/decision';
export const CANDIDATE_OFFER_ROUTE = ':candidateId/offer';
export const CANDIDATE_CONVERSION_ROUTE = ':candidateId/conversion';
export const CANDIDATE_RETENTION_ROUTE = 'retention';

// --- Pagination --------------------------------------------------------------

export const LIST_DEFAULT_LIMIT = 20;
export const LIST_MAX_LIMIT = 100;
export const LIST_MIN_LIMIT = 1;
export const LIST_DEFAULT_OFFSET = 0;
export const RETENTION_MAX_BATCH = 200;

// --- Field bounds ------------------------------------------------------------

export const NAME_MIN_LENGTH = 2;
export const NAME_MAX_LENGTH = 160;
export const CONTACT_MAX_LENGTH = 200;
export const TEXT_MAX_LENGTH = 2000;
export const REASON_MIN_LENGTH = 3;
export const REASON_MAX_LENGTH = 1000;
export const CONSENT_VERSION_MIN_LENGTH = 1;
export const CONSENT_VERSION_MAX_LENGTH = 40;
export const CRITERIA_VERSION_MAX_LENGTH = 40;
export const CAPACITY_MIN = 1;
export const CAPACITY_MAX = 500;
export const RETENTION_DAYS_MIN = 1;
export const RETENTION_DAYS_MAX = 3650;
export const RETENTION_DAYS_DEFAULT = 365;
export const RATING_MIN = 1;
export const RATING_MAX = 5;
export const RATINGS_MAX_KEYS = 20;
export const RECORD_VERSION_MIN = 1;
export const OFFER_TTL_DAYS_DEFAULT = 14;

export const MILLISECONDS_PER_DAY = 86_400_000;

/** The token the anonymizer writes over every free-text personal field. */
export const ANONYMIZED_PLACEHOLDER = 'anonymized';
export const IDENTITY_HASH_ALGORITHM = 'sha256';

// --- Error messages ----------------------------------------------------------

export const TRYOUT_EVENT_NOT_FOUND_MESSAGE =
  'The requested tryout event was not found';
export const TRYOUT_EVENT_NOT_FOUND_MESSAGE_KEY: ErrorMessageKey =
  'errors.tryouts.eventNotFound';
export const TRYOUT_CANDIDATE_NOT_FOUND_MESSAGE =
  'The requested tryout candidate was not found';
export const TRYOUT_CANDIDATE_NOT_FOUND_MESSAGE_KEY: ErrorMessageKey =
  'errors.tryouts.candidateNotFound';
export const TRYOUT_SCOPE_NOT_FOUND_MESSAGE =
  'The team, season, or venue scope was not found';
export const TRYOUT_SCOPE_NOT_FOUND_MESSAGE_KEY: ErrorMessageKey =
  'errors.tryouts.scopeNotFound';
export const TRYOUT_OFFER_NOT_FOUND_MESSAGE = 'The candidate has no live offer';
export const TRYOUT_OFFER_NOT_FOUND_MESSAGE_KEY: ErrorMessageKey =
  'errors.tryouts.offerNotFound';
export const TRYOUT_VALIDATION_MESSAGE =
  'The tryout request failed a domain validation rule';
export const TRYOUT_VALIDATION_MESSAGE_KEY: ErrorMessageKey =
  'errors.tryouts.validation';
export const TRYOUT_REGISTRATION_REFUSED_MESSAGE =
  'The registration cannot be accepted for this tryout event';
export const TRYOUT_REGISTRATION_REFUSED_MESSAGE_KEY: ErrorMessageKey =
  'errors.tryouts.registrationRefused';
export const TRYOUT_CONSENT_MESSAGE =
  'The accepted consent version does not match the version this event requires';
export const TRYOUT_CONSENT_MESSAGE_KEY: ErrorMessageKey =
  'errors.tryouts.consentVersion';
export const TRYOUT_DUPLICATE_MESSAGE =
  'A candidate with these details is already registered for this event';
export const TRYOUT_DUPLICATE_MESSAGE_KEY: ErrorMessageKey =
  'errors.tryouts.duplicateCandidate';
export const TRYOUT_INVALID_TRANSITION_MESSAGE =
  'The tryout record cannot make this lifecycle transition';
export const TRYOUT_INVALID_TRANSITION_MESSAGE_KEY: ErrorMessageKey =
  'errors.tryouts.invalidTransition';
export const TRYOUT_VERSION_CONFLICT_MESSAGE =
  'The tryout record was modified concurrently';
export const TRYOUT_VERSION_CONFLICT_MESSAGE_KEY: ErrorMessageKey =
  'errors.tryouts.versionConflict';
export const TRYOUT_ALREADY_CONVERTED_MESSAGE =
  'The candidate has already been converted to a membership';
export const TRYOUT_ALREADY_CONVERTED_MESSAGE_KEY: ErrorMessageKey =
  'errors.tryouts.alreadyConverted';
export const TRYOUT_DECISION_REQUIRED_MESSAGE =
  'A human acceptance decision and an accepted offer are required before conversion';
export const TRYOUT_DECISION_REQUIRED_MESSAGE_KEY: ErrorMessageKey =
  'errors.tryouts.decisionRequired';
export const TRYOUT_RESTRICTED_MESSAGE =
  'You are not permitted to read restricted candidate information';
export const TRYOUT_RESTRICTED_MESSAGE_KEY: ErrorMessageKey =
  'errors.tryouts.restricted';

// --- Audit actions / resources ----------------------------------------------

export const TRYOUT_EVENT_RESOURCE_TYPE = 'tryout_event';
export const TRYOUT_CANDIDATE_RESOURCE_TYPE = 'tryout_candidate';
export const TRYOUT_AGGREGATE = 'tryout_candidate';

export const TRYOUT_EVENT_CREATED_ACTION = 'tryout.event.created';
export const TRYOUT_EVENT_TRANSITIONED_ACTION = 'tryout.event.transitioned';
export const TRYOUT_CANDIDATE_REGISTERED_ACTION = 'tryout.candidate.registered';
export const TRYOUT_CANDIDATE_CHECKED_IN_ACTION = 'tryout.candidate.checked_in';
export const TRYOUT_CANDIDATE_WITHDRAWN_ACTION = 'tryout.candidate.withdrawn';
export const TRYOUT_CANDIDATE_ANONYMIZED_ACTION = 'tryout.candidate.anonymized';
export const TRYOUT_EVALUATION_SUBMITTED_ACTION = 'tryout.evaluation.submitted';
export const TRYOUT_DECISION_RECORDED_ACTION = 'tryout.decision.recorded';
export const TRYOUT_OFFER_TRANSITIONED_ACTION = 'tryout.offer.transitioned';
export const TRYOUT_CANDIDATE_CONVERTED_ACTION = 'tryout.candidate.converted';

// --- Domain events -----------------------------------------------------------

export const TRYOUTS_EVENT_VERSION = 1;
export const TRYOUT_OFFER_SENT_EVENT = 'tryout.offer.sent.v1';
export const TRYOUT_CANDIDATE_CONVERTED_EVENT = 'tryout.candidate.converted.v1';

// --- Static column lists (never SELECT *) ------------------------------------

export const TRYOUT_EVENT_COLUMNS = `"id", "team_id", "season_id", "venue_id",
  "name", "capacity", "registration_opens_at", "registration_closes_at",
  "starts_at", "ends_at", "visibility", "consent_version", "eligibility_note",
  "retention_days", "status", "record_version", "created_by", "opened_at",
  "closed_at", "completed_at", "cancelled_at", "created_at", "updated_at"`;

export const CANDIDATE_COLUMNS = `"id", "team_id", "event_id", "display_name",
  "identity_hash", "contact_channel", "contact_reference", "prior_sport",
  "referral_source", "motivation", "communication_opt_in", "consent_version",
  "consented_at", "readiness", "restricted_notes", "status",
  "waitlist_position", "checked_in_at", "withdrawn_at",
  "duplicate_of_candidate_id", "converted_membership_id", "converted_at",
  "retention_expires_at", "anonymized_at", "record_version", "created_by",
  "created_at", "updated_at"`;

export const EVALUATION_COLUMNS = `"id", "team_id", "candidate_id",
  "evaluator_user_id", "criteria_version", "attended", "ratings",
  "observations", "private_notes", "recommendation", "status",
  "record_version", "submitted_at", "created_at", "updated_at"`;

export const DECISION_COLUMNS = `"id", "team_id", "candidate_id", "decision",
  "reasons", "criteria_version", "evaluator_count", "decided_by", "decided_at"`;

export const OFFER_COLUMNS = `"id", "team_id", "candidate_id", "status",
  "candidate_message", "expires_at", "sent_at", "responded_at",
  "record_version", "created_by", "created_at", "updated_at"`;

/**
 * Evaluations are upserted per (candidate, evaluator) so an evaluator revises
 * their OWN original and never overwrites a colleague's assessment.
 */
export const EVALUATION_UPSERT_SQL = `INSERT INTO "tryout_evaluations"
    ("id", "team_id", "candidate_id", "evaluator_user_id",
     "criteria_version", "attended", "ratings", "observations",
     "private_notes", "recommendation", "status", "submitted_at",
     "created_at", "updated_at")
   VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11, $12, $13,
           $13)
   ON CONFLICT ("candidate_id", "evaluator_user_id") DO UPDATE SET
     "criteria_version" = EXCLUDED."criteria_version",
     "attended" = EXCLUDED."attended",
     "ratings" = EXCLUDED."ratings",
     "observations" = EXCLUDED."observations",
     "private_notes" = EXCLUDED."private_notes",
     "recommendation" = EXCLUDED."recommendation",
     "status" = EXCLUDED."status",
     "submitted_at" = EXCLUDED."submitted_at",
     "updated_at" = EXCLUDED."updated_at",
     "record_version" = "tryout_evaluations"."record_version" + 1
   RETURNING ${EVALUATION_COLUMNS}`;

/** The candidate statuses that count as "did not proceed" for retention. */
export const RETIRABLE_CANDIDATE_STATES = `('withdrawn', 'rejected', 'no_show')`;
