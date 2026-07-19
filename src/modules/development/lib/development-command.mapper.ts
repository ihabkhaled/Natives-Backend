import type {
  FeedbackFields,
  FeedbackFieldsInput,
} from '../model/feedback.types';
import type {
  GoalAction,
  GoalActionInput,
  GoalContent,
  GoalContentInput,
} from '../model/goal.types';

/**
 * Normalizers from the loosely-typed transport inputs to the strict command
 * shapes. Every absent/undefined field becomes an explicit NULL (null-not-zero /
 * not-evaluated) so no downstream layer ever has to reason about `undefined`.
 * Keeping this off the controllers keeps route handlers a single delegation.
 */

export function toFeedbackFields(
  input: FeedbackFieldsInput | undefined,
): FeedbackFields {
  const fields = input ?? {};
  return {
    positiveFrisbee: fields.positiveFrisbee ?? null,
    frisbeeImprovement: fields.frisbeeImprovement ?? null,
    positiveMental: fields.positiveMental ?? null,
    mentalImprovement: fields.mentalImprovement ?? null,
    teamRole: fields.teamRole ?? null,
    recommendedPosition: fields.recommendedPosition ?? null,
    summary: fields.summary ?? null,
    coachNote: fields.coachNote ?? null,
  };
}

export function toGoalContent(input: GoalContentInput): GoalContent {
  return {
    feedbackId: input.feedbackId ?? null,
    metricDefinitionId: input.metricDefinitionId ?? null,
    ownerUserId: input.ownerUserId ?? null,
    title: input.title,
    description: input.description ?? null,
    measurableTarget: input.measurableTarget ?? null,
    targetValue: input.targetValue ?? null,
    baselineValue: input.baselineValue ?? null,
    progressValue: input.progressValue ?? null,
    progressNote: input.progressNote ?? null,
    evidence: input.evidence ?? null,
    dueDate: input.dueDate ?? null,
    actions: toGoalActions(input.actions),
  };
}

function toGoalActions(
  actions: readonly GoalActionInput[] | undefined,
): readonly GoalAction[] {
  return (actions ?? []).map(action => ({
    description: action.description,
    sortOrder: action.sortOrder,
    done: action.done ?? false,
    dueDate: action.dueDate ?? null,
  }));
}
