/** Raw standings row returned by the points dashboard-signal SQL. */
export interface PointsStandingRow {
  readonly total: string | number;
  readonly rank: number;
  readonly population: number;
  readonly latest_at: string | Date | null;
}
