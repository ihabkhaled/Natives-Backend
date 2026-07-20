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
