/** Raw `measurement_protocols` row as returned by the database driver. */
export interface MeasurementProtocolRow {
  readonly id: string;
  readonly team_id: string | null;
  readonly season_id: string | null;
  readonly protocol_key: string;
  readonly name: string;
  readonly description: string | null;
  readonly discipline: string;
  readonly unit: string;
  readonly direction: string;
  readonly result_policy: string;
  readonly instructions: string | null;
  readonly safety_notes: string | null;
  readonly min_value: string | null;
  readonly max_value: string | null;
  readonly status: string;
  readonly record_version: number;
  readonly created_by: string | null;
  readonly created_at: string | Date;
  readonly updated_at: string | Date;
}

/** Raw `measurement_sessions` row. */
export interface MeasurementSessionRow {
  readonly id: string;
  readonly team_id: string;
  readonly season_id: string | null;
  readonly title: string;
  readonly status: string;
  readonly scheduled_at: string | Date;
  readonly conducted_at: string | Date | null;
  readonly location: string | null;
  readonly conditions: string | null;
  readonly notes: string | null;
  readonly record_version: number;
  readonly created_by: string | null;
  readonly created_at: string | Date;
  readonly updated_at: string | Date;
}

/** Raw `measurement_attempts` row. */
export interface MeasurementAttemptRow {
  readonly id: string;
  readonly session_id: string;
  readonly team_id: string;
  readonly membership_id: string;
  readonly protocol_id: string;
  readonly attempt_number: number;
  readonly raw_value: string | null;
  readonly unit: string;
  readonly canonical_value: string | null;
  readonly valid: boolean;
  readonly disqualified: boolean;
  readonly dq_reason: string | null;
  readonly evaluator_user_id: string | null;
  readonly notes: string | null;
  readonly recorded_at: string | Date;
  readonly created_at: string | Date;
}

/** A generic count row. */
export interface CountRow {
  readonly count: number;
}

/** A single-column id probe row for existence checks. */
export interface IdRow {
  readonly id: string;
}

/** A single-column membership-id probe row. */
export interface MembershipIdRow {
  readonly membership_id: string;
}
