/** Raw `report_jobs` row. */
export interface ReportJobRow {
  readonly id: string;
  readonly team_id: string;
  readonly season_id: string | null;
  readonly template: string;
  readonly format: string;
  readonly privacy_class: string;
  readonly parameters: unknown;
  readonly request_hash: string;
  readonly status: string;
  readonly progress: number | string;
  readonly retry_count: number | string;
  readonly calculation_version: string;
  readonly snapshot_at: string | Date;
  readonly storage_reference: string | null;
  readonly checksum: string | null;
  readonly row_count: number | string | null;
  readonly failure_reason: string | null;
  readonly expires_at: string | Date;
  readonly record_version: number | string;
  readonly requested_by: string | null;
  readonly started_at: string | Date | null;
  readonly completed_at: string | Date | null;
  readonly failed_at: string | Date | null;
  readonly created_at: string | Date;
  readonly updated_at: string | Date;
}

/** A generic count row. */
export interface ReportCountRow {
  readonly count: number | string;
}

/** A single-column id probe row. */
export interface ReportIdRow {
  readonly id: string;
}

/** Raw attendance aggregate row for the attendance dataset. */
export interface AttendanceDataRow {
  readonly membership_id: string;
  readonly attended: number | string;
  readonly total: number | string;
}

/** Raw points aggregate row for the leaderboard dataset. */
export interface LeaderboardDataRow {
  readonly membership_id: string;
  readonly total: number | string;
}

/** Raw roster row for the roster dataset. */
export interface RosterDataRow {
  readonly membership_id: string;
  readonly status: string;
  readonly jersey_number: number | string | null;
}
