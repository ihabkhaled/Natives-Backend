import type {
  CandidateAudience,
  CandidateReadiness,
  CandidateStatus,
  ContactChannel,
  EvaluationRecommendation,
  EvaluationStatus,
  OfferStatus,
  OfferTransition,
  RegistrationRefusal,
  TryoutDecisionValue,
  TryoutEventStatus,
  TryoutEventTransition,
  TryoutVisibility,
} from './tryouts.enums';

// --- Pagination --------------------------------------------------------------

export interface PageRequest {
  readonly limit: number;
  readonly offset: number;
}

export interface PagedResult<TItem> {
  readonly items: readonly TItem[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}

// --- Events ------------------------------------------------------------------

export interface TryoutEvent {
  readonly eventId: string;
  readonly teamId: string;
  readonly seasonId: string;
  readonly venueId: string | null;
  readonly name: string;
  readonly capacity: number | null;
  readonly registrationOpensAt: Date;
  readonly registrationClosesAt: Date;
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly visibility: TryoutVisibility;
  readonly consentVersion: string;
  readonly eligibilityNote: string | null;
  readonly retentionDays: number;
  readonly status: TryoutEventStatus;
  readonly recordVersion: number;
  readonly createdBy: string | null;
  readonly openedAt: Date | null;
  readonly closedAt: Date | null;
  readonly completedAt: Date | null;
  readonly cancelledAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface NewTryoutEvent {
  readonly id: string;
  readonly teamId: string;
  readonly seasonId: string;
  readonly venueId: string | null;
  readonly name: string;
  readonly capacity: number | null;
  readonly registrationOpensAt: string;
  readonly registrationClosesAt: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly visibility: TryoutVisibility;
  readonly consentVersion: string;
  readonly eligibilityNote: string | null;
  readonly retentionDays: number;
  readonly createdBy: string;
  readonly now: Date;
}

export interface TryoutEventContent {
  readonly seasonId: string;
  readonly venueId: string | null;
  readonly name: string;
  readonly capacity: number | null;
  readonly registrationOpensAt: string;
  readonly registrationClosesAt: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly visibility: TryoutVisibility;
  readonly consentVersion: string;
  readonly eligibilityNote: string | null;
  readonly retentionDays: number;
}

export interface TryoutEventContentInput {
  readonly seasonId: string;
  readonly venueId?: string | null;
  readonly name: string;
  readonly capacity?: number | null;
  readonly registrationOpensAt: string;
  readonly registrationClosesAt: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly visibility?: TryoutVisibility | null;
  readonly consentVersion: string;
  readonly eligibilityNote?: string | null;
  readonly retentionDays?: number | null;
}

export interface CreateTryoutEventCommand {
  readonly content: TryoutEventContent;
}

export interface TransitionTryoutEventCommand {
  readonly transition: TryoutEventTransition;
  readonly expectedRecordVersion: number;
}

export interface TryoutEventStatusChange {
  readonly id: string;
  readonly teamId: string;
  readonly expectedRecordVersion: number;
  readonly toStatus: TryoutEventStatus;
  readonly openedAt: Date | null;
  readonly closedAt: Date | null;
  readonly completedAt: Date | null;
  readonly cancelledAt: Date | null;
  readonly now: Date;
}

export type TryoutEventPage = PagedResult<TryoutEvent>;

// --- Candidates --------------------------------------------------------------

/**
 * A registrant. NOT a user and NOT a member: `convertedMembershipId` stays null
 * until an explicit, human-decided conversion. Contact and health fields are
 * restricted and are redacted by the privacy policy before they leave the app.
 */
export interface TryoutCandidate {
  readonly candidateId: string;
  readonly teamId: string;
  readonly eventId: string;
  readonly displayName: string;
  readonly identityHash: string;
  readonly contactChannel: ContactChannel;
  readonly contactReference: string | null;
  readonly priorSport: string | null;
  readonly referralSource: string | null;
  readonly motivation: string | null;
  readonly communicationOptIn: boolean;
  readonly consentVersion: string;
  readonly consentedAt: Date;
  readonly readiness: CandidateReadiness;
  readonly restrictedNotes: string | null;
  readonly status: CandidateStatus;
  readonly waitlistPosition: number | null;
  readonly checkedInAt: Date | null;
  readonly withdrawnAt: Date | null;
  readonly duplicateOfCandidateId: string | null;
  readonly convertedMembershipId: string | null;
  readonly convertedAt: Date | null;
  readonly retentionExpiresAt: Date;
  readonly anonymizedAt: Date | null;
  readonly recordVersion: number;
  readonly createdBy: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface NewTryoutCandidate {
  readonly id: string;
  readonly teamId: string;
  readonly eventId: string;
  readonly displayName: string;
  readonly identityHash: string;
  readonly contactChannel: ContactChannel;
  readonly contactReference: string | null;
  readonly priorSport: string | null;
  readonly referralSource: string | null;
  readonly motivation: string | null;
  readonly communicationOptIn: boolean;
  readonly consentVersion: string;
  readonly readiness: CandidateReadiness;
  readonly restrictedNotes: string | null;
  readonly status: CandidateStatus;
  readonly waitlistPosition: number | null;
  readonly retentionExpiresAt: Date;
  readonly createdBy: string | null;
  readonly now: Date;
}

export interface CandidateContent {
  readonly eventId: string;
  readonly displayName: string;
  readonly contactChannel: ContactChannel;
  readonly contactReference: string | null;
  readonly priorSport: string | null;
  readonly referralSource: string | null;
  readonly motivation: string | null;
  readonly communicationOptIn: boolean;
  readonly consentVersion: string;
  readonly readiness: CandidateReadiness;
  readonly restrictedNotes: string | null;
}

export interface CandidateContentInput {
  readonly eventId: string;
  readonly displayName: string;
  readonly contactChannel?: ContactChannel | null;
  readonly contactReference?: string | null;
  readonly priorSport?: string | null;
  readonly referralSource?: string | null;
  readonly motivation?: string | null;
  readonly communicationOptIn?: boolean | null;
  readonly consentVersion: string;
  readonly readiness?: CandidateReadiness | null;
  readonly restrictedNotes?: string | null;
}

export interface RegisterCandidateCommand {
  readonly content: CandidateContent;
}

export interface WithdrawCandidateCommand {
  readonly reason: string;
  readonly expectedRecordVersion: number;
}

export interface CandidateStatusChange {
  readonly id: string;
  readonly teamId: string;
  readonly expectedRecordVersion: number;
  readonly toStatus: CandidateStatus;
  readonly checkedInAt: Date | null;
  readonly withdrawnAt: Date | null;
  readonly now: Date;
}

export type TryoutCandidatePage = PagedResult<TryoutCandidate>;

export interface CandidateListFilter {
  readonly eventId: string | null;
  readonly status: CandidateStatus | null;
  readonly readiness: CandidateReadiness | null;
}

export interface CandidateListFilterInput {
  readonly eventId?: string | null;
  readonly status?: CandidateStatus | null;
  readonly readiness?: CandidateReadiness | null;
}

/** The permissions that decide how much of a candidate a caller may read. */
export interface CandidateViewer {
  readonly audience: CandidateAudience;
  readonly canReadContacts: boolean;
  readonly canReadReadiness: boolean;
}

/** The refusal verdict of a registration attempt. */
export interface RegistrationVerdict {
  readonly accepted: boolean;
  readonly refusal: RegistrationRefusal | null;
  readonly waitlisted: boolean;
}

// --- Evaluations -------------------------------------------------------------

export interface TryoutEvaluation {
  readonly evaluationId: string;
  readonly teamId: string;
  readonly candidateId: string;
  readonly evaluatorUserId: string;
  readonly criteriaVersion: string;
  readonly attended: boolean;
  readonly ratings: Readonly<Record<string, number>>;
  readonly observations: string | null;
  readonly privateNotes: string | null;
  readonly recommendation: EvaluationRecommendation;
  readonly status: EvaluationStatus;
  readonly recordVersion: number;
  readonly submittedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface EvaluationUpsert {
  readonly id: string;
  readonly teamId: string;
  readonly candidateId: string;
  readonly evaluatorUserId: string;
  readonly criteriaVersion: string;
  readonly attended: boolean;
  readonly ratings: Readonly<Record<string, number>>;
  readonly observations: string | null;
  readonly privateNotes: string | null;
  readonly recommendation: EvaluationRecommendation;
  readonly status: EvaluationStatus;
  readonly submittedAt: Date | null;
  readonly now: Date;
}

export interface EvaluationContent {
  readonly criteriaVersion: string;
  readonly attended: boolean;
  readonly ratings: Readonly<Record<string, number>>;
  readonly observations: string | null;
  readonly privateNotes: string | null;
  readonly recommendation: EvaluationRecommendation;
  readonly submit: boolean;
}

export interface EvaluationContentInput {
  readonly criteriaVersion: string;
  readonly attended?: boolean | null;
  readonly ratings?: Readonly<Record<string, number>> | null;
  readonly observations?: string | null;
  readonly privateNotes?: string | null;
  readonly recommendation?: EvaluationRecommendation | null;
  readonly submit?: boolean | null;
}

export interface SubmitEvaluationCommand {
  readonly content: EvaluationContent;
}

/**
 * The read-only aggregate of several evaluators' originals. `averageRating` is
 * null when nobody scored a criterion — never zero — and the aggregate carries
 * NO recommendation of its own: it summarises, it never decides.
 */
export interface EvaluationAggregate {
  readonly candidateId: string;
  readonly evaluatorCount: number;
  readonly submittedCount: number;
  readonly attendedCount: number;
  readonly averageRating: number | null;
  readonly recommendationCounts: Readonly<Record<string, number>>;
  readonly criteriaVersions: readonly string[];
}

// --- Decisions and offers ----------------------------------------------------

export interface TryoutDecision {
  readonly decisionId: string;
  readonly teamId: string;
  readonly candidateId: string;
  readonly decision: TryoutDecisionValue;
  readonly reasons: string;
  readonly criteriaVersion: string;
  readonly evaluatorCount: number;
  readonly decidedBy: string | null;
  readonly decidedAt: Date;
}

export interface NewTryoutDecision {
  readonly id: string;
  readonly teamId: string;
  readonly candidateId: string;
  readonly decision: TryoutDecisionValue;
  readonly reasons: string;
  readonly criteriaVersion: string;
  readonly evaluatorCount: number;
  readonly decidedBy: string;
  readonly now: Date;
}

export interface RecordDecisionCommand {
  readonly decision: TryoutDecisionValue;
  readonly reasons: string;
  readonly criteriaVersion: string;
  readonly expectedRecordVersion: number;
}

export interface TryoutOffer {
  readonly offerId: string;
  readonly teamId: string;
  readonly candidateId: string;
  readonly status: OfferStatus;
  readonly candidateMessage: string | null;
  readonly expiresAt: Date;
  readonly sentAt: Date | null;
  readonly respondedAt: Date | null;
  readonly recordVersion: number;
  readonly createdBy: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface NewTryoutOffer {
  readonly id: string;
  readonly teamId: string;
  readonly candidateId: string;
  readonly candidateMessage: string | null;
  readonly expiresAt: Date;
  readonly createdBy: string;
  readonly now: Date;
}

export interface OfferStatusChange {
  readonly id: string;
  readonly teamId: string;
  readonly expectedRecordVersion: number;
  readonly toStatus: OfferStatus;
  readonly sentAt: Date | null;
  readonly respondedAt: Date | null;
  readonly now: Date;
}

export interface ManageOfferCommand {
  readonly transition: OfferTransition;
  readonly candidateMessage: string | null;
  readonly expectedRecordVersion: number;
}

// --- Conversion --------------------------------------------------------------

export interface ConvertCandidateCommand {
  readonly seasonId: string | null;
  readonly userId: string | null;
  readonly expectedRecordVersion: number;
}

/** The result of an idempotent conversion. `created` is false on a replay. */
export interface ConversionResult {
  readonly candidateId: string;
  readonly membershipId: string;
  readonly created: boolean;
}

/** A resolved membership insert for a converted candidate. */
export interface CandidateMembership {
  readonly id: string;
  readonly teamId: string;
  readonly seasonId: string | null;
  readonly userId: string | null;
  readonly createdBy: string;
  readonly now: Date;
}

// --- Reporting ---------------------------------------------------------------

/**
 * The privacy-safe tryout funnel: counts per status only. No names, no contact
 * detail, no ratings — a funnel is an operational metric, not a dossier.
 */
export interface TryoutFunnelReport {
  readonly eventId: string;
  readonly registered: number;
  readonly waitlisted: number;
  readonly checkedIn: number;
  readonly noShow: number;
  readonly withdrawn: number;
  readonly accepted: number;
  readonly rejected: number;
  readonly converted: number;
  readonly evaluators: readonly EvaluatorCompletion[];
}

/** One evaluator's completion progress. Identity by user id only. */
export interface EvaluatorCompletion {
  readonly evaluatorUserId: string;
  readonly assigned: number;
  readonly submitted: number;
}

/** The reconciliation of one retention/anonymization sweep. */
export interface RetentionReport {
  readonly examined: number;
  readonly anonymized: number;
  readonly candidateIds: readonly string[];
}

/** The resolved team/season scope of a tryout operation. */
export interface TryoutScope {
  readonly teamId: string;
  readonly seasonId: string;
}
