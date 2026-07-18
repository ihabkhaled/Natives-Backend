/**
 * Raw persistence row shapes (snake_case) returned by the attendance SQL layer.
 * Repositories map these into vendor-free domain types so implementation files
 * stay free of inline declarations. timestamptz columns arrive as `Date` or ISO
 * string; boolean columns arrive as native booleans; jsonb arrives already parsed.
 */

export interface AttendanceSheetRow {
  readonly id: string;
  readonly session_id: string;
  readonly team_id: string;
  readonly season_id: string | null;
  readonly state: string;
  readonly finalized_at: string | Date | null;
  readonly finalized_by: string | null;
  readonly created_by: string | null;
  readonly updated_by: string | null;
  readonly created_at: string | Date;
  readonly updated_at: string | Date;
  readonly version: number;
}

export interface AttendanceRecordRow {
  readonly id: string;
  readonly sheet_id: string;
  readonly session_id: string;
  readonly team_id: string;
  readonly season_id: string | null;
  readonly membership_id: string;
  readonly user_id: string | null;
  readonly status: string;
  readonly check_in_at: string | Date | null;
  readonly check_out_at: string | Date | null;
  readonly lateness_minutes: number | null;
  readonly excuse_category: string | null;
  readonly note: string | null;
  readonly evidence_ref: string | null;
  readonly source: string;
  readonly recorded_by: string | null;
  readonly recorded_at: string | Date;
  readonly created_by: string | null;
  readonly updated_by: string | null;
  readonly created_at: string | Date;
  readonly updated_at: string | Date;
  readonly version: number;
}

export interface AttendanceRevisionRow {
  readonly id: string;
  readonly record_id: string;
  readonly session_id: string;
  readonly membership_id: string;
  readonly from_status: string | null;
  readonly to_status: string;
  readonly lateness_minutes: number | null;
  readonly excuse_category: string | null;
  readonly source: string;
  readonly is_correction: boolean;
  readonly correction_reason: string | null;
  readonly actor_user_id: string | null;
  readonly occurred_at: string | Date;
}

export interface AttendanceScoringRuleRow {
  readonly code: string;
  readonly status: string;
  readonly weights: unknown;
  readonly default_weight: number;
  readonly late_penalty: number;
  readonly absent_penalty: number;
  readonly excused_excluded: boolean;
}

export interface RosterEntryRow {
  readonly membership_id: string;
  readonly user_id: string | null;
  readonly status: string | null;
  readonly check_in_at: string | Date | null;
  readonly lateness_minutes: number | null;
  readonly excuse_category: string | null;
  readonly source: string | null;
  readonly version: number | null;
}

export interface ParticipationFactRow {
  readonly status: string;
  readonly session_type: string;
  readonly count: number;
}

export interface AttendanceCountRow {
  readonly count: number;
}

export interface AttendanceMembershipRow {
  readonly id: string;
  readonly user_id: string | null;
}
