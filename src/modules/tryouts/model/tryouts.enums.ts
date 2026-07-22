/**
 * Enumerations for tryout events, candidates, evaluations, decisions, offers,
 * and conversion (UN-600, UN-601). Every enum ships a `*_VALUES` tuple so
 * mappers can validate a raw database string against the closed set.
 */

/** Who may register for the event. */
export enum TryoutVisibility {
  Public = 'public',
  InviteOnly = 'invite_only',
}

export const TRYOUT_VISIBILITY_VALUES: readonly TryoutVisibility[] =
  Object.values(TryoutVisibility);

/** Lifecycle of a tryout event. */
export enum TryoutEventStatus {
  Draft = 'draft',
  Open = 'open',
  Closed = 'closed',
  Completed = 'completed',
  Cancelled = 'cancelled',
}

export const TRYOUT_EVENT_STATUS_VALUES: readonly TryoutEventStatus[] =
  Object.values(TryoutEventStatus);

/** The lifecycle verbs the event transition endpoint accepts. */
export enum TryoutEventTransition {
  Open = 'open',
  Close = 'close',
  Complete = 'complete',
  Cancel = 'cancel',
}

export const TRYOUT_EVENT_TRANSITION_VALUES: readonly TryoutEventTransition[] =
  Object.values(TryoutEventTransition);

/**
 * The single contact channel a candidate may be reached on. `none` is a real
 * option: a candidate may decline to give any contact detail and still register.
 */
export enum ContactChannel {
  Email = 'email',
  Phone = 'phone',
  WhatsApp = 'whatsapp',
  None = 'none',
}

export const CONTACT_CHANNEL_VALUES: readonly ContactChannel[] =
  Object.values(ContactChannel);

/**
 * Health readiness classification. `unknown` is the honest default for a
 * candidate who did not declare — never "ready".
 */
export enum CandidateReadiness {
  Ready = 'ready',
  Limited = 'limited',
  Injured = 'injured',
  Unknown = 'unknown',
}

export const CANDIDATE_READINESS_VALUES: readonly CandidateReadiness[] =
  Object.values(CandidateReadiness);

/** Lifecycle of a candidate. `converted` is only ever reached once. */
export enum CandidateStatus {
  Registered = 'registered',
  Waitlisted = 'waitlisted',
  CheckedIn = 'checked_in',
  NoShow = 'no_show',
  Withdrawn = 'withdrawn',
  Accepted = 'accepted',
  Rejected = 'rejected',
  Converted = 'converted',
}

export const CANDIDATE_STATUS_VALUES: readonly CandidateStatus[] =
  Object.values(CandidateStatus);

/** Whether an evaluator has finished their original observation. */
export enum EvaluationStatus {
  Draft = 'draft',
  Submitted = 'submitted',
}

export const EVALUATION_STATUS_VALUES: readonly EvaluationStatus[] =
  Object.values(EvaluationStatus);

/**
 * One evaluator's recommendation. It is ADVICE: the aggregate of several
 * recommendations never becomes the decision — a human records that separately.
 */
export enum EvaluationRecommendation {
  Accept = 'accept',
  Waitlist = 'waitlist',
  Reject = 'reject',
  Undecided = 'undecided',
}

export const EVALUATION_RECOMMENDATION_VALUES: readonly EvaluationRecommendation[] =
  Object.values(EvaluationRecommendation);

/** The committee's recorded decision. */
export enum TryoutDecisionValue {
  Accept = 'accept',
  Waitlist = 'waitlist',
  Reject = 'reject',
  Withdraw = 'withdraw',
}

export const TRYOUT_DECISION_VALUE_VALUES: readonly TryoutDecisionValue[] =
  Object.values(TryoutDecisionValue);

/** Lifecycle of a candidate-facing offer. */
export enum OfferStatus {
  Draft = 'draft',
  Sent = 'sent',
  Accepted = 'accepted',
  Declined = 'declined',
  Expired = 'expired',
  Withdrawn = 'withdrawn',
}

export const OFFER_STATUS_VALUES: readonly OfferStatus[] =
  Object.values(OfferStatus);

/** The verbs the offer endpoint accepts. */
export enum OfferTransition {
  Send = 'send',
  Accept = 'accept',
  Decline = 'decline',
  Expire = 'expire',
  Withdraw = 'withdraw',
}

export const OFFER_TRANSITION_VALUES: readonly OfferTransition[] =
  Object.values(OfferTransition);

/** Why a registration was refused. Each is explainable to the registrant. */
export enum RegistrationRefusal {
  WindowClosed = 'window_closed',
  EventNotOpen = 'event_not_open',
  ConsentVersionMismatch = 'consent_version_mismatch',
  DuplicateCandidate = 'duplicate_candidate',
}

export const REGISTRATION_REFUSAL_VALUES: readonly RegistrationRefusal[] =
  Object.values(RegistrationRefusal);

/** The audience a candidate view is rendered for. */
export enum CandidateAudience {
  Public = 'public',
  Staff = 'staff',
  Restricted = 'restricted',
}

export const CANDIDATE_AUDIENCE_VALUES: readonly CandidateAudience[] =
  Object.values(CandidateAudience);
