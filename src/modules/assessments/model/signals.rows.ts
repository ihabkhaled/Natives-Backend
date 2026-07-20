/** Raw aggregate row returned by the assessments dashboard-signal SQL. */
export interface AssessmentSignalCountRow {
  readonly count: number;
  readonly boundary_at: string | Date | null;
}
