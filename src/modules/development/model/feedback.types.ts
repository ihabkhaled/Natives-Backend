import type { PagedResult } from './development.types';
import type { FeedbackStatus } from './feedback.enums';

// --- Domain aggregate --------------------------------------------------------

/**
 * The coach feedback aggregate (a single revision in a family chain). Every
 * structured field is null-not-zero / not-evaluated when NULL. `coachNote` is the
 * PRIVATE coach-only field: it is never shaped into a player view, a broad list,
 * an event payload, or an audit diff.
 */
export interface CoachFeedback {
  readonly id: string;
  readonly familyId: string;
  readonly teamId: string;
  readonly seasonId: string | null;
  readonly membershipId: string;
  readonly authorUserId: string;
  readonly status: FeedbackStatus;
  readonly revision: number;
  readonly recordVersion: number;
  readonly positiveFrisbee: string | null;
  readonly frisbeeImprovement: string | null;
  readonly positiveMental: string | null;
  readonly mentalImprovement: string | null;
  readonly teamRole: string | null;
  readonly recommendedPosition: string | null;
  readonly summary: string | null;
  readonly coachNote: string | null;
  readonly submittedAt: Date | null;
  readonly submittedBy: string | null;
  readonly publishedAt: Date | null;
  readonly publishedBy: string | null;
  readonly supersededAt: Date | null;
  readonly supersededById: string | null;
  readonly createdBy: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * The loosely-typed feedback fields as they arrive from the transport DTO (every
 * property optional). The command mapper normalizes this into {@link FeedbackFields}.
 */
export interface FeedbackFieldsInput {
  readonly positiveFrisbee?: string | null;
  readonly frisbeeImprovement?: string | null;
  readonly positiveMental?: string | null;
  readonly mentalImprovement?: string | null;
  readonly teamRole?: string | null;
  readonly recommendedPosition?: string | null;
  readonly summary?: string | null;
  readonly coachNote?: string | null;
}

/** The editable, structured coach-feedback fields (shared by create/update). */
export interface FeedbackFields {
  readonly positiveFrisbee: string | null;
  readonly frisbeeImprovement: string | null;
  readonly positiveMental: string | null;
  readonly mentalImprovement: string | null;
  readonly teamRole: string | null;
  readonly recommendedPosition: string | null;
  readonly summary: string | null;
  readonly coachNote: string | null;
}

/** A recorded player acknowledgement of a shared feedback. */
export interface FeedbackAcknowledgement {
  readonly id: string;
  readonly feedbackId: string;
  readonly membershipId: string;
  readonly userId: string;
  readonly acknowledgedAt: Date;
  readonly clarificationRequested: boolean;
  readonly clarificationNote: string | null;
}

/** A feedback together with any player acknowledgement (team detail view). */
export interface CoachFeedbackDetail {
  readonly feedback: CoachFeedback;
  readonly acknowledgement: FeedbackAcknowledgement | null;
}

// --- Read projections --------------------------------------------------------

/** A light row for the bounded team list (excludes ALL free-text fields). */
export interface FeedbackSummary {
  readonly id: string;
  readonly familyId: string;
  readonly teamId: string;
  readonly membershipId: string;
  readonly authorUserId: string;
  readonly status: FeedbackStatus;
  readonly revision: number;
  readonly recordVersion: number;
  readonly createdAt: Date;
  readonly publishedAt: Date | null;
}

/**
 * A published feedback shaped for the assessed player. It structurally CANNOT
 * carry the coach-only note — the field does not exist on this type — so private
 * coach observations cannot leak into a self view.
 */
export interface SharedFeedback {
  readonly id: string;
  readonly teamId: string;
  readonly membershipId: string;
  readonly status: FeedbackStatus;
  readonly revision: number;
  readonly positiveFrisbee: string | null;
  readonly frisbeeImprovement: string | null;
  readonly positiveMental: string | null;
  readonly mentalImprovement: string | null;
  readonly teamRole: string | null;
  readonly recommendedPosition: string | null;
  readonly summary: string | null;
  readonly publishedAt: Date | null;
  readonly acknowledgedAt: Date | null;
  readonly clarificationRequested: boolean;
}

export type FeedbackSummaryPage = PagedResult<FeedbackSummary>;
export type SharedFeedbackPage = PagedResult<SharedFeedback>;

export interface FeedbackRevisionHistory {
  readonly items: readonly FeedbackSummary[];
}

/** The current published/revised feedback owned by a user, with a total. */
export interface OwnFeedbackResult {
  readonly feedback: readonly CoachFeedback[];
  readonly acknowledgements: ReadonlyMap<string, FeedbackAcknowledgement>;
  readonly total: number;
}

// --- Application command models ----------------------------------------------

export interface CreateFeedbackCommand {
  readonly membershipId: string;
  readonly seasonId: string | null;
  readonly fields: FeedbackFields;
}

export interface UpdateFeedbackCommand {
  readonly expectedRecordVersion: number;
  readonly fields: FeedbackFields;
}

export interface FeedbackVersionCommand {
  readonly expectedRecordVersion: number;
}

export interface CorrectFeedbackCommand {
  readonly reason: string;
  readonly fields: FeedbackFields;
}

export interface AcknowledgeFeedbackCommand {
  readonly clarificationRequested: boolean;
  readonly clarificationNote: string | null;
}

// --- Persistence write models ------------------------------------------------

export interface NewCoachFeedback {
  readonly id: string;
  readonly familyId: string;
  readonly teamId: string;
  readonly seasonId: string | null;
  readonly membershipId: string;
  readonly authorUserId: string;
  readonly status: FeedbackStatus;
  readonly revision: number;
  readonly fields: FeedbackFields;
  readonly submittedAt: Date | null;
  readonly submittedBy: string | null;
  readonly publishedAt: Date | null;
  readonly publishedBy: string | null;
  readonly createdBy: string;
  readonly now: Date;
}

/** A workflow transition write (optimistic, stamping only the relevant actor). */
export interface FeedbackTransition {
  readonly id: string;
  readonly teamId: string;
  readonly toStatus: FeedbackStatus;
  readonly expectedRecordVersion: number;
  readonly submittedAt: Date | null;
  readonly submittedBy: string | null;
  readonly publishedAt: Date | null;
  readonly publishedBy: string | null;
  readonly now: Date;
}

/** Bookkeeping applied to the prior published row when a correction supersedes it. */
export interface FeedbackSupersede {
  readonly id: string;
  readonly supersededById: string;
  readonly now: Date;
}

export interface NewFeedbackAcknowledgement {
  readonly id: string;
  readonly feedbackId: string;
  readonly membershipId: string;
  readonly userId: string;
  readonly clarificationRequested: boolean;
  readonly clarificationNote: string | null;
  readonly now: Date;
}
