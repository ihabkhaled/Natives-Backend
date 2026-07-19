import type {
  AbuseSignal,
  ActivityCategory,
  ActivityTypeStatus,
  BuddyStatus,
  EvidenceKind,
  EvidenceScanStatus,
  PointsApproval,
  ReviewDecision,
  SubmissionStatus,
} from './activity.enums';

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

// --- Domain aggregates -------------------------------------------------------

/**
 * A versioned activity-type catalog entry. `defaultPointValue` is a CANDIDATE and
 * is null-not-zero: a WFDF/custom type keeps it NULL with `pointsApproval` pending
 * until a rules owner approves it. Duration bounds are optional server limits.
 */
export interface ActivityType {
  readonly id: string;
  readonly familyId: string;
  readonly typeKey: string;
  readonly name: string;
  readonly description: string;
  readonly category: ActivityCategory;
  readonly unit: string | null;
  readonly defaultPointValue: number | null;
  readonly pointsApproval: PointsApproval;
  readonly requiresEvidence: boolean;
  readonly minDurationMinutes: number | null;
  readonly maxDurationMinutes: number | null;
  readonly status: ActivityTypeStatus;
  readonly catalogVersion: number;
  readonly createdAt: Date;
}

/**
 * A member's external-training submission (a claim, never awarded points).
 * Duration and quantity are null-not-zero. `reviewNote` is a reviewer-side field
 * (prompt 401) exposed only to reviewers, never in a member self view.
 */
