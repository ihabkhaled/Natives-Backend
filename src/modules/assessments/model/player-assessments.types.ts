import type { PagedResult } from './assessments.types';
import type {
  PlayerAssessmentStatus,
  ReviewDecision,
} from './player-assessments.enums';

// --- Domain aggregates -------------------------------------------------------

/**
 * One per-metric observation. `numericValue`/`textValue` are null-not-zero: a
 * NULL is "not evaluated", never coerced to a measured zero. `note` is a private
 * evaluator observation excluded from player-facing views.
 */
export interface PlayerAssessmentValue {
  readonly metricDefinitionId: string;
  readonly numericValue: number | null;
  readonly textValue: string | null;
  readonly note: string | null;
  readonly confidence: number | null;
  readonly observationCount: number | null;
}

/** The player-assessment aggregate row (a single revision in a family chain). */
export interface PlayerAssessment {
  readonly id: string;
  readonly familyId: string;
  readonly teamId: string;
  readonly seasonId: string | null;
  readonly periodId: string;
  readonly templateId: string;
  readonly membershipId: string;
  readonly evaluatorUserId: string;
  readonly status: PlayerAssessmentStatus;
  readonly revision: number;
  readonly summary: string | null;
  readonly recordVersion: number;
  readonly submittedAt: Date | null;
  readonly submittedBy: string | null;
  readonly reviewedAt: Date | null;
  readonly reviewedBy: string | null;
  readonly publishedAt: Date | null;
  readonly publishedBy: string | null;
  readonly supersededAt: Date | null;
  readonly supersededById: string | null;
  readonly createdBy: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** An assessment together with its ordered per-metric values. */
export interface PlayerAssessmentDetail {
  readonly assessment: PlayerAssessment;
  readonly values: readonly PlayerAssessmentValue[];
}

/** A required/optional metric slot with its scale bounds, pinned from a template. */
export interface TemplateMetricBound {
  readonly metricDefinitionId: string;
  readonly required: boolean;
  readonly minimumValue: number | null;
  readonly maximumValue: number | null;
}

/** Resolved authoring context for a period: its published template + metrics. */
export interface PlayerAssessmentContext {
  readonly templateId: string;
  readonly seasonId: string | null;
  readonly metrics: readonly TemplateMetricBound[];
}

// --- Application command models ----------------------------------------------

export interface AssessmentValueInput {
  readonly metricDefinitionId: string;
  readonly numericValue: number | null;
  readonly textValue: string | null;
  readonly note: string | null;
  readonly confidence: number | null;
  readonly observationCount: number | null;
}

export interface CreatePlayerAssessmentCommand {
  readonly periodId: string;
  readonly membershipId: string;
  readonly summary: string | null;
  readonly values: readonly AssessmentValueInput[];
}

export interface UpdatePlayerAssessmentCommand {
  readonly expectedRecordVersion: number;
  readonly summary: string | null;
  readonly values: readonly AssessmentValueInput[];
}

export interface SubmitPlayerAssessmentCommand {
  readonly expectedRecordVersion: number;
}

export interface ReviewPlayerAssessmentCommand {
  readonly decision: ReviewDecision;
  readonly expectedRecordVersion: number;
  readonly note: string | null;
}

export interface PublishPlayerAssessmentCommand {
  readonly expectedRecordVersion: number;
}

export interface CorrectPlayerAssessmentCommand {
  readonly reason: string;
  readonly summary: string | null;
  readonly values: readonly AssessmentValueInput[];
}

// --- Persistence write models ------------------------------------------------

export interface NewPlayerAssessment {
  readonly id: string;
  readonly familyId: string;
  readonly teamId: string;
  readonly seasonId: string | null;
  readonly periodId: string;
  readonly templateId: string;
  readonly membershipId: string;
  readonly evaluatorUserId: string;
  readonly status: PlayerAssessmentStatus;
  readonly revision: number;
  readonly summary: string | null;
  readonly reviewedBy: string | null;
  readonly reviewedAt: Date | null;
  readonly publishedBy: string | null;
  readonly publishedAt: Date | null;
  readonly createdBy: string;
  readonly now: Date;
}

export interface NewPlayerAssessmentValue {
  readonly id: string;
  readonly assessmentId: string;
  readonly metricDefinitionId: string;
  readonly numericValue: number | null;
  readonly textValue: string | null;
  readonly note: string | null;
  readonly confidence: number | null;
  readonly observationCount: number | null;
  readonly now: Date;
}

/** A workflow transition write (optimistic, stamping only the relevant actor). */
export interface AssessmentTransition {
  readonly id: string;
  readonly teamId: string;
  readonly toStatus: PlayerAssessmentStatus;
  readonly expectedRecordVersion: number;
  readonly submittedAt: Date | null;
  readonly submittedBy: string | null;
  readonly reviewedAt: Date | null;
  readonly reviewedBy: string | null;
  readonly publishedAt: Date | null;
  readonly publishedBy: string | null;
  readonly now: Date;
}

/** Bookkeeping applied to the prior published row when a correction supersedes it. */
export interface AssessmentSupersede {
  readonly id: string;
  readonly supersededById: string;
  readonly now: Date;
}

// --- Read projections --------------------------------------------------------

/** A light row for the bounded team list of player assessments. */
export interface PlayerAssessmentSummary {
  readonly id: string;
  readonly familyId: string;
  readonly teamId: string;
  readonly periodId: string;
  readonly membershipId: string;
  readonly evaluatorUserId: string;
  readonly status: PlayerAssessmentStatus;
  readonly revision: number;
  readonly recordVersion: number;
  readonly createdAt: Date;
  readonly publishedAt: Date | null;
}

/** A per-metric value shaped for a player: private notes/confidence removed. */
export interface PlayerPublishedValue {
  readonly metricDefinitionId: string;
  readonly numericValue: number | null;
  readonly textValue: string | null;
}

/** A published assessment shaped for the assessed player (member-visible only). */
export interface PlayerPublishedAssessment {
  readonly id: string;
  readonly teamId: string;
  readonly periodId: string;
  readonly templateId: string;
  readonly membershipId: string;
  readonly status: PlayerAssessmentStatus;
  readonly revision: number;
  readonly summary: string | null;
  readonly publishedAt: Date | null;
  readonly values: readonly PlayerPublishedValue[];
}

export type PlayerAssessmentSummaryPage = PagedResult<PlayerAssessmentSummary>;
export type PlayerPublishedAssessmentPage =
  PagedResult<PlayerPublishedAssessment>;

export interface RevisionHistory {
  readonly items: readonly PlayerAssessmentSummary[];
}

/** The current published/revised assessments owned by a user, with a total. */
export interface OwnPublishedResult {
  readonly assessments: readonly PlayerAssessment[];
  readonly total: number;
}
