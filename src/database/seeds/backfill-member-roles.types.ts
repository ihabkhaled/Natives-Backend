/** One membership whose linked user holds no live role in its team. */
export interface BackfillCandidate {
  readonly membershipId: string;
  readonly userId: string;
  readonly teamId: string;
}

/** Raw candidate row (snake_case) as the reconciliation query returns it. */
export interface BackfillCandidateRow {
  readonly membership_id: string;
  readonly user_id: string;
  readonly team_id: string;
}

/** Outcome of one backfill invocation. */
export interface BackfillResult {
  readonly candidates: readonly BackfillCandidate[];
  readonly applied: boolean;
}

/** A single id row returned by lookups/inserts. */
export interface BackfillIdRow {
  readonly id: string;
}
