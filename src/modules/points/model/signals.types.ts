/**
 * Read-only points signals published for cross-module dashboards. Every value is
 * a ledger projection computed on read — never a stored, editable total — and is
 * null when the member has no ledger history at all, never a zero standing in
 * for "not evaluated".
 */

export interface PointsStandingSignal {
  /** Net ledger total for the member, or null when they have no entries. */
  readonly total: number | null;
  /** Dense rank within the team's scoped standings, or null when unranked. */
  readonly rank: number | null;
  /** How many members are ranked in the same scope, or null when none are. */
  readonly population: number | null;
  /** Instant of the member's most recent ledger entry, or null. */
  readonly asOf: Date | null;
}

export interface PointsSignalScope {
  readonly teamId: string;
  readonly seasonId: string | null;
  readonly membershipId: string | null;
}
