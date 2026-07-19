import type {
  AwardSkipReason,
  BadgeStatus,
  LedgerEntryType,
  LedgerSourceType,
  PointsApproval,
  PointsRuleStatus,
  PointsRuleTransition,
} from './points.enums';

// --- Pagination --------------------------------------------------------------

export interface PageRequest {
  readonly limit: number;
  readonly offset: number;
}

export interface PagedResult<TItem> {
  readonly items: readonly TItem[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}

// --- Rule definition ---------------------------------------------------------

/**
 * One activity-category point entry of a rule version: the base points, an
 * optional per-day cap on how many awards of this category count, and an optional
 * cooldown (minimum whole days between two awards of the same category). A null
 * cap or cooldown means unbounded; a null `points` is a pending/unresolved value
 * that is never awarded.
 */
export interface RulePointEntry {
  readonly activityCategory: string;
  readonly points: number | null;
  readonly dailyCap: number | null;
  readonly cooldownDays: number | null;
}

/** The full persisted points-rule aggregate. */
export interface PointsRule {
  readonly ruleId: string;
  readonly teamId: string | null;
  readonly seasonId: string | null;
  readonly ruleKey: string;
  readonly version: number;
  readonly name: string;
  readonly description: string | null;
  readonly status: PointsRuleStatus;
  readonly pointEntries: readonly RulePointEntry[];
  readonly effectiveFrom: string | null;
  readonly effectiveTo: string | null;
  readonly recordVersion: number;
  readonly createdBy: string | null;
  readonly publishedBy: string | null;
  readonly publishedAt: Date | null;
  readonly retiredAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** Author-supplied content of a points rule (create command). */
export interface RuleContent {
  readonly ruleKey: string;
  readonly name: string;
  readonly description: string | null;
  readonly seasonId: string | null;
  readonly effectiveFrom: string | null;
  readonly effectiveTo: string | null;
  readonly pointEntries: readonly RulePointEntry[];
}

/** A fully-resolved new rule row ready for insertion. */
export interface NewPointsRule {
  readonly id: string;
  readonly teamId: string;
  readonly version: number;
  readonly content: RuleContent;
  readonly createdBy: string;
  readonly now: Date;
}

/** An optimistic-version-guarded lifecycle status change of a rule. */
export interface RuleStatusChange {
  readonly id: string;
  readonly teamId: string;
  readonly expectedRecordVersion: number;
  readonly toStatus: PointsRuleStatus;
  readonly publishedBy: string | null;
  readonly publishedAt: Date | null;
  readonly retiredAt: Date | null;
  readonly now: Date;
}

// --- Award (pure) ------------------------------------------------------------

/** The point-relevant facts of an activity type read from the catalog. */
export interface ActivityTypePoints {
  readonly activityTypeId: string;
  readonly category: string;
  readonly pointsApproval: PointsApproval;
}

/**
 * Ledger-derived facts for the cap/cooldown decision: how many awards of this
 * category the member already has on the activity's day, and the most recent
 * prior award date for the category (null when there is none).
 */
export interface AwardFacts {
  readonly sameDayCount: number;
  readonly lastAwardOn: string | null;
}

/** The complete pure input to the award calculator. */
export interface AwardInput {
  readonly entry: RulePointEntry | null;
  readonly pointsApproval: PointsApproval;
  readonly facts: AwardFacts;
  readonly performedOn: string;
}

/** The deterministic award outcome: a value, or a named skip reason. */
export interface AwardDecision {
  readonly awarded: boolean;
  readonly amount: number;
  readonly skipReason: AwardSkipReason;
}

// --- Cross-module commands (public boundary) --------------------------------

/** The scalars the review flow passes to award an approved activity claim. */
export interface ActivityAwardCommand {
  readonly submissionId: string;
  readonly teamId: string;
  readonly seasonId: string | null;
  readonly membershipId: string;
  readonly activityTypeId: string;
  readonly performedOn: string;
  readonly actorUserId: string;
}

/** The scalars the correction flow passes to compensate an approved claim. */
export interface ActivityReversalCommand {
  readonly submissionId: string;
  readonly teamId: string;
  readonly membershipId: string;
  readonly actorUserId: string;
}

// --- Ledger ------------------------------------------------------------------

/** A persisted, immutable points-ledger entry. */
export interface LedgerEntry {
  readonly id: string;
  readonly teamId: string;
  readonly seasonId: string | null;
  readonly membershipId: string;
  readonly entryType: LedgerEntryType;
  readonly amount: number;
  readonly sourceType: LedgerSourceType;
  readonly sourceId: string | null;
  readonly ruleId: string | null;
  readonly ruleVersion: number | null;
  readonly activityCategory: string | null;
  readonly reason: string | null;
  readonly reasonKey: string | null;
  readonly reversesEntryId: string | null;
  readonly idempotencyKey: string;
  readonly effectiveOn: string;
  readonly actorUserId: string | null;
  readonly createdAt: Date;
}

/** A fully-built ledger row ready for an idempotent insert. */
export interface NewLedgerEntry {
  readonly id: string;
  readonly teamId: string;
  readonly seasonId: string | null;
  readonly membershipId: string;
  readonly entryType: LedgerEntryType;
  readonly amount: number;
  readonly sourceType: LedgerSourceType;
  readonly sourceId: string | null;
  readonly ruleId: string | null;
  readonly ruleVersion: number | null;
  readonly activityCategory: string | null;
  readonly reason: string | null;
  readonly reasonKey: string | null;
  readonly reversesEntryId: string | null;
  readonly idempotencyKey: string;
  readonly effectiveOn: string;
  readonly actorUserId: string | null;
  readonly now: Date;
}

/** A manual administrative adjustment command (audited, reasoned, idempotent). */
export interface AdjustmentCommand {
  readonly amount: number;
  readonly reason: string;
  readonly operationKey: string;
}

// --- Badges ------------------------------------------------------------------

/** A badge tier definition — awarded only while `status` is active. */
export interface BadgeDefinition {
  readonly id: string;
  readonly teamId: string | null;
  readonly badgeKey: string;
  readonly name: string;
  readonly description: string | null;
  readonly threshold: number;
  readonly status: BadgeStatus;
  readonly icon: string | null;
}

/** A badge earned by a member — one row per (membership, definition). */
export interface PlayerBadge {
  readonly id: string;
  readonly teamId: string;
  readonly membershipId: string;
  readonly badgeDefinitionId: string;
  readonly badgeKey: string;
  readonly threshold: number;
  readonly pointsAtAward: number;
  readonly awardedBy: string | null;
  readonly awardedAt: Date;
}

/** A fully-built player-badge row ready for an idempotent insert. */
export interface NewPlayerBadge {
  readonly id: string;
  readonly teamId: string;
  readonly membershipId: string;
  readonly badgeDefinitionId: string;
  readonly badgeKey: string;
  readonly threshold: number;
  readonly pointsAtAward: number;
  readonly awardedBy: string | null;
  readonly now: Date;
}

/** The membership + actor a badge sync targets. */
export interface BadgeScope {
  readonly teamId: string;
  readonly membershipId: string;
  readonly actorUserId: string | null;
}

// --- Commands ----------------------------------------------------------------

export interface CreateRuleCommand {
  readonly content: RuleContent;
}

export interface TransitionRuleCommand {
  readonly transition: PointsRuleTransition;
  readonly expectedRecordVersion: number;
}

// --- Transport inputs --------------------------------------------------------

/** Loosely-typed point-entry input the DTO structurally satisfies. */
export interface RulePointEntryInput {
  readonly activityCategory: string;
  readonly points?: number | null;
  readonly dailyCap?: number | null;
  readonly cooldownDays?: number | null;
}

/** Loosely-typed rule-content input; the mapper fills the null defaults. */
export interface RuleContentInput {
  readonly ruleKey: string;
  readonly name: string;
  readonly description?: string | null;
  readonly seasonId?: string | null;
  readonly effectiveFrom?: string | null;
  readonly effectiveTo?: string | null;
  readonly pointEntries: readonly RulePointEntryInput[];
}

// --- Read views --------------------------------------------------------------

/** One ledger line in a member's history (no idempotency internals exposed). */
export interface LedgerEntryView {
  readonly id: string;
  readonly entryType: LedgerEntryType;
  readonly amount: number;
  readonly sourceType: LedgerSourceType;
  readonly ruleVersion: number | null;
  readonly activityCategory: string | null;
  readonly reason: string | null;
  readonly effectiveOn: string;
  readonly createdAt: Date;
}

/** A badge a member has earned, for the read surface. */
export interface PlayerBadgeView {
  readonly badgeKey: string;
  readonly threshold: number;
  readonly pointsAtAward: number;
  readonly awardedAt: Date;
}

/** A member's projected total (sum of ledger entries) with history + badges. */
export interface PointsSummaryView {
  readonly membershipId: string;
  readonly total: number;
  readonly entries: readonly LedgerEntryView[];
  readonly badges: readonly PlayerBadgeView[];
}

/** One ranked leaderboard row — a projected total, never a stored counter. */
export interface LeaderboardRow {
  readonly membershipId: string;
  readonly total: number;
  readonly rank: number;
  readonly badgeCount: number;
}

// --- Read envelopes ----------------------------------------------------------

export type LeaderboardPage = PagedResult<LeaderboardRow>;
export type PointsRulePage = PagedResult<PointsRule>;
