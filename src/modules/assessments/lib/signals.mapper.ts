import type { AssessmentSignalCountRow } from '../model/signals.rows';
import type { AssessmentCountSignal } from '../model/signals.types';

/**
 * Interpret an aggregate row as a signal. An aggregate over an empty set still
 * returns one row with count 0; that means "nothing to report", so the signal is
 * null rather than a zero a client would render as a real measurement.
 */
export function toAssessmentCountSignal(
  rows: readonly AssessmentSignalCountRow[],
): AssessmentCountSignal {
  const row = rows[0];
  if (row === undefined || row.count === 0) {
    return { count: null, asOf: null };
  }
  const boundary = row.boundary_at;
  if (boundary === null) {
    return { count: row.count, asOf: null };
  }
  return {
    count: row.count,
    asOf: boundary instanceof Date ? boundary : new Date(boundary),
  };
}
