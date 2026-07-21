/**
 * Enumerations for match lifecycle, live scoreboard, caps, timeouts, and
 * corrections (UN-503). Every enum ships a `*_VALUES` tuple so mappers validate a
 * raw database string against the closed set without a hand-maintained second
 * list.
 *
 * The vocabulary is deliberately append-only: a `finalized` match is IMMUTABLE,
 * and correcting one produces a new audited revision (reopen → re-finalize)
 * rather than an in-place edit, so the score that was published is always
 * recoverable exactly as it stood.
 */

/**
 * Lifecycle of a match. `scheduled` is the shell created against a fixture;
 * `ready` means roster and ruleset are attached and the scorekeeper may start;
 * `live` is the only state that accepts score events; `paused` and `halftime` are
 * temporary stoppages; `completed` means play ended and the score is settled but
 * not yet published; `finalized` is the immutable published result; `abandoned`
 * is the terminal off-ramp for a match that was never completed.
 */
export enum MatchStatus {
  Scheduled = 'scheduled',
  Ready = 'ready',
  Live = 'live',
  Paused = 'paused',
  Halftime = 'halftime',
  Completed = 'completed',
  Finalized = 'finalized',
  Abandoned = 'abandoned',
}

export const MATCH_STATUS_VALUES: readonly MatchStatus[] =
  Object.values(MatchStatus);

/**
 * The lifecycle verbs the plain transition endpoint accepts (match.manage).
 * Finalizing and reopening are separate, separately-permissioned endpoints
 * (`match.finalize` / `match.correct`), so they are deliberately absent here.
 */
export enum MatchTransition {
  Ready = 'ready',
  Start = 'start',
  Pause = 'pause',
  Resume = 'resume',
  Halftime = 'halftime',
  Complete = 'complete',
  Abandon = 'abandon',
}

export const MATCH_TRANSITION_VALUES: readonly MatchTransition[] =
  Object.values(MatchTransition);

/**
 * The kinds of fact recorded on the append-only match stream. `point` is the only
 * scoring event; `timeout`, `period_start`, and `period_end` are clock facts;
 * `cap_applied` records that a configured cap changed the target; `void`
 * compensates a previously accepted event (history is added to, never deleted).
 */
export enum MatchEventType {
  Point = 'point',
  Timeout = 'timeout',
  PeriodStart = 'period_start',
  PeriodEnd = 'period_end',
  CapApplied = 'cap_applied',
  Void = 'void',
}

export const MATCH_EVENT_TYPE_VALUES: readonly MatchEventType[] =
  Object.values(MatchEventType);

/** Which side an event belongs to. `null` on the stream means "neither side". */
export enum ScoringSide {
  Us = 'us',
  Them = 'them',
}

export const SCORING_SIDE_VALUES: readonly ScoringSide[] =
  Object.values(ScoringSide);

/**
 * The settled outcome of a match. `undecided` is the honest value while play is
 * unfinished or a match was abandoned — it is never coerced to a loss, and a
 * drawn match is a `draw`, never a missing result.
 */
export enum MatchResult {
  Win = 'win',
  Loss = 'loss',
  Draw = 'draw',
  Undecided = 'undecided',
}

export const MATCH_RESULT_VALUES: readonly MatchResult[] =
  Object.values(MatchResult);

/**
 * Which configured cap (if any) decided the effective target. `none` means the
 * plain game-to target still applies; caps are read from the VERSIONED ruleset and
 * are never hard-coded in the rules engine.
 */
export enum CapKind {
  None = 'none',
  Soft = 'soft',
  Hard = 'hard',
  Time = 'time',
}

export const CAP_KIND_VALUES: readonly CapKind[] = Object.values(CapKind);

/** Lifecycle of a versioned ruleset. Only an `active` ruleset may start a match. */
export enum RulesetStatus {
  Draft = 'draft',
  Active = 'active',
  Archived = 'archived',
}

export const RULESET_STATUS_VALUES: readonly RulesetStatus[] =
  Object.values(RulesetStatus);

/**
 * What an immutable revision row records. `finalized` publishes an authoritative
 * score; `reopened` unlocks a finalized match under an explicit reason; `corrected`
 * republishes it. Every row carries the score before and after, so a conflicting
 * final score is always visible as a delta and never silently merged.
 */
export enum MatchRevisionAction {
  Finalized = 'finalized',
  Reopened = 'reopened',
  Corrected = 'corrected',
}

export const MATCH_REVISION_ACTION_VALUES: readonly MatchRevisionAction[] =
  Object.values(MatchRevisionAction);

/**
 * How the server classified an incoming client operation id. `applied` is a new
 * operation, `replayed` is the same operation with the same payload (an offline
 * scorekeeper retry — it produces exactly one score change), and a differing
 * payload under the same id is a CONFLICT and is rejected, never merged.
 */
export enum OperationOutcome {
  Applied = 'applied',
  Replayed = 'replayed',
  Conflict = 'conflict',
}

export const OPERATION_OUTCOME_VALUES: readonly OperationOutcome[] =
  Object.values(OperationOutcome);

/**
 * Which line a point was started on. This is the ONLY input that decides whether
 * winning the point is a hold or a break, so it is recorded as a fact when the
 * line takes the field rather than inferred afterwards from the score.
 */
export enum PointStartingLine {
  Offense = 'offense',
  Defense = 'defense',
}

export const POINT_STARTING_LINE_VALUES: readonly PointStartingLine[] =
  Object.values(PointStartingLine);

/**
 * How a completed point is classified. Winning a point started on offense is a
 * `hold`; winning one started on defense is a `break`. The mirror pair records
 * the same fact from the opponent's side, so a scoreboard and a break count can
 * never disagree.
 */
export enum PointOutcome {
  Hold = 'hold',
  Break = 'break',
  OpponentHold = 'opponent_hold',
  OpponentBreak = 'opponent_break',
}

export const POINT_OUTCOME_VALUES: readonly PointOutcome[] =
  Object.values(PointOutcome);

/**
 * The grammar of the point/possession stream (UN-504). `point_started` opens a
 * point and carries the line that took the field; `point_completed` closes it and
 * names the scoring side; everything between them is a possession fact.
 * `correction` is the compensating retraction — a recorded fact is never deleted
 * or rewritten, so a corrected stream still replays to the same statistics as a
 * clean one.
 */
export enum MatchPlayType {
  PointStarted = 'point_started',
  PointCompleted = 'point_completed',
  Pull = 'pull',
  Throw = 'throw',
  Completion = 'completion',
  Goal = 'goal',
  Drop = 'drop',
  Throwaway = 'throwaway',
  Block = 'block',
  Stall = 'stall',
  Call = 'call',
  Turnover = 'turnover',
  Substitution = 'substitution',
  OpponentDrop = 'opponent_drop',
  OpponentThrowaway = 'opponent_throwaway',
  Correction = 'correction',
}

export const MATCH_PLAY_TYPE_VALUES: readonly MatchPlayType[] =
  Object.values(MatchPlayType);

/**
 * Whether a goal's assist is a recorded fact, a deliberate "there was none"
 * (a Callahan or an unassisted goal), or simply not known. This is the
 * null-not-zero distinction at event level: `none` is a MEASURED absence that
 * counts as an explained goal, `unknown` is missing data that is never inferred.
 */
export enum AssistState {
  Recorded = 'recorded',
  None = 'none',
  Unknown = 'unknown',
}

export const ASSIST_STATE_VALUES: readonly AssistState[] =
  Object.values(AssistState);
