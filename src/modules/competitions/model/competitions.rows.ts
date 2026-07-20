/** Raw `competitions` row as returned by the database driver. */
export interface CompetitionRow {
  readonly id: string;
  readonly team_id: string;
  readonly season_id: string;
  readonly name: string;
  readonly competition_type: string;
  readonly status: string;
  readonly gender_division: string | null;
  readonly organizer_name: string | null;
  readonly external_ref: string | null;
  readonly starts_on: string | null;
  readonly ends_on: string | null;
  readonly description: string | null;
  readonly cancellation_reason: string | null;
  readonly record_version: number;
  readonly created_by: string | null;
  readonly published_by: string | null;
  readonly published_at: string | Date | null;
  readonly activated_at: string | Date | null;
  readonly completed_at: string | Date | null;
  readonly cancelled_at: string | Date | null;
  readonly archived_at: string | Date | null;
  readonly created_at: string | Date;
  readonly updated_at: string | Date;
}

/** Raw `competition_stages` row. */
export interface StageRow {
  readonly id: string;
  readonly competition_id: string;
  readonly name: string;
  readonly stage_format: string;
  readonly ordinal: number;
  readonly created_at: string | Date;
  readonly updated_at: string | Date;
}

/** Raw `competition_rounds` row. */
export interface RoundRow {
  readonly id: string;
  readonly stage_id: string;
  readonly competition_id: string;
  readonly name: string;
  readonly ordinal: number;
  readonly created_at: string | Date;
  readonly updated_at: string | Date;
}

/** Raw `opponents` row. */
export interface OpponentRow {
  readonly id: string;
  readonly team_id: string;
  readonly name: string;
  readonly short_name: string | null;
  readonly logo_ref: string | null;
  readonly contact_name: string | null;
  readonly contact_info: string | null;
  readonly notes: string | null;
  readonly status: string;
  readonly record_version: number;
  readonly created_by: string | null;
  readonly created_at: string | Date;
  readonly updated_at: string | Date;
}

/** Raw `fixtures` row. */
export interface FixtureRow {
  readonly id: string;
  readonly competition_id: string;
  readonly team_id: string;
  readonly season_id: string | null;
  readonly stage_id: string | null;
  readonly round_id: string | null;
  readonly opponent_id: string;
  readonly venue_id: string | null;
  readonly home_away: string;
  readonly scheduled_at: string | Date;
  readonly status: string;
  readonly reschedule_count: number;
  readonly previous_scheduled_at: string | Date | null;
  readonly reschedule_reason: string | null;
  readonly cancellation_reason: string | null;
  readonly record_version: number;
  readonly created_by: string | null;
  readonly rescheduled_at: string | Date | null;
  readonly finalized_at: string | Date | null;
  readonly cancelled_at: string | Date | null;
  readonly created_at: string | Date;
  readonly updated_at: string | Date;
}

/** A generic count row. */
export interface CountRow {
  readonly count: number;
}

/** A single-column id probe row for existence checks. */
export interface IdRow {
  readonly id: string;
}

/** A next-ordinal computation row. */
export interface OrdinalRow {
  readonly next_ordinal: number;
}
