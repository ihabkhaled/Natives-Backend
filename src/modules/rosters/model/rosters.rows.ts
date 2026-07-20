/** Raw `rosters` row as returned by the database driver. */
export interface RosterRow {
  readonly id: string;
  readonly team_id: string;
  readonly season_id: string;
  readonly competition_id: string;
  readonly fixture_id: string | null;
  readonly squad_id: string | null;
  readonly source_roster_id: string | null;
  readonly supersedes_roster_id: string | null;
  readonly current_snapshot_id: string | null;
  readonly roster_kind: string;
  readonly name: string;
  readonly status: string;
  readonly division: string;
  readonly min_size: number;
  readonly max_size: number;
  readonly min_women: number | null;
  readonly require_captain: boolean;
  readonly policy_version: string;
  readonly selection_deadline: string | Date | null;
  readonly notes: string | null;
  readonly revision: number;
  readonly record_version: number;
  readonly created_by: string | null;
  readonly published_by: string | null;
  readonly published_at: string | Date | null;
  readonly locked_by: string | null;
  readonly locked_at: string | Date | null;
  readonly revised_by: string | null;
  readonly revised_at: string | Date | null;
  readonly revision_reason: string | null;
  readonly archived_at: string | Date | null;
  readonly created_at: string | Date;
  readonly updated_at: string | Date;
}

/** Raw `roster_entries` row. */
export interface RosterEntryRow {
  readonly id: string;
  readonly roster_id: string;
  readonly team_id: string;
  readonly membership_id: string;
  readonly jersey_number: number | null;
  readonly entry_role: string;
  readonly line_assignment: string;
  readonly field_position: string;
  readonly gender_bucket: string;
  readonly status: string;
  readonly availability: string | null;
  readonly selection_reason: string | null;
  readonly constraint_overridden: boolean;
  readonly override_reason: string | null;
  readonly overridden_by: string | null;
  readonly selected_by: string | null;
  readonly removed_by: string | null;
  readonly removed_at: string | Date | null;
  readonly removal_reason: string | null;
  readonly record_version: number;
  readonly created_at: string | Date;
  readonly updated_at: string | Date;
}

/** Raw `roster_availability` row. */
export interface RosterAvailabilityRow {
  readonly id: string;
  readonly roster_id: string;
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
 * Raw `roster_snapshots` row. `entries` arrives as a parsed jsonb value from the
 * driver; the mapper validates every element against the closed enum sets rather
 * than trusting the stored shape.
 */
export interface RosterSnapshotRow {
  readonly id: string;
  readonly roster_id: string;
  readonly team_id: string;
  readonly season_id: string;
  readonly competition_id: string;
  readonly fixture_id: string | null;
  readonly roster_kind: string;
  readonly revision: number;
  readonly reason: string;
  readonly roster_status: string;
  readonly entry_count: number;
  readonly checksum: string;
  readonly entries: unknown;
  readonly taken_by: string | null;
  readonly taken_at: string | Date;
}

/**
 * Raw roster-candidate row: a membership joined to its profile, its declaration
 * for the roster, and whether the season squad selected it. Classifications
 * only — no medical or contact detail crosses this boundary.
 */
export interface RosterCandidateRow {
  readonly membership_id: string;
  readonly member_status: string;
  readonly gender: string | null;
  readonly jersey_number: number | null;
  readonly availability: string | null;
  readonly selected_in_squad: boolean;
}

/** A generic count row. */
export interface CountRow {
  readonly count: number;
}

/** A single-column id probe row for existence checks. */
export interface IdRow {
  readonly id: string;
}

/** The resolved competition scope of a roster (season lookup). */
export interface ScopeRow {
  readonly competition_id: string;
  readonly season_id: string;
}
