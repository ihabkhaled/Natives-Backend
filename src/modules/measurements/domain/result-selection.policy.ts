import {
  MeasurementDirection,
  ResultPolicy,
} from '../model/measurements.enums';
import type {
  ResultSelection,
  SelectableAttempt,
} from '../model/measurements.types';

/**
 * Pure derivation of a protocol's single reported result from its raw attempts.
 * Raw attempts are never mutated — this computes the best (per direction), the
 * average, and the latest, then picks the one the protocol's policy selects. An
 * attempt is only considered when it is valid, not disqualified, and has a value:
 * a missing, invalid, or disqualified attempt is excluded, never treated as zero.
 * When nothing is considered, every figure is null (not zero). Every branch is
 * unit-tested.
 */
export function selectResult(
  attempts: readonly SelectableAttempt[],
  direction: MeasurementDirection,
  policy: ResultPolicy,
): ResultSelection {
  const values: number[] = [];
  let latest: number | null = null;
  let latestOrdinal = Number.NEGATIVE_INFINITY;
  for (const attempt of attempts) {
    if (!isConsidered(attempt) || attempt.value === null) {
      continue;
    }
    values.push(attempt.value);
    if (attempt.attemptNumber > latestOrdinal) {
      latest = attempt.value;
      latestOrdinal = attempt.attemptNumber;
    }
  }
  const best = selectBest(values, direction);
  const average = selectAverage(values);
  return {
    method: policy,
    direction,
    selected: selectByPolicy(policy, best, average, latest),
    best,
    average,
    latest,
    consideredCount: values.length,
    excludedCount: attempts.length - values.length,
  };
}

function isConsidered(attempt: SelectableAttempt): boolean {
  return attempt.valid && !attempt.disqualified && attempt.value !== null;
}

function selectBest(
  values: readonly number[],
  direction: MeasurementDirection,
): number | null {
  if (values.length === 0) {
    return null;
  }
  if (direction === MeasurementDirection.BetterHigher) {
    return Math.max(...values);
  }
  return Math.min(...values);
}

function selectAverage(values: readonly number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  const total = values.reduce((sum, value) => sum + value, 0);
  return total / values.length;
}

function selectByPolicy(
  policy: ResultPolicy,
  best: number | null,
  average: number | null,
  latest: number | null,
): number | null {
  if (policy === ResultPolicy.Best) {
    return best;
  }
  if (policy === ResultPolicy.Average) {
    return average;
  }
  return latest;
}
