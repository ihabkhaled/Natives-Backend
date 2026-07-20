/** Raw `matches` row as returned by the database driver. */
export interface MatchRow {
  readonly id: string;
  readonly team_id: string;
  readonly season_id: string;
  readonly competition_id: string;
  readonly fixture_id: string;
  readonly roster_id: string | null;
  readonly ruleset_id: string;
  readonly status: string;
  readonly home_away: string;
  readonly our_score: number | string;
  readonly opponent_score: number | string;
  readonly period: number | string;
  readonly stream_version: number | string;
  readonly record_version: number | string;
  readonly revision: number | string;
  readonly result: string;
  readonly cap_applied: string;
  readonly engine_version: string;
  readonly supersedes_match_id: string | null;
  readonly reopen_reason: string | null;
  readonly reopened_by: string | null;
  readonly reopened_at: string | Date | null;
  readonly created_by: string | null;
  readonly started_at: string | Date | null;
  readonly paused_at: string | Date | null;
  readonly resumed_at: string | Date | null;
  readonly halftime_at: string | Date | null;
  readonly completed_at: string | Date | null;
  readonly finalized_by: string | null;
  readonly finalized_at: string | Date | null;
  readonly abandoned_at: string | Date | null;
  readonly abandon_reason: string | null;
  readonly notes: string | null;
  readonly created_at: string | Date;
  readonly updated_at: string | Date;
}

/** Raw `match_events` row (the append-only stream). */
export interface MatchEventRow {
  readonly id: string;
  readonly match_id: string;
  readonly team_id: string;
  readonly sequence: number | string;
  readonly operation_id: string;
  readonly request_hash: string;
  readonly event_type: string;
  readonly scoring_side: string | null;
  readonly points: number | string | null;
  readonly our_score_after: number | string;
  readonly opponent_score_after: number | string;
  readonly period: number | string;
  readonly scorer_membership_id: string | null;
  readonly assist_membership_id: string | null;
  readonly voids_event_id: string | null;
  readonly voided: boolean;
  readonly void_reason: string | null;
  readonly recorded_by: string | null;
  readonly occurred_at: string | Date | null;
  readonly recorded_at: string | Date;
}

/** Raw `match_rulesets` row (the versioned score policy). */
export interface MatchRulesetRow {
  readonly id: string;
  readonly team_id: string;
  readonly season_id: string | null;
  readonly ruleset_key: string;
  readonly ruleset_version: number | string;
  readonly name: string;
  readonly game_to: number | string;
  readonly win_by: number | string;
  readonly hard_cap: number | string | null;
  readonly soft_cap_minutes: number | string | null;
  readonly soft_cap_plus: number | string | null;
  readonly time_cap_minutes: number | string | null;
  readonly halftime_at: number | string | null;
  readonly timeouts_per_team: number | string;
  readonly timeouts_per_period: number | string | null;
  readonly periods: number | string;
  readonly status: string;
  readonly notes: string | null;
  readonly created_by: string | null;
  readonly created_at: string | Date;
  readonly updated_at: string | Date;
}

/** Raw `match_revisions` row (the immutable correction trail). */
export interface MatchRevisionRow {
  readonly id: string;
  readonly match_id: string;
  readonly team_id: string;
  readonly sequence: number | string;
  readonly revision: number | string;
  readonly action: string;
  readonly reason: string;
  readonly from_status: string;
  readonly to_status: string;
  readonly our_score_before: number | string;
  readonly opponent_score_before: number | string;
  readonly our_score_after: number | string;
  readonly opponent_score_after: number | string;
  readonly stream_version: number | string;
  readonly actor_user_id: string | null;
  readonly created_at: string | Date;
}

/** Counted timeout usage of one period, grouped by side. */
export interface TimeoutUsageRow {
  readonly scoring_side: string | null;
  readonly count: number | string;
}

/** A generic count row. */
export interface CountRow {
  readonly count: number;
}

/** A single-column id probe row for existence checks. */
export interface IdRow {
  readonly id: string;
}

/** A single-column integer probe row (max sequence, next version). */
export interface NumberRow {
  readonly value: number | string | null;
}

/** The resolved competition/season/side scope of a match. */
export interface MatchScopeRow {
  readonly competition_id: string;
  readonly season_id: string;
  readonly home_away: string;
}
