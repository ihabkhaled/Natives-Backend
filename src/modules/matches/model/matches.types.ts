import type {
  CapKind,
  MatchEventType,
  MatchResult,
  MatchRevisionAction,
  MatchStatus,
  MatchTransition,
  OperationOutcome,
  RulesetStatus,
  ScoringSide,
} from './matches.enums';

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

// --- Ruleset (the VERSIONED score policy) ------------------------------------

/**
 * A named, versioned scoring rule set. Every cap and target a match is played
 * under is read from here — nothing about game-to, win-by, soft/hard/time caps,
 * halftime, or timeout allowance is hard-coded in the engine. A `null` cap means
 * the rule does NOT APPLY; it is never read as zero.
 */
export interface MatchRuleset {
  readonly rulesetId: string;
  readonly teamId: string;
  readonly seasonId: string | null;
  readonly rulesetKey: string;
  readonly rulesetVersion: number;
  readonly name: string;
  readonly gameTo: number;
  readonly winBy: number;
  readonly hardCap: number | null;
  readonly softCapMinutes: number | null;
  readonly softCapPlus: number | null;
  readonly timeCapMinutes: number | null;
  readonly halftimeAt: number | null;
  readonly timeoutsPerTeam: number;
  readonly timeoutsPerPeriod: number | null;
  readonly periods: number;
  readonly status: RulesetStatus;
  readonly notes: string | null;
  readonly createdBy: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** Author-supplied content of a ruleset (create command). */
export interface MatchRulesetContent {
  readonly rulesetKey: string;
  readonly seasonId: string | null;
  readonly name: string;
  readonly gameTo: number;
  readonly winBy: number;
  readonly hardCap: number | null;
  readonly softCapMinutes: number | null;
  readonly softCapPlus: number | null;
  readonly timeCapMinutes: number | null;
  readonly halftimeAt: number | null;
  readonly timeoutsPerTeam: number;
  readonly timeoutsPerPeriod: number | null;
  readonly periods: number;
  readonly notes: string | null;
}

/** A fully-resolved new ruleset row ready for insertion. */
export interface NewMatchRuleset extends MatchRulesetContent {
  readonly id: string;
  readonly teamId: string;
  readonly rulesetVersion: number;
  readonly createdBy: string;
  readonly now: Date;
}

export interface CreateMatchRulesetCommand {
  readonly content: MatchRulesetContent;
}

export type MatchRulesetPage = PagedResult<MatchRuleset>;

// --- Match aggregate ---------------------------------------------------------

/**
 * The authoritative match record. `ourScore` / `opponentScore` are a PROJECTION
 * of the accepted point events, never an editable number: every change to them
 * comes from appending an event to the stream, and `streamVersion` is the
 * authoritative sequence concurrent devices are guarded against.
 */
export interface Match {
  readonly matchId: string;
  readonly teamId: string;
  readonly seasonId: string;
  readonly competitionId: string;
  readonly fixtureId: string;
  readonly rosterId: string | null;
  readonly rulesetId: string;
  readonly status: MatchStatus;
  readonly homeAway: string;
  readonly ourScore: number;
  readonly opponentScore: number;
  readonly period: number;
  readonly streamVersion: number;
  readonly recordVersion: number;
  readonly revision: number;
  readonly result: MatchResult;
  readonly capApplied: CapKind;
  readonly engineVersion: string;
  readonly supersedesMatchId: string | null;
  readonly reopenReason: string | null;
  readonly reopenedBy: string | null;
  readonly reopenedAt: Date | null;
  readonly createdBy: string | null;
  readonly startedAt: Date | null;
  readonly pausedAt: Date | null;
  readonly resumedAt: Date | null;
  readonly halftimeAt: Date | null;
  readonly completedAt: Date | null;
  readonly finalizedBy: string | null;
  readonly finalizedAt: Date | null;
  readonly abandonedAt: Date | null;
  readonly abandonReason: string | null;
  readonly notes: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** Author-supplied content of a match (create command). */
export interface MatchContent {
  readonly fixtureId: string;
  readonly rosterId: string | null;
  readonly rulesetId: string | null;
  readonly notes: string | null;
}

/** A fully-resolved new match row ready for insertion. */
export interface NewMatch {
  readonly id: string;
  readonly teamId: string;
  readonly seasonId: string;
  readonly competitionId: string;
  readonly fixtureId: string;
  readonly rosterId: string | null;
  readonly rulesetId: string;
  readonly homeAway: string;
  readonly engineVersion: string;
  readonly revision: number;
  readonly supersedesMatchId: string | null;
  readonly notes: string | null;
  readonly createdBy: string;
  readonly now: Date;
}

/** An optimistic-version-guarded lifecycle status change of a match. */
export interface MatchStatusChange {
  readonly id: string;
  readonly teamId: string;
  readonly expectedRecordVersion: number;
  readonly toStatus: MatchStatus;
  readonly period: number;
  readonly result: MatchResult;
  readonly startedAt: Date | null;
  readonly pausedAt: Date | null;
  readonly resumedAt: Date | null;
  readonly halftimeAt: Date | null;
  readonly completedAt: Date | null;
  readonly abandonedAt: Date | null;
  readonly abandonReason: string | null;
  readonly now: Date;
}

/** The optimistic-version-guarded publication of an authoritative result. */
export interface MatchFinalization {
  readonly id: string;
  readonly teamId: string;
  readonly expectedRecordVersion: number;
  readonly result: MatchResult;
  readonly finalizedBy: string;
  readonly now: Date;
}

/**
 * The audited reopening of a finalized match. It bumps `revision` — the ONLY
 * update a finalized row accepts, enforced by a database trigger — so an
 * in-place edit of published history is impossible even outside the application.
 */
export interface MatchReopening {
  readonly id: string;
  readonly teamId: string;
  readonly expectedRecordVersion: number;
  readonly revision: number;
  readonly reason: string;
  readonly reopenedBy: string;
  readonly now: Date;
}

/** The projection write that follows an accepted scoring event. */
export interface MatchScoreUpdate {
  readonly id: string;
  readonly teamId: string;
  readonly ourScore: number;
  readonly opponentScore: number;
  readonly streamVersion: number;
  readonly capApplied: CapKind;
  readonly now: Date;
}

export interface CreateMatchCommand {
  readonly content: MatchContent;
}

export interface TransitionMatchCommand {
  readonly transition: MatchTransition;
  readonly expectedRecordVersion: number;
  readonly reason: string | null;
}

export interface FinalizeMatchCommand {
  readonly expectedRecordVersion: number;
  readonly ourScore: number | null;
  readonly opponentScore: number | null;
}

export interface ReopenMatchCommand {
  readonly reason: string;
  readonly expectedRecordVersion: number;
}

export type MatchPage = PagedResult<Match>;

/** Bounded, allow-listed filter for the match list. */
export interface MatchListFilter {
  readonly competitionId: string | null;
  readonly fixtureId: string | null;
  readonly status: MatchStatus | null;
}

/** The loosely-typed transport shape of the match list filter. */
export interface MatchListFilterInput {
  readonly competitionId?: string | null;
  readonly fixtureId?: string | null;
  readonly status?: MatchStatus | null;
}

// --- Stream events -----------------------------------------------------------

/**
 * One immutable fact on a match's append-only stream. `operationId` is the CLIENT
 * operation id: replaying it with the same payload yields the same authoritative
 * outcome, and replaying it with a different payload is a conflict.
 */
export interface MatchEvent {
  readonly eventId: string;
  readonly matchId: string;
  readonly teamId: string;
  readonly sequence: number;
  readonly operationId: string;
  readonly requestHash: string;
  readonly eventType: MatchEventType;
  readonly scoringSide: ScoringSide | null;
  readonly points: number | null;
  readonly ourScoreAfter: number;
  readonly opponentScoreAfter: number;
  readonly period: number;
  readonly scorerMembershipId: string | null;
  readonly assistMembershipId: string | null;
  readonly voidsEventId: string | null;
  readonly voided: boolean;
  readonly voidReason: string | null;
  readonly recordedBy: string | null;
  readonly occurredAt: Date | null;
  readonly recordedAt: Date;
}

/** A fully-resolved stream row ready for its single, append-only insert. */
export interface NewMatchEvent {
  readonly id: string;
  readonly matchId: string;
  readonly teamId: string;
  readonly sequence: number;
  readonly operationId: string;
  readonly requestHash: string;
  readonly eventType: MatchEventType;
  readonly scoringSide: ScoringSide | null;
  readonly points: number | null;
  readonly ourScoreAfter: number;
  readonly opponentScoreAfter: number;
  readonly period: number;
  readonly scorerMembershipId: string | null;
  readonly assistMembershipId: string | null;
  readonly voidsEventId: string | null;
  readonly voidReason: string | null;
  readonly recordedBy: string;
  readonly occurredAt: Date | null;
  readonly now: Date;
}

/** Author-supplied content of a point (score) operation. */
export interface PointContent {
  readonly operationId: string;
  readonly scoringSide: ScoringSide;
  readonly points: number;
  readonly scorerMembershipId: string | null;
  readonly assistMembershipId: string | null;
  readonly occurredAt: string | null;
  readonly expectedStreamVersion: number | null;
}

/** Author-supplied content of a timeout operation. */
export interface TimeoutContent {
  readonly operationId: string;
  readonly scoringSide: ScoringSide;
  readonly occurredAt: string | null;
}

/** Author-supplied content of a compensating void operation. */
export interface VoidContent {
  readonly operationId: string;
  readonly eventId: string;
  readonly reason: string;
}

export interface RecordPointCommand {
  readonly content: PointContent;
}

export interface RecordTimeoutCommand {
  readonly content: TimeoutContent;
}

export interface VoidEventCommand {
  readonly content: VoidContent;
}

export type MatchEventPage = PagedResult<MatchEvent>;

/** The result of an idempotent stream write: the fact plus how it was handled. */
export interface MatchOperationResult {
  readonly outcome: OperationOutcome;
  readonly event: MatchEvent;
  readonly streamVersion: number;
  readonly ourScore: number;
  readonly opponentScore: number;
}

// --- Revisions (audited corrections) -----------------------------------------

/**
 * One immutable revision row. Finalizing, reopening, and correcting each append
 * exactly one — carrying the score before and after — so a conflicting final
 * score is always a visible, attributable delta and is never silently merged.
 */
export interface MatchRevision {
  readonly revisionId: string;
  readonly matchId: string;
  readonly teamId: string;
  readonly sequence: number;
  readonly revision: number;
  readonly action: MatchRevisionAction;
  readonly reason: string;
  readonly fromStatus: MatchStatus;
  readonly toStatus: MatchStatus;
  readonly ourScoreBefore: number;
  readonly opponentScoreBefore: number;
  readonly ourScoreAfter: number;
  readonly opponentScoreAfter: number;
  readonly streamVersion: number;
  readonly actorUserId: string | null;
  readonly createdAt: Date;
}

/** A fully-resolved revision row ready for its single, append-only insert. */
export interface NewMatchRevision {
  readonly id: string;
  readonly matchId: string;
  readonly teamId: string;
  readonly sequence: number;
  readonly revision: number;
  readonly action: MatchRevisionAction;
  readonly reason: string;
  readonly fromStatus: MatchStatus;
  readonly toStatus: MatchStatus;
  readonly ourScoreBefore: number;
  readonly opponentScoreBefore: number;
  readonly ourScoreAfter: number;
  readonly opponentScoreAfter: number;
  readonly streamVersion: number;
  readonly actorUserId: string;
  readonly now: Date;
}

export type MatchRevisionPage = PagedResult<MatchRevision>;

// --- Scoring engine (pure inputs / outputs) ----------------------------------

/** A score pair. Both sides are always present — an unplayed match is 0–0. */
export interface ScorePair {
  readonly ourScore: number;
  readonly opponentScore: number;
}

/**
 * The evaluated state of the scoreboard under a versioned ruleset: the effective
 * target after any cap, which cap decided it, whether play should end, and who
 * leads. `winner` is null while undecided — never guessed.
 */
export interface ScoreState {
  readonly target: number;
  readonly capApplied: CapKind;
  readonly complete: boolean;
  readonly winner: ScoringSide | null;
  readonly halftimeReached: boolean;
}

/** How many timeouts each side has used and may still call in this period. */
export interface TimeoutState {
  readonly allowance: number;
  readonly usedByUs: number;
  readonly usedByThem: number;
  readonly remainingForUs: number;
  readonly remainingForThem: number;
}

/**
 * The privileged scorekeeper view: the authoritative score, the versioned rules
 * it is measured against, the cap state, the timeout budget, and the stream
 * version an offline device must present to append safely.
 */
export interface MatchScoreboard {
  readonly matchId: string;
  readonly status: MatchStatus;
  readonly ourScore: number;
  readonly opponentScore: number;
  readonly period: number;
  readonly streamVersion: number;
  readonly recordVersion: number;
  readonly revision: number;
  readonly result: MatchResult;
  readonly rulesetKey: string;
  readonly rulesetVersion: number;
  readonly engineVersion: string;
  readonly target: number;
  readonly capApplied: CapKind;
  readonly complete: boolean;
  readonly halftimeReached: boolean;
  readonly timeouts: TimeoutState;
  readonly scoringOpen: boolean;
}

/** The counted timeout usage of the current period, read from the stream. */
export interface TimeoutUsage {
  readonly usedByUs: number;
  readonly usedByThem: number;
}

// --- Scope -------------------------------------------------------------------

/** The resolved team/season/competition scope of a match operation. */
export interface MatchScope {
  readonly competitionId: string;
  readonly seasonId: string;
  readonly homeAway: string;
}

// --- Transport inputs --------------------------------------------------------

export interface MatchContentInput {
  readonly fixtureId: string;
  readonly rosterId?: string | null;
  readonly rulesetId?: string | null;
  readonly notes?: string | null;
}

export interface MatchRulesetContentInput {
  readonly rulesetKey: string;
  readonly seasonId?: string | null;
  readonly name: string;
  readonly gameTo: number;
  readonly winBy?: number | null;
  readonly hardCap?: number | null;
  readonly softCapMinutes?: number | null;
  readonly softCapPlus?: number | null;
  readonly timeCapMinutes?: number | null;
  readonly halftimeAt?: number | null;
  readonly timeoutsPerTeam?: number | null;
  readonly timeoutsPerPeriod?: number | null;
  readonly periods?: number | null;
  readonly notes?: string | null;
}

export interface PointContentInput {
  readonly operationId: string;
  readonly scoringSide: ScoringSide;
  readonly points?: number | null;
  readonly scorerMembershipId?: string | null;
  readonly assistMembershipId?: string | null;
  readonly occurredAt?: string | null;
  readonly expectedStreamVersion?: number | null;
}

export interface TimeoutContentInput {
  readonly operationId: string;
  readonly scoringSide: ScoringSide;
  readonly occurredAt?: string | null;
}
