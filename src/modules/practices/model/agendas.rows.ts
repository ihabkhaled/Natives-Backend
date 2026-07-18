/**
 * Raw persistence row shapes (snake_case) returned by the agenda/drill SQL layer.
 * Repositories map these into vendor-free domain types so implementation files stay
 * free of inline declarations. timestamptz columns arrive as `Date` or ISO string;
 * `text[]` columns arrive as native string arrays; integer columns as numbers.
 */

export interface DrillRow {
  readonly id: string;
  readonly team_id: string;
  readonly season_id: string | null;
  readonly name: string;
  readonly category: string;
  readonly objective: string | null;
  readonly instructions: string | null;
  readonly equipment: readonly string[] | null;
  readonly intensity: string;
  readonly default_duration_minutes: number | null;
  readonly skill_tags: readonly string[] | null;
  readonly safety_notes: string | null;
  readonly media_url: string | null;
  readonly status: string;
  readonly created_by: string | null;
  readonly updated_by: string | null;
  readonly created_at: string | Date;
  readonly updated_at: string | Date;
  readonly version: number;
}

export interface AgendaRow {
  readonly id: string;
  readonly session_id: string;
  readonly team_id: string;
  readonly season_id: string | null;
  readonly status: string;
  readonly theme: string | null;
  readonly notes: string | null;
  readonly published_at: string | Date | null;
  readonly published_by: string | null;
  readonly completed_at: string | Date | null;
  readonly completed_by: string | null;
  readonly created_by: string | null;
  readonly updated_by: string | null;
  readonly created_at: string | Date;
  readonly updated_at: string | Date;
  readonly version: number;
}

export interface AgendaBlockRow {
  readonly id: string;
  readonly agenda_id: string;
  readonly session_id: string;
  readonly team_id: string;
  readonly drill_id: string | null;
  readonly position: number;
  readonly title: string;
  readonly block_type: string;
  readonly offset_minutes: number | null;
  readonly duration_minutes: number | null;
  readonly intensity: string | null;
  readonly repetitions: number | null;
  readonly target: string | null;
  readonly completion_status: string;
  readonly completed_at: string | Date | null;
  readonly completed_by: string | null;
  readonly notes: string | null;
  readonly coach_notes: string | null;
  readonly version: number;
}

export interface AgendaStationRow {
  readonly id: string;
  readonly block_id: string;
  readonly agenda_id: string;
  readonly team_id: string;
  readonly drill_id: string | null;
  readonly group_id: string | null;
  readonly coach_membership_id: string | null;
  readonly position: number;
  readonly name: string;
  readonly repetitions: number | null;
  readonly target: string | null;
  readonly notes: string | null;
  readonly completion_status: string;
  readonly version: number;
}

export interface AgendaGroupRow {
  readonly id: string;
  readonly agenda_id: string;
  readonly team_id: string;
  readonly name: string;
  readonly color: string | null;
  readonly coach_membership_id: string | null;
  readonly position: number;
  readonly notes: string | null;
  readonly version: number;
}

export interface AgendaGroupMemberRow {
  readonly id: string;
  readonly group_id: string;
  readonly agenda_id: string;
  readonly membership_id: string;
}

export interface AgendaCountRow {
  readonly count: number;
}

export interface AgendaBlockIdRow {
  readonly id: string;
}
