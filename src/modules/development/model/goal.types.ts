import type { PagedResult } from './development.types';
import type { GoalStatus, GoalTransition } from './goal.enums';

// --- Domain aggregate --------------------------------------------------------

/** A single action-plan step attached to a development goal. */
export interface GoalAction {
  readonly description: string;
  readonly sortOrder: number;
  readonly done: boolean;
  readonly dueDate: string | null;
}

/**
 * A development goal owned by a member. Numeric fields are null-not-zero: an
 * unmeasured target/baseline/progress is NULL, never coerced to 0. `metricLinkId`
 * ties the goal to an assessment metric definition when the target is measurable.
 */
export interface DevelopmentGoal {
  readonly id: string;
  readonly teamId: string;
  readonly seasonId: string | null;
  readonly membershipId: string;
  readonly feedbackId: string | null;
  readonly metricDefinitionId: string | null;
  readonly ownerUserId: string | null;
  readonly title: string;
  readonly description: string | null;
  readonly measurableTarget: string | null;
  readonly targetValue: number | null;
  readonly baselineValue: number | null;
  readonly progressValue: number | null;
  readonly progressNote: string | null;
  readonly evidence: string | null;
  readonly status: GoalStatus;
  readonly dueDate: string | null;
  readonly completedAt: Date | null;
  readonly reviewNote: string | null;
  readonly reviewedAt: Date | null;
  readonly reviewedBy: string | null;
  readonly recordVersion: number;
  readonly createdBy: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** A goal together with its ordered action-plan steps. */
export interface DevelopmentGoalDetail {
  readonly goal: DevelopmentGoal;
  readonly actions: readonly GoalAction[];
}

export type DevelopmentGoalDetailPage = PagedResult<DevelopmentGoalDetail>;

// --- Application command models ----------------------------------------------

/** A loosely-typed action-plan step as it arrives from the transport DTO. */
export interface GoalActionInput {
  readonly description: string;
  readonly sortOrder: number;
  readonly done?: boolean;
  readonly dueDate?: string | null;
}

/**
 * The loosely-typed goal content as it arrives from the transport DTO (optional
 * properties). The command mapper normalizes this into {@link GoalContent}.
 */
export interface GoalContentInput {
  readonly feedbackId?: string | null;
  readonly metricDefinitionId?: string | null;
  readonly ownerUserId?: string | null;
  readonly title: string;
  readonly description?: string | null;
  readonly measurableTarget?: string | null;
  readonly targetValue?: number | null;
  readonly baselineValue?: number | null;
  readonly progressValue?: number | null;
  readonly progressNote?: string | null;
  readonly evidence?: string | null;
  readonly dueDate?: string | null;
  readonly actions?: readonly GoalActionInput[];
}

/** The editable goal content shared by create and update. */
export interface GoalContent {
  readonly feedbackId: string | null;
  readonly metricDefinitionId: string | null;
  readonly ownerUserId: string | null;
  readonly title: string;
  readonly description: string | null;
  readonly measurableTarget: string | null;
  readonly targetValue: number | null;
  readonly baselineValue: number | null;
  readonly progressValue: number | null;
  readonly progressNote: string | null;
  readonly evidence: string | null;
  readonly dueDate: string | null;
  readonly actions: readonly GoalAction[];
}

export interface CreateGoalCommand {
  readonly membershipId: string;
  readonly seasonId: string | null;
  readonly content: GoalContent;
}

export interface UpdateGoalCommand {
  readonly expectedRecordVersion: number;
  readonly content: GoalContent;
}

export interface TransitionGoalCommand {
  readonly transition: GoalTransition;
  readonly expectedRecordVersion: number;
}

export interface ReviewGoalCommand {
  readonly expectedRecordVersion: number;
  readonly reviewNote: string | null;
  readonly progressValue: number | null;
  readonly progressNote: string | null;
  readonly evidence: string | null;
}

// --- Persistence write models ------------------------------------------------

export interface NewDevelopmentGoal {
  readonly id: string;
  readonly teamId: string;
  readonly seasonId: string | null;
  readonly membershipId: string;
  readonly status: GoalStatus;
  readonly content: GoalContent;
  readonly createdBy: string;
  readonly now: Date;
}

export interface GoalContentUpdate {
  readonly id: string;
  readonly teamId: string;
  readonly expectedRecordVersion: number;
  readonly content: GoalContent;
  readonly now: Date;
}

export interface GoalReview {
  readonly id: string;
  readonly teamId: string;
  readonly expectedRecordVersion: number;
  readonly reviewNote: string | null;
  readonly progressValue: number | null;
  readonly progressNote: string | null;
  readonly evidence: string | null;
  readonly reviewedBy: string;
  readonly now: Date;
}

export interface GoalStatusChange {
  readonly id: string;
  readonly teamId: string;
  readonly toStatus: GoalStatus;
  readonly expectedRecordVersion: number;
  readonly completedAt: Date | null;
  readonly now: Date;
}

export interface NewGoalAction {
  readonly id: string;
  readonly goalId: string;
  readonly description: string;
  readonly sortOrder: number;
  readonly done: boolean;
  readonly dueDate: string | null;
  readonly now: Date;
}
