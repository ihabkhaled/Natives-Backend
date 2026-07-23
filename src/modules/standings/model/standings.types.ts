import type {
  AchievementCategory,
  AchievementImportOutcome,
  AchievementSource,
  AchievementStatus,
  AchievementTransition,
  AchievementVisibility,
  MatchOutcome,
  StandingEntrantKind,
  StandingQualification,
  StandingRuleStatus,
  StandingSource,
  StandingTieBreak,
} from './standings.enums';

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

// --- Rule versions -----------------------------------------------------------

/**
 * A named, versioned standings rule. Immutable once written: correcting a rule
 * means publishing the NEXT version, and a stored standings table keeps citing
 * the version it was computed under.
 */
export interface StandingsRuleVersion {
  readonly ruleVersionId: string;
  readonly teamId: string;
  readonly ruleKey: string;
  readonly version: number;
  readonly name: string;
  readonly winPoints: number;
  readonly lossPoints: number;
  readonly tiePoints: number;
  readonly tieBreakOrder: readonly StandingTieBreak[];
  readonly effectiveFrom: Date;
  readonly status: StandingRuleStatus;
  readonly createdBy: string | null;
  readonly createdAt: Date;
}

export interface NewStandingsRuleVersion {
  readonly id: string;
  readonly teamId: string;
  readonly ruleKey: string;
  readonly version: number;
  readonly name: string;
  readonly winPoints: number;
  readonly lossPoints: number;
  readonly tiePoints: number;
  readonly tieBreakOrder: readonly StandingTieBreak[];
  readonly effectiveFrom: Date;
  readonly createdBy: string;
}

export interface StandingsRuleContent {
  readonly ruleKey: string;
  readonly name: string;
  readonly winPoints: number;
  readonly lossPoints: number;
  readonly tiePoints: number;
  readonly tieBreakOrder: readonly StandingTieBreak[];
}

export interface StandingsRuleContentInput {
  readonly ruleKey: string;
  readonly name: string;
  readonly winPoints?: number | null;
  readonly lossPoints?: number | null;
  readonly tiePoints?: number | null;
  readonly tieBreakOrder?: readonly StandingTieBreak[] | null;
}

export interface CreateStandingsRuleCommand {
  readonly content: StandingsRuleContent;
}

export type StandingsRulePage = PagedResult<StandingsRuleVersion>;

// --- Standings ---------------------------------------------------------------

/**
 * One entrant's row in a competition standings table. `spiritScore` is null when
 * spirit was not scored — never zero — and `finalPlace` is null until a place is
 * actually awarded.
 */
