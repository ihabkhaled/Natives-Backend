/**
 * Read-only assessment signals published for cross-module dashboards. A count is
 * null when the underlying set is empty — never a zero standing in for "no
 * data" — and each signal carries the instant that makes it fresh.
 */

export interface AssessmentCountSignal {
  readonly count: number | null;
  readonly asOf: Date | null;
}

export interface AssessmentDashboardSignals {
  /** Published assessments the viewer can read about themselves. */
  readonly publishedForViewer: AssessmentCountSignal;
  /** Submitted assessments the team's coaches still have to review. */
  readonly awaitingReview: AssessmentCountSignal;
}

export interface AssessmentSignalScope {
  readonly teamId: string;
  readonly membershipId: string | null;
}
