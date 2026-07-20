/** Raw `points_rules` row as returned by the database driver. */
export interface PointsRuleRow {
  readonly id: string;
  readonly team_id: string | null;
  readonly season_id: string | null;
  readonly rule_key: string;
  readonly version: number;
  readonly name: string;
  readonly description: string | null;
  readonly status: string;
  readonly point_entries: unknown;
  readonly effective_from: string | null;
  readonly effective_to: string | null;
  readonly record_version: number;
  readonly created_by: string | null;
  readonly published_by: string | null;
  readonly published_at: string | Date | null;
  readonly retired_at: string | Date | null;
  readonly created_at: string | Date;
  readonly updated_at: string | Date;
}

/** Raw `points_ledger` row. */
export interface LedgerEntryRow {
  readonly id: string;
  readonly team_id: string;
  readonly season_id: string | null;
  readonly membership_id: string;
  readonly entry_type: string;
  readonly amount: string;
  readonly source_type: string;
  readonly source_id: string | null;
  readonly rule_id: string | null;
  readonly rule_version: number | null;
  readonly activity_category: string | null;
  readonly reason: string | null;
  readonly reason_key: string | null;
  readonly reverses_entry_id: string | null;
  readonly idempotency_key: string;
  readonly effective_on: string;
  readonly actor_user_id: string | null;
  readonly created_at: string | Date;
}

/** Raw `badge_definitions` row. */
export interface BadgeDefinitionRow {
  readonly id: string;
  readonly team_id: string | null;
  readonly badge_key: string;
  readonly name: string;
  readonly description: string | null;
  readonly threshold: number;
  readonly status: string;
  readonly icon: string | null;
}

/** Raw `player_badges` row. */
export interface PlayerBadgeRow {
  readonly id: string;
  readonly team_id: string;
  readonly membership_id: string;
  readonly badge_definition_id: string;
  readonly badge_key: string;
  readonly threshold: number;
  readonly points_at_award: string;
  readonly awarded_by: string | null;
  readonly awarded_at: string | Date;
}

/** The point-relevant projection of an `activity_types` row. */
export interface ActivityTypePointsRow {
  readonly id: string;
  readonly category: string;
  readonly points_approval: string;
}

/** The award-facts aggregation for the cap/cooldown decision. */
export interface AwardFactsRow {
  readonly same_day_count: string | number;
  readonly last_award_on: string | null;
}

/** A single nullable numeric total. */
export interface TotalRow {
  readonly total: string | null;
}

/** A generic count row. */
export interface CountRow {
  readonly count: number;
}

/** A single-column id probe row for existence checks. */
export interface IdRow {
  readonly id: string;
}

/** A cohort membership row: its id and the status that admitted it. */
export interface CohortMemberRow {
  readonly membership_id: string;
  readonly status: string;
}

/** A per-member windowed total row (null when the member has no in-window rows). */
export interface MemberTotalRow {
  readonly membership_id: string;
  readonly total: string | null;
}

/** A per-member, per-category windowed total row (category null = adjustment). */
export interface MemberCategoryTotalRow {
  readonly membership_id: string;
  readonly activity_category: string | null;
  readonly total: string | null;
}

/** A per-member badge-count row. */
export interface MemberBadgeCountRow {
  readonly membership_id: string;
  readonly badge_count: string | number;
}

/** The Africa/Cairo calendar bounds of a season. */
export interface SeasonBoundsRow {
  readonly starts_on: string;
  readonly ends_on: string;
}