export interface CompetitionStanding {
  readonly standingId: string;
  readonly teamId: string;
  readonly seasonId: string;
  readonly competitionId: string;
  readonly stageId: string | null;
  readonly ruleVersionId: string;
  readonly poolLabel: string | null;
  readonly entrantKind: StandingEntrantKind;
  readonly opponentId: string | null;
  /** Resolved opponent display name; null for our-team rows (B5). */
  readonly opponentName: string | null;
  readonly played: number;
  readonly wins: number;
  readonly losses: number;
  readonly ties: number;
  readonly pointsFor: number;
  readonly pointsAgainst: number;
  readonly standingPoints: number;
  readonly spiritScore: number | null;
  readonly finalPlace: number | null;
  readonly qualification: StandingQualification;
  readonly source: StandingSource;
  readonly sourceReference: string | null;
  readonly reconciliationNote: string | null;
  readonly recordVersion: number;
  readonly recordedBy: string | null;
  readonly computedAt: Date;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** A fully-resolved standings row ready for its idempotent upsert. */
export interface StandingUpsert {
  readonly id: string;
  readonly teamId: string;
  readonly seasonId: string;
  readonly competitionId: string;
  readonly stageId: string | null;
  readonly ruleVersionId: string;
  readonly poolLabel: string | null;
  readonly entrantKind: StandingEntrantKind;
  readonly opponentId: string | null;
  readonly tally: StandingTally;
  readonly spiritScore: number | null;
  readonly finalPlace: number | null;
  readonly qualification: StandingQualification;
  readonly source: StandingSource;
  readonly sourceReference: string | null;
  readonly reconciliationNote: string | null;
  readonly recordedBy: string;
  readonly now: Date;
}

/** The counted shape of an entrant's results under one rule version. */
export interface StandingTally {
  readonly played: number;
  readonly wins: number;
  readonly losses: number;
  readonly ties: number;
  readonly pointsFor: number;
  readonly pointsAgainst: number;
  readonly standingPoints: number;
}

/** One finalized match, reduced to the facts a standing folds. */
export interface FinalizedMatchResult {
  readonly matchId: string;
  readonly competitionId: string;
  readonly stageId: string | null;
  readonly opponentId: string | null;
  readonly ourScore: number;
  readonly opponentScore: number;
  readonly result: MatchOutcome;
}

export interface RecomputeStandingsCommand {
  readonly competitionId: string;
  readonly ruleKey: string;
}

/** The reconciliation of one recompute run. */
export interface StandingsRecomputeReport {
  readonly competitionId: string;
  readonly ruleVersionId: string;
  readonly finalizedMatches: number;
  readonly entrants: number;
  readonly rows: readonly CompetitionStanding[];
}

export interface ManualStandingContent {
  readonly competitionId: string;
  readonly stageId: string | null;
  readonly poolLabel: string | null;
  readonly entrantKind: StandingEntrantKind;
  readonly opponentId: string | null;
  readonly played: number;
  readonly wins: number;
  readonly losses: number;
  readonly ties: number;
  readonly pointsFor: number;
  readonly pointsAgainst: number;
  readonly spiritScore: number | null;
  readonly finalPlace: number | null;
  readonly qualification: StandingQualification;
  readonly sourceReference: string | null;
  readonly reconciliationNote: string;
  readonly ruleKey: string;
}

export interface ManualStandingContentInput {
  readonly competitionId: string;
  readonly stageId?: string | null;
  readonly poolLabel?: string | null;
  readonly entrantKind: StandingEntrantKind;
  readonly opponentId?: string | null;
  readonly played: number;
  readonly wins: number;
  readonly losses: number;
  readonly ties: number;
  readonly pointsFor: number;
  readonly pointsAgainst: number;
  readonly spiritScore?: number | null;
  readonly finalPlace?: number | null;
  readonly qualification?: StandingQualification | null;
  readonly sourceReference?: string | null;
  readonly reconciliationNote: string;
  readonly ruleKey: string;
}

export interface RecordManualStandingCommand {
  readonly content: ManualStandingContent;
}

export type StandingPage = PagedResult<CompetitionStanding>;

export interface StandingListFilter {
  readonly competitionId: string | null;
  readonly stageId: string | null;
  readonly source: StandingSource | null;
}

export interface StandingListFilterInput {
  readonly competitionId?: string | null;
  readonly stageId?: string | null;
  readonly source?: StandingSource | null;
}

// --- Achievements ------------------------------------------------------------

/** A team or player achievement with its provenance and approval state. */
export interface Achievement {
  readonly achievementId: string;
  readonly teamId: string;
  readonly seasonId: string | null;
  readonly competitionId: string | null;
  readonly membershipId: string | null;
  readonly category: AchievementCategory;
  readonly title: string;
  readonly description: string | null;
  readonly achievedOn: string;
  readonly evidenceReference: string | null;
  readonly visibility: AchievementVisibility;
  readonly status: AchievementStatus;
  readonly source: AchievementSource;
  readonly importReference: string | null;
  readonly rejectionReason: string | null;
  readonly recordVersion: number;
  readonly createdBy: string | null;
  readonly approvedBy: string | null;
  readonly approvedAt: Date | null;
  readonly rejectedAt: Date | null;
  readonly archivedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface NewAchievement {
  readonly id: string;
  readonly teamId: string;
  readonly seasonId: string | null;
  readonly competitionId: string | null;
  readonly membershipId: string | null;
  readonly category: AchievementCategory;
  readonly title: string;
  readonly description: string | null;
  readonly achievedOn: string;
  readonly evidenceReference: string | null;
  readonly visibility: AchievementVisibility;
  readonly source: AchievementSource;
  readonly importReference: string | null;
  readonly createdBy: string;
  readonly now: Date;
}

export interface AchievementContent {
  readonly seasonId: string | null;
  readonly competitionId: string | null;
  readonly membershipId: string | null;
  readonly category: AchievementCategory;
  readonly title: string;
  readonly description: string | null;
  readonly achievedOn: string;
  readonly evidenceReference: string | null;
  readonly visibility: AchievementVisibility;
}

export interface AchievementContentInput {
  readonly seasonId?: string | null;
  readonly competitionId?: string | null;
  readonly membershipId?: string | null;
  readonly category: AchievementCategory;
  readonly title: string;
  readonly description?: string | null;
  readonly achievedOn: string;
  readonly evidenceReference?: string | null;
  readonly visibility?: AchievementVisibility | null;
}

export interface CreateAchievementCommand {
  readonly content: AchievementContent;
}

export interface TransitionAchievementCommand {
  readonly transition: AchievementTransition;
  readonly expectedRecordVersion: number;
  /** Optional bounded explanation, persisted on the row for reject only. */
  readonly reason: string | null;
}

/** An optimistic-version-guarded approval change of an achievement. */
export interface AchievementStatusChange {
  readonly id: string;
  readonly teamId: string;
  readonly expectedRecordVersion: number;
  readonly toStatus: AchievementStatus;
  readonly approvedBy: string | null;
  readonly approvedAt: Date | null;
  readonly rejectedAt: Date | null;
  readonly rejectionReason: string | null;
  readonly archivedAt: Date | null;
  readonly now: Date;
}

export type AchievementPage = PagedResult<Achievement>;

export interface AchievementListFilter {
  readonly seasonId: string | null;
  readonly competitionId: string | null;
  readonly category: AchievementCategory | null;
  readonly status: AchievementStatus | null;
  readonly membershipId: string | null;
}

export interface AchievementListFilterInput {
  readonly seasonId?: string | null;
  readonly competitionId?: string | null;
  readonly category?: AchievementCategory | null;
  readonly status?: AchievementStatus | null;
  readonly membershipId?: string | null;
}

/** One audited historical achievement row. */
export interface AchievementImportRow {
  readonly reference: string;
  readonly category: AchievementCategory;
  readonly title: string;
  readonly description: string | null;
  readonly achievedOn: string;
  readonly seasonId: string | null;
  readonly competitionId: string | null;
  readonly evidenceReference: string | null;
  readonly visibility: AchievementVisibility;
}

export interface AchievementImportRowInput {
  readonly reference: string;
  readonly category: AchievementCategory;
  readonly title: string;
  readonly description?: string | null;
  readonly achievedOn: string;
  readonly seasonId?: string | null;
  readonly competitionId?: string | null;
  readonly evidenceReference?: string | null;
  readonly visibility?: AchievementVisibility | null;
}

export interface ImportAchievementsCommand {
  readonly dryRun: boolean;
  readonly rows: readonly AchievementImportRow[];
}

export interface AchievementImportRowResult {
  readonly reference: string;
  readonly outcome: AchievementImportOutcome;
  readonly achievementId: string | null;
}

export interface AchievementImportReport {
  readonly dryRun: boolean;
  readonly received: number;
  readonly imported: number;
  readonly skippedDuplicate: number;
  readonly rejectedInvalid: number;
  readonly rows: readonly AchievementImportRowResult[];
}

// --- Team history ------------------------------------------------------------

/**
 * One entry of the trophy cabinet: an approved achievement reduced to the
 * privacy-safe reference set. A player achievement carries the membership ID —
 * never a name, an email, or any profile detail.
 */
export interface HistoryEntry {
  readonly achievementId: string;
  readonly seasonId: string | null;
  readonly competitionId: string | null;
  readonly membershipId: string | null;
  readonly category: AchievementCategory;
  readonly title: string;
  readonly achievedOn: string;
  readonly visibility: AchievementVisibility;
}

export type HistoryPage = PagedResult<HistoryEntry>;

/** The resolved team/season/competition scope of a standings operation. */
export interface StandingsScope {
  readonly teamId: string;
  readonly seasonId: string;
  readonly competitionId: string;
}
