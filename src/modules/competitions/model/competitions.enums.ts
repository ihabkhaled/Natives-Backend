/**
 * Enumerations for competitions, stages, opponents, and fixtures (UN-500). Every
 * enum ships a `*_VALUES` tuple so mappers can validate a raw database string
 * against the closed set without a hand-maintained second list. States mirror the
 * `competition` and `fixture` state machines in 11-SCHEMAS/state-machines.yaml.
 */

/**
 * The kind of competition. LEAGUE and CHAMPIONSHIP are recurring official
 * formats; TOURNAMENT is a bracketed event; FRIENDLY is an unranked exhibition;
 * CUSTOM is a team-defined event. One model serves official and custom events —
 * validated metadata only where a proper field is not justified.
 */
export enum CompetitionType {
  League = 'league',
  Championship = 'championship',
  Tournament = 'tournament',
  Friendly = 'friendly',
  Custom = 'custom',
}

export const COMPETITION_TYPE_VALUES: readonly CompetitionType[] =
  Object.values(CompetitionType);

/**
 * Lifecycle of a competition. A `draft` is the editable working copy; `published`
 * is visible and scheduled; `active` is in progress; `completed` has finished;
 * `cancelled` was called off (historical fixtures are preserved, never deleted);
 * `archived` is a read-only historical record.
 */
export enum CompetitionStatus {
  Draft = 'draft',
  Published = 'published',
  Active = 'active',
  Completed = 'completed',
  Cancelled = 'cancelled',
  Archived = 'archived',
}

export const COMPETITION_STATUS_VALUES: readonly CompetitionStatus[] =
  Object.values(CompetitionStatus);

/** A requested lifecycle transition verb for a competition. */
export enum CompetitionTransition {
  Publish = 'publish',
  Activate = 'activate',
  Complete = 'complete',
  Cancel = 'cancel',
  Archive = 'archive',
}

export const COMPETITION_TRANSITION_VALUES: readonly CompetitionTransition[] =
  Object.values(CompetitionTransition);

/** The structural format of a stage within a competition. */
export enum StageFormat {
  Group = 'group',
  Pool = 'pool',
  Bracket = 'bracket',
  Knockout = 'knockout',
  RoundRobin = 'round_robin',
}

export const STAGE_FORMAT_VALUES: readonly StageFormat[] =
  Object.values(StageFormat);

/** Lifecycle of an opponent-catalog entry. Only an `active` opponent is bookable. */
export enum OpponentStatus {
  Active = 'active',
  Archived = 'archived',
}

export const OPPONENT_STATUS_VALUES: readonly OpponentStatus[] =
  Object.values(OpponentStatus);

/** Which side the team plays a fixture on. Neutral = a neutral-ground fixture. */
export enum MatchSide {
  Home = 'home',
  Away = 'away',
  Neutral = 'neutral',
}

export const MATCH_SIDE_VALUES: readonly MatchSide[] = Object.values(MatchSide);

/**
 * Lifecycle of a fixture (a scheduled match versus a catalogued opponent).
 * `scheduled` is the initial booking; `rescheduled` marks a moved fixture;
 * `ready` is locked for play; `live` is in progress; `final` has a recorded
 * result; `abandoned` was stopped mid-play; `cancelled` was called off (kept for
 * history). Match play and scoring are later prompts — this is the schedule shell.
 */
export enum FixtureStatus {
  Scheduled = 'scheduled',
  Rescheduled = 'rescheduled',
  Ready = 'ready',
  Live = 'live',
  Final = 'final',
  Abandoned = 'abandoned',
  Cancelled = 'cancelled',
}

export const FIXTURE_STATUS_VALUES: readonly FixtureStatus[] =
  Object.values(FixtureStatus);

/** A requested lifecycle transition verb for a fixture (reschedule is separate). */
export enum FixtureTransition {
  Ready = 'ready',
  Start = 'start',
  Finalize = 'finalize',
  Abandon = 'abandon',
  Cancel = 'cancel',
}

export const FIXTURE_TRANSITION_VALUES: readonly FixtureTransition[] =
  Object.values(FixtureTransition);
