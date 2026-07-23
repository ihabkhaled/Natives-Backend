/** Raw `standings_rule_versions` row. */
export interface StandingsRuleRow {
  readonly id: string;
  readonly team_id: string;
  readonly rule_key: string;
  readonly version: number | string;
  readonly name: string;
  readonly win_points: number | string;
  readonly loss_points: number | string;
  readonly tie_points: number | string;
  readonly tie_break_order: readonly string[];
  readonly effective_from: string | Date;
  readonly status: string;
  readonly created_by: string | null;
  readonly created_at: string | Date;
}

/** Raw `competition_standings` row. */
export interface StandingRow {
  readonly id: string;
  readonly team_id: string;
  readonly season_id: string;
  readonly competition_id: string;
  readonly stage_id: string | null;
  readonly rule_version_id: string;
  readonly pool_label: string | null;
  readonly entrant_kind: string;
  readonly opponent_id: string | null;
  readonly opponent_name: string | null;
  readonly played: number | string;
  readonly wins: number | string;
  readonly losses: number | string;
  readonly ties: number | string;
  readonly points_for: number | string;
  readonly points_against: number | string;
  readonly standing_points: number | string;
  readonly spirit_score: number | string | null;
  readonly final_place: number | string | null;
  readonly qualification: string;
  readonly source: string;
  readonly source_reference: string | null;
  readonly reconciliation_note: string | null;
  readonly record_version: number | string;
  readonly recorded_by: string | null;
  readonly computed_at: string | Date;
  readonly created_at: string | Date;
  readonly updated_at: string | Date;
}

/**
 * The upsert RETURNING row — the base standings columns without the joined
 * opponent name (RETURNING cannot join; the repository resolves it after).
 */
export type StandingWriteRow = Omit<StandingRow, 'opponent_name'>;

/** A single opponent display-name probe row. */
export interface OpponentNameRow {
  readonly name: string;
}

/** Raw `team_achievements` row. */
export interface AchievementRow {
  readonly id: string;
  readonly team_id: string;
  readonly season_id: string | null;
  readonly competition_id: string | null;
  readonly membership_id: string | null;
  readonly category: string;
  readonly title: string;
  readonly description: string | null;
  readonly achieved_on: string | Date;
  readonly evidence_reference: string | null;
  readonly visibility: string;
  readonly status: string;
  readonly source: string;
  readonly import_reference: string | null;
  readonly rejection_reason: string | null;
  readonly record_version: number | string;
  readonly created_by: string | null;
  readonly approved_by: string | null;
  readonly approved_at: string | Date | null;
  readonly rejected_at: string | Date | null;
  readonly archived_at: string | Date | null;
  readonly created_at: string | Date;
  readonly updated_at: string | Date;
}

/**
 * One finalized match, projected down to exactly the facts a standing is folded
 * from. Nothing personal crosses this boundary — scores, an outcome, and the
 * opponent identity only.
 */
export interface FinalizedMatchRow {
  readonly match_id: string;
  readonly competition_id: string;
  readonly stage_id: string | null;
  readonly opponent_id: string | null;
  readonly our_score: number | string;
  readonly opponent_score: number | string;
  readonly result: string;
}

/** The resolved competition scope of a standings operation. */
export interface StandingsScopeRow {
  readonly competition_id: string;
  readonly season_id: string;
}

/** A generic count row. */
export interface StandingsCountRow {
  readonly count: number | string;
}

/** A single-column id probe row for existence checks. */
export interface StandingsIdRow {
  readonly id: string;
}
