/** Raw `squads` row as returned by the database driver. */
export interface SquadRow {
  readonly id: string;
  readonly team_id: string;
  readonly season_id: string;
  readonly competition_id: string | null;
  readonly name: string;
  readonly status: string;
  readonly attendance_threshold_pct: string | number;
  readonly policy_version: string;
  readonly selection_deadline: string | Date | null;
  readonly notes: string | null;
  readonly revision: number;
  readonly record_version: number;
  readonly created_by: string | null;
  readonly published_by: string | null;
  readonly published_at: string | Date | null;
  readonly locked_at: string | Date | null;
  readonly archived_at: string | Date | null;
  readonly created_at: string | Date;
  readonly updated_at: string | Date;
}

/** Raw `squad_selections` row. */
export interface SelectionRow {
  readonly id: string;
  readonly squad_id: string;
  readonly team_id: string;
  readonly membership_id: string;
  readonly selection_role: string;
  readonly status: string;
  readonly reason: string | null;
  readonly eligibility_overridden: boolean;
  readonly override_reason: string | null;
  readonly overridden_by: string | null;
  readonly eligibility_snapshot: string;
  readonly selected_by: string | null;
  readonly removed_by: string | null;
  readonly removed_at: string | Date | null;
  readonly record_version: number;
  readonly created_at: string | Date;
  readonly updated_at: string | Date;
}

/** Raw `squad_availability` row. */
export interface AvailabilityRow {
  readonly id: string;
  readonly squad_id: string;
  readonly team_id: string;
  readonly membership_id: string;
  readonly availability: string;
  readonly reason: string | null;
  readonly source: string;
  readonly declared_by: string | null;
  readonly record_version: number;
  readonly created_at: string | Date;
  readonly updated_at: string | Date;
}

/**
 * Raw candidate-pool row: a membership joined to its profile, its season
 * attendance aggregates, its availability for the squad, and its current
 * selection state. Attendance is returned as counts, never a pre-averaged
 * percentage, so the pure policy owns the null-not-zero decision.
 */
export interface CandidateRow {
  readonly membership_id: string;
  readonly full_name: string | null;
  readonly status: string;
  readonly registered_in_season: boolean;
  readonly gender: string | null;
  readonly jersey_number: number | null;
  readonly attended_sessions: number;
  readonly eligible_sessions: number;
  readonly injured_sessions: number;
  readonly availability: string | null;
  readonly selected: boolean;
  readonly selection_overridden: boolean;
}

/** A generic count row. */
export interface CountRow {
  readonly count: number;
}

/** A single-column id probe row for existence checks. */
export interface IdRow {
  readonly id: string;
}

/** Raw gender + selected-count row grouped by profile gender for the ratio. */
export interface GenderCountRow {
  readonly gender: string | null;
  readonly count: number;
}