export interface ActivitySubmission {
  readonly id: string;
  readonly teamId: string;
  readonly seasonId: string | null;
  readonly membershipId: string;
  readonly activityTypeId: string;
  readonly submitterUserId: string;
  readonly status: SubmissionStatus;
  readonly performedOn: string;
  readonly durationMinutes: number | null;
  readonly quantity: number | null;
  readonly notes: string | null;
  readonly reviewNote: string | null;
  readonly recordVersion: number;
  readonly submittedAt: Date | null;
  readonly submittedBy: string | null;
  readonly reviewedAt: Date | null;
  readonly reviewedBy: string | null;
  readonly reviewerUserId: string | null;
  readonly reviewStartedAt: Date | null;
  readonly reversalReason: string | null;
  readonly reversedAt: Date | null;
  readonly reversedBy: string | null;
  readonly withdrawnAt: Date | null;
  readonly createdBy: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * An evidence record: metadata + a PRIVATE storage reference only (no bytes). The
 * reference is reviewer-scoped and never projected to a member view.
 */
export interface ActivityEvidence {
  readonly id: string;
  readonly submissionId: string;
  readonly kind: EvidenceKind;
  readonly storageReference: string;
  readonly contentType: string | null;
  readonly byteSize: number | null;
  readonly description: string | null;
  readonly scanStatus: EvidenceScanStatus;
  readonly createdBy: string | null;
  readonly createdAt: Date;
}

/** A credited co-participant on one submission with its confirmation state. */
export interface ActivityBuddy {
  readonly id: string;
  readonly submissionId: string;
  readonly membershipId: string;
  readonly status: BuddyStatus;
  readonly respondedAt: Date | null;
  readonly respondedBy: string | null;
  readonly createdAt: Date;
}

/** A submission with its co-participants and evidence count (member-safe). */
export interface ActivitySubmissionDetail {
  readonly submission: ActivitySubmission;
  readonly buddies: readonly ActivityBuddy[];
  readonly evidenceCount: number;
}

// --- Transport-shaped command inputs -----------------------------------------

/** Loosely-typed submission content as it arrives from the DTO. */
export interface SubmissionContentInput {
  readonly activityTypeId: string;
  readonly seasonId?: string | null;
  readonly performedOn: string;
  readonly durationMinutes?: number | null;
  readonly quantity?: number | null;
  readonly notes?: string | null;
}

/** Loosely-typed evidence attachment as it arrives from the DTO. */
export interface EvidenceInput {
  readonly kind: EvidenceKind;
  readonly storageReference: string;
  readonly contentType?: string | null;
  readonly byteSize?: number | null;
  readonly description?: string | null;
}

// --- Normalized command models -----------------------------------------------

/** The editable submission content shared by create and update. */
export interface SubmissionContent {
  readonly activityTypeId: string;
  readonly seasonId: string | null;
  readonly performedOn: string;
  readonly durationMinutes: number | null;
  readonly quantity: number | null;
  readonly notes: string | null;
}

export interface EvidenceItem {
  readonly kind: EvidenceKind;
  readonly storageReference: string;
  readonly contentType: string | null;
  readonly byteSize: number | null;
  readonly description: string | null;
}

export interface CreateSubmissionCommand {
  readonly content: SubmissionContent;
  readonly buddyMembershipIds: readonly string[];
  readonly evidence: readonly EvidenceItem[];
}

export interface UpdateSubmissionCommand {
  readonly expectedRecordVersion: number;
  readonly content: SubmissionContent;
  readonly evidence: readonly EvidenceItem[];
}

export interface SubmissionVersionCommand {
  readonly expectedRecordVersion: number;
}

// --- Persistence write models ------------------------------------------------

export interface NewActivitySubmission {
  readonly id: string;
  readonly teamId: string;
  readonly membershipId: string;
  readonly submitterUserId: string;
  readonly status: SubmissionStatus;
  readonly content: SubmissionContent;
  readonly now: Date;
}

export interface SubmissionContentUpdate {
  readonly id: string;
  readonly teamId: string;
  readonly expectedRecordVersion: number;
  readonly content: SubmissionContent;
  readonly now: Date;
}

export interface SubmissionStatusChange {
  readonly id: string;
  readonly teamId: string;
  readonly expectedRecordVersion: number;
  readonly toStatus: SubmissionStatus;
  readonly actorUserId: string;
  readonly now: Date;
}

export interface NewActivityEvidence {
  readonly id: string;
  readonly submissionId: string;
  readonly item: EvidenceItem;
  readonly createdBy: string;
  readonly now: Date;
}

export interface NewActivityBuddy {
  readonly id: string;
  readonly submissionId: string;
  readonly membershipId: string;
  readonly status: BuddyStatus;
  readonly now: Date;
}

export interface BuddyResponseUpdate {
  readonly id: string;
  readonly toStatus: BuddyStatus;
  readonly actorUserId: string;
  readonly now: Date;
}

// --- Review / moderation (401) -----------------------------------------------

/** A reviewer claiming a submitted claim into review (submitted → under_review). */
export interface ReviewClaimChange {
  readonly id: string;
  readonly teamId: string;
  readonly expectedRecordVersion: number;
  readonly reviewerUserId: string;
  readonly now: Date;
}

/** A reviewer's decided transition with the structured reviewer note. */
export interface ReviewDecisionChange {
  readonly id: string;
  readonly teamId: string;
  readonly expectedRecordVersion: number;
  readonly toStatus: SubmissionStatus;
  readonly reviewNote: string | null;
  readonly reviewerUserId: string;
  readonly now: Date;
}

/** A correction of an approved claim (approved → reversed) with its reason. */
export interface ReviewReversalChange {
  readonly id: string;
  readonly teamId: string;
  readonly expectedRecordVersion: number;
  readonly reversalReason: string;
  readonly actorUserId: string;
  readonly now: Date;
}

/** Loosely-typed reviewer decision body as it arrives from the DTO. */
export interface ReviewDecisionInput {
  readonly expectedRecordVersion: number;
  readonly reviewNote?: string | null;
}

/** Loosely-typed correction body as it arrives from the DTO. */
export interface ReviewCorrectionInput {
  readonly expectedRecordVersion: number;
  readonly reason: string;
}

/** Transport-normalized moderation decision command from the reviewer DTO. */
export interface ReviewDecisionCommand {
  readonly expectedRecordVersion: number;
  readonly decision: ReviewDecision;
  readonly reviewNote: string | null;
}

/** Transport-normalized correction command from the correction DTO. */
export interface ReviewCorrectionCommand {
  readonly expectedRecordVersion: number;
  readonly reason: string;
}

/** Allowlisted, bounded, deterministic review-queue filter. */
export interface ReviewQueueQuery {
  readonly page: PageRequest;
  readonly statuses: readonly SubmissionStatus[];
  readonly activityTypeId: string | null;
  readonly membershipId: string | null;
}

/**
 * The measured facts an anti-abuse evaluation weighs. Counts come from bounded
 * repository probes; `today` is the frozen server clock's UTC calendar day. Pure
 * inputs so the signal policy is fully branch-testable without a database.
 */
export interface AbuseSignalFacts {
  readonly performedOn: string;
  readonly today: string;
  readonly durationMinutes: number | null;
  readonly sameDayLiveCount: number;
  readonly windowLiveCount: number;
  readonly maxBuddyRepeatCount: number;
}

/** The date bounds an anti-abuse probe scans (all YYYY-MM-DD, UTC). */
export interface AbuseProbeWindow {
  readonly windowFrom: string;
  readonly windowTo: string;
  readonly buddyFrom: string;
}

/** Bounded probe counts backing the anti-abuse evaluation. */
export interface AbuseCounts {
  readonly sameDay: number;
  readonly windowCount: number;
  readonly buddyRepeat: number;
}

/** A submission plus the anti-abuse signals raised for the reviewer to weigh. */
export interface ReviewSubmissionDetail {
  readonly submission: ActivitySubmission;
  readonly buddies: readonly ActivityBuddy[];
  readonly evidenceCount: number;
  readonly signals: readonly AbuseSignal[];
}
