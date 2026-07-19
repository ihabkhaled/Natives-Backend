import type {
  ActivityCategory,
  BuddyStatus,
  EvidenceKind,
  EvidenceScanStatus,
  PointsApproval,
  SubmissionStatus,
} from './activity.enums';

/**
 * Read-side projections returned by the API. These are the ONLY submission shapes
 * that leave the module: the member-facing views deliberately omit the reviewer
 * note and never carry an evidence storage reference. The evidence view (with the
 * private reference) is produced only for the reviewer-scoped endpoint.
 */

export interface ActivityTypeView {
  readonly id: string;
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
  readonly catalogVersion: number;
}

/** Member-safe submission projection — no reviewer note, no evidence reference. */
export interface SubmissionView {
  readonly id: string;
  readonly teamId: string;
  readonly seasonId: string | null;
  readonly membershipId: string;
  readonly activityTypeId: string;
  readonly status: SubmissionStatus;
  readonly performedOn: string;
  readonly durationMinutes: number | null;
  readonly quantity: number | null;
  readonly notes: string | null;
  readonly recordVersion: number;
  readonly submittedAt: string | null;
  readonly withdrawnAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface BuddyView {
  readonly id: string;
  readonly submissionId: string;
  readonly membershipId: string;
  readonly status: BuddyStatus;
  readonly respondedAt: string | null;
  readonly createdAt: string;
}

export interface SubmissionDetailView {
  readonly submission: SubmissionView;
  readonly buddies: readonly BuddyView[];
  readonly evidenceCount: number;
}

/** Reviewer-only evidence projection carrying the private storage reference. */
export interface EvidenceView {
  readonly id: string;
  readonly submissionId: string;
  readonly kind: EvidenceKind;
  readonly storageReference: string;
  readonly contentType: string | null;
  readonly byteSize: number | null;
  readonly description: string | null;
  readonly scanStatus: EvidenceScanStatus;
  readonly createdAt: string;
}
