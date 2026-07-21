import type {
  AssistState,
  CapKind,
  MatchEventType,
  MatchPlayType,
  MatchResult,
  MatchRevisionAction,
  MatchStatus,
  MatchTransition,
  OperationOutcome,
  PointOutcome,
  PointStartingLine,
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
  /**
   * Whether this competition's rules APPROVE crediting a forced opponent error
   * (their drop or throwaway) to one of our players. When it is false the
   * statistics projection reports the per-player figure as `null` — "not
   * evaluated under these rules" — rather than a misleading zero.
   */
  readonly opponentErrorAttribution: boolean;
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
  readonly opponentErrorAttribution: boolean;
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
  readonly opponentErrorAttribution?: boolean | null;
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

// --- Point lineups and possession events (UN-504) ----------------------------

/**
 * Anything already stored under a client operation id that can be compared by
 * payload fingerprint. Both append-only streams of this module classify a replay
 * through the same pure rule, so an offline device gets the same guarantee
 * whichever stream it is retrying against.
 */
export interface RequestHashCarrier {
  readonly requestHash: string;
}

/**
 * One immutable fact on a match's point/possession stream. `retracted` is
 * DERIVED from the existence of a later compensating `correction` pointing back
 * at this row — a recorded fact is never rewritten, so the statistics stay a
 * replayable projection rather than an edited total.
 */
export interface MatchPlayEvent {
  readonly playId: string;
  readonly matchId: string;
  readonly teamId: string;
  readonly sequence: number;
  readonly operationId: string;
  readonly requestHash: string;
  readonly playType: MatchPlayType;
  readonly pointNumber: number;
  readonly period: number;
  readonly startingLine: PointStartingLine | null;
  readonly scoringSide: ScoringSide | null;
  readonly primaryMembershipId: string | null;
  readonly secondaryMembershipId: string | null;
  readonly assistState: AssistState | null;
  readonly callahan: boolean;
  readonly durationSeconds: number | null;
  readonly correctsPlayId: string | null;
  readonly correctionReason: string | null;
  readonly retracted: boolean;
  readonly notes: string | null;
  readonly recordedBy: string | null;
  readonly occurredAt: Date | null;
  readonly recordedAt: Date;
}

/** A fully-resolved play row ready for its single, append-only insert. */
export interface NewMatchPlayEvent {
  readonly id: string;
  readonly matchId: string;
  readonly teamId: string;
  readonly sequence: number;
  readonly operationId: string;
  readonly requestHash: string;
  readonly playType: MatchPlayType;
  readonly pointNumber: number;
  readonly period: number;
  readonly startingLine: PointStartingLine | null;
  readonly scoringSide: ScoringSide | null;
  readonly primaryMembershipId: string | null;
  readonly secondaryMembershipId: string | null;
  readonly assistState: AssistState | null;
  readonly callahan: boolean;
  readonly durationSeconds: number | null;
  readonly correctsPlayId: string | null;
  readonly correctionReason: string | null;
  readonly notes: string | null;
  readonly recordedBy: string;
  readonly occurredAt: Date | null;
  readonly now: Date;
}

/** One player recorded as being on the line for a point. */
export interface MatchPointLineupEntry {
  readonly lineupId: string;
  readonly matchId: string;
  readonly playId: string;
  readonly pointNumber: number;
  readonly membershipId: string;
  readonly rosterEntryId: string | null;
  readonly puller: boolean;
}

/** A fully-resolved lineup row ready for insertion alongside its point. */
export interface NewMatchPointLineupEntry {
  readonly id: string;
  readonly matchId: string;
  readonly teamId: string;
  readonly playId: string;
  readonly pointNumber: number;
  readonly membershipId: string;
  readonly rosterEntryId: string | null;
  readonly puller: boolean;
  readonly now: Date;
}

/** The point currently open on the stream: started and not yet completed. */
export interface OpenMatchPoint {
  readonly playId: string;
  readonly pointNumber: number;
  readonly period: number;
  readonly startingLine: PointStartingLine;
}

/** Author-supplied content of a point-start (lineup) operation. */
export interface StartPointContent {
  readonly operationId: string;
  readonly startingLine: PointStartingLine;
  readonly lineMembershipIds: readonly string[];
  readonly pullerMembershipId: string | null;
  readonly occurredAt: string | null;
  readonly notes: string | null;
}

/** Author-supplied content of a point-completion operation. */
export interface CompletePointContent {
  readonly operationId: string;
  readonly scoringSide: ScoringSide;
  readonly durationSeconds: number | null;
  readonly occurredAt: string | null;
  readonly notes: string | null;
}

/** Author-supplied content of one possession fact inside an open point. */
export interface PlayContent {
  readonly operationId: string;
  readonly playType: MatchPlayType;
  readonly primaryMembershipId: string | null;
  readonly secondaryMembershipId: string | null;
  readonly assistState: AssistState;
  readonly callahan: boolean;
  readonly occurredAt: string | null;
  readonly notes: string | null;
}

/** Author-supplied content of a compensating retraction. */
export interface CorrectionContent {
  readonly operationId: string;
  readonly playId: string;
  readonly reason: string;
}

export interface StartPointCommand {
  readonly content: StartPointContent;
}

export interface CompletePointCommand {
  readonly content: CompletePointContent;
}

export interface RecordPlayCommand {
  readonly content: PlayContent;
}

export interface CorrectPlayCommand {
  readonly content: CorrectionContent;
}

/** The result of an idempotent point-stream write. */
export interface MatchPlayResult {
  readonly outcome: OperationOutcome;
  readonly play: MatchPlayEvent;
  readonly pointNumber: number;
  readonly lineup: readonly MatchPointLineupEntry[];
}

export type MatchPlayPage = PagedResult<MatchPlayEvent>;

export interface StartPointContentInput {
  readonly operationId: string;
  readonly startingLine: PointStartingLine;
  readonly lineMembershipIds: readonly string[];
  readonly pullerMembershipId?: string | null;
  readonly occurredAt?: string | null;
  readonly notes?: string | null;
}

export interface CompletePointContentInput {
  readonly operationId: string;
  readonly scoringSide: ScoringSide;
  readonly durationSeconds?: number | null;
  readonly occurredAt?: string | null;
  readonly notes?: string | null;
}

export interface PlayContentInput {
  readonly operationId: string;
  readonly playType: MatchPlayType;
  readonly primaryMembershipId?: string | null;
  readonly secondaryMembershipId?: string | null;
  readonly assistState?: AssistState | null;
  readonly callahan?: boolean | null;
  readonly occurredAt?: string | null;
  readonly notes?: string | null;
}

export interface CorrectionContentInput {
  readonly operationId: string;
  readonly playId: string;
  readonly reason: string;
}

// --- Derived match statistics (projections, never stored totals) -------------

/** One rostered player of the match, present even with nothing recorded. */
export interface MatchRosterMember {
  readonly membershipId: string;
  readonly rosterEntryId: string | null;
}

/**
 * The complete, ordered input the pure derivation engine folds into statistics.
 * Everything here comes from source records: the append-only stream, the lineup
 * rows attached to it, the match roster, and the VERSIONED ruleset.
 */
export interface MatchStatisticsSource {
  readonly matchId: string;
  readonly teamId: string;
  readonly rulesetKey: string;
  readonly rulesetVersion: number;
  readonly opponentErrorAttribution: boolean;
  readonly plays: readonly MatchPlayEvent[];
  readonly lineups: readonly MatchPointLineupEntry[];
  readonly roster: readonly MatchRosterMember[];
}

/**
 * Per-player derived statistics. EVERY field is nullable on purpose: `null`
 * means the figure was NOT MEASURED for this match (no lineups recorded, no
 * possession facts recorded, or opponent-error attribution not approved by the
 * ruleset), while `0` is a measured zero for a rostered player who was present
 * in the data and simply did not register that action.
 */
export interface PlayerMatchStatistics {
  readonly membershipId: string;
  readonly rosterEntryId: string | null;
  readonly rostered: boolean;
  readonly pointsPlayed: number | null;
  readonly offencePointsPlayed: number | null;
  readonly defencePointsPlayed: number | null;
  readonly goals: number | null;
  readonly assists: number | null;
  readonly callahans: number | null;
  readonly drops: number | null;
  readonly throwaways: number | null;
  readonly blocks: number | null;
  readonly opponentErrorsForced: number | null;
}

/** Team-level derived statistics for the match. */
export interface TeamMatchStatistics {
  readonly pointsStarted: number;
  readonly pointsCompleted: number;
  readonly holds: number;
  readonly breaks: number;
  readonly opponentHolds: number;
  readonly opponentBreaks: number;
  readonly goalsFor: number;
  readonly goalsAgainst: number;
  readonly drops: number | null;
  readonly throwaways: number | null;
  readonly blocks: number | null;
  readonly turnovers: number | null;
  readonly opponentErrors: number | null;
}

/**
 * The whole statistics projection. It cites the ruleset key/version and the
 * named engine version it was derived under, so any displayed number can be
 * explained and re-derived rather than merely trusted.
 */
export interface MatchStatistics {
  readonly matchId: string;
  readonly teamId: string;
  readonly rulesetKey: string;
  readonly rulesetVersion: number;
  readonly statsEngineVersion: string;
  readonly lineupsRecorded: boolean;
  readonly playsRecorded: boolean;
  readonly opponentErrorAttribution: boolean;
  readonly team: TeamMatchStatistics;
  readonly players: readonly PlayerMatchStatistics[];
}

/**
 * The mutable per-player accumulator the pure derivation engine folds the stream
 * into. It is deliberately the ONLY mutable shape in this module and never
 * leaves the engine: what callers see is the immutable `PlayerMatchStatistics`
 * projection built from it, so there is no editable stored total anywhere.
 */
export interface PlayerCounters {
  pointsPlayed: number;
  offencePointsPlayed: number;
  defencePointsPlayed: number;
  goals: number;
  assists: number;
  callahans: number;
  drops: number;
  throwaways: number;
  blocks: number;
  opponentErrorsForced: number;
}

/** One completed point reduced to the facts hold/break classification needs. */
export interface ResolvedMatchPoint {
  readonly pointNumber: number;
  readonly startingLine: PointStartingLine;
  readonly scoringSide: ScoringSide;
  readonly outcome: PointOutcome;
  readonly playId: string;
}
