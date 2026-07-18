/**
 * Raw persistence row shapes (snake_case) returned by the practices SQL layer.
 * Repositories map these into vendor-free domain types so implementation files
 * stay free of inline declarations. Array columns (`weekdays int[]`,
 * `exceptions text[]`) arrive as native JS arrays from the driver; timestamptz
 * columns arrive as `Date` or ISO string; date-only columns arrive as strings.
 */

export interface ScheduleRow {
  readonly id: string;
  readonly team_id: string;
  readonly season_id: string | null;
  readonly name: string;
  readonly session_type: string;
  readonly timezone: string;
  readonly frequency: string;
  readonly interval_weeks: number;
  readonly weekdays: readonly number[];
  readonly start_time_local: string;
  readonly duration_minutes: number;
  readonly meet_offset_minutes: number | null;
  readonly rsvp_cutoff_minutes: number | null;
  readonly default_venue_id: string | null;
  readonly default_field: string | null;
  readonly default_capacity: number | null;
  readonly visibility: string;
  readonly organizer_user_id: string | null;
  readonly notes: string | null;
  readonly generation_start: string;
  readonly generation_until: string;
  readonly exceptions: readonly string[];
  readonly status: string;
  readonly created_by: string | null;
  readonly updated_by: string | null;
  readonly created_at: string | Date;
  readonly updated_at: string | Date;
  readonly version: number;
}

export interface SessionRow {
  readonly id: string;
  readonly team_id: string;
  readonly season_id: string | null;
  readonly schedule_id: string | null;
  readonly occurrence_date: string | null;
  readonly session_type: string;
  readonly timezone: string;
  readonly venue_id: string | null;
  readonly field: string | null;
  readonly capacity: number | null;
  readonly meet_at: string | Date | null;
  readonly starts_at: string | Date;
  readonly ends_at: string | Date;
  readonly rsvp_cutoff_at: string | Date | null;
  readonly visibility: string;
  readonly organizer_user_id: string | null;
  readonly notes: string | null;
  readonly status: string;
  readonly cancellation_reason: string | null;
  readonly created_by: string | null;
  readonly updated_by: string | null;
  readonly created_at: string | Date;
  readonly updated_at: string | Date;
  readonly version: number;
}

export interface StatusEventRow {
  readonly id: string;
  readonly session_id: string;
  readonly from_status: string | null;
  readonly to_status: string;
  readonly reason: string | null;
  readonly actor_user_id: string | null;
  readonly occurred_at: string | Date;
}

export interface OccurrenceDateRow {
  readonly occurrence_date: string;
}

export interface CountRow {
  readonly count: number;
}

export interface IdRow {
  readonly id: string;
}
