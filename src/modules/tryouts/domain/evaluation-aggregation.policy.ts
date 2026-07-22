import {
  EvaluationRecommendation,
  EvaluationStatus,
} from '../model/tryouts.enums';
import type {
  EvaluationAggregate,
  TryoutEvaluation,
} from '../model/tryouts.types';

/**
 * Pure aggregation of several evaluators' ORIGINAL observations (UN-601).
 *
 * The aggregate is a summary for humans, never an automated verdict: it carries
 * counts and an average, and deliberately exposes NO recommendation of its own,
 * so nothing downstream can mistake it for the committee's decision.
 *
 * `averageRating` is null when nothing was scored — an unrated candidate is not
 * a zero-rated candidate — and private notes never enter the aggregate at all.
 */
export function aggregateEvaluations(
  candidateId: string,
  evaluations: readonly TryoutEvaluation[],
): EvaluationAggregate {
  const submitted = evaluations.filter(
    evaluation => evaluation.status === EvaluationStatus.Submitted,
  );
  return {
    candidateId,
    evaluatorCount: evaluations.length,
    submittedCount: submitted.length,
    attendedCount: submitted.filter(evaluation => evaluation.attended).length,
    averageRating: averageRating(submitted),
    recommendationCounts: countRecommendations(submitted),
    criteriaVersions: distinctCriteriaVersions(submitted),
  };
}

/** The mean of every recorded rating, or null when nothing was rated. */
export function averageRating(
  evaluations: readonly TryoutEvaluation[],
): number | null {
  const values = evaluations.flatMap(evaluation =>
    Object.values(evaluation.ratings),
  );
  if (values.length === 0) {
    return null;
  }
  const total = values.reduce((sum, value) => sum + value, 0);
  return total / values.length;
}

export function countRecommendations(
  evaluations: readonly TryoutEvaluation[],
): Readonly<Record<string, number>> {
  return Object.fromEntries(
    Object.values(EvaluationRecommendation).map(recommendation => [
      recommendation,
      evaluations.filter(
        evaluation => evaluation.recommendation === recommendation,
      ).length,
    ]),
  );
}

export function distinctCriteriaVersions(
  evaluations: readonly TryoutEvaluation[],
): readonly string[] {
  return [
    ...new Set(evaluations.map(evaluation => evaluation.criteriaVersion)),
  ].sort((left, right) => left.localeCompare(right));
}

/**
 * Whether enough evaluators have submitted for a decision to be well-founded.
 * This is ADVISORY: the committee may still decide, and the system never decides
 * on its own.
 */
export function hasQuorum(
  aggregate: EvaluationAggregate,
  requiredEvaluators: number,
): boolean {
  return aggregate.submittedCount >= requiredEvaluators;
}
