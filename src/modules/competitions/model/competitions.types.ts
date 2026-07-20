import type {
  CompetitionStatus,
  CompetitionTransition,
  CompetitionType,
  FixtureStatus,
  FixtureTransition,
  MatchSide,
  OpponentStatus,
  StageFormat,
} from './competitions.enums';

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

// --- Competition -------------------------------------------------------------

/** The full persisted competition aggregate. */
export interface Competition {
  readonly competitionId: string;
  readonly teamId: string;
  readonly seasonId: string;
  readonly name: string;
  readonly competitionType: CompetitionType;
  readonly status: CompetitionStatus;
  readonly genderDivision: string | null;
  readonly organizerName: string | null;
  readonly externalRef: string | null;
  readonly startsOn: string | null;
  readonly endsOn: string | null;
  readonly description: string | null;
  readonly cancellationReason: string | null;
  readonly recordVersion: number;
  readonly createdBy: string | null;
  readonly publishedBy: string | null;
  readonly publishedAt: Date | null;
  readonly activatedAt: Date | null;
  readonly completedAt: Date | null;
  readonly cancelledAt: Date | null;
  readonly archivedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** Author-supplied content of a competition (create command). */
export interface CompetitionContent {
  readonly name: string;
  readonly competitionType: CompetitionType;
  readonly seasonId: string;
  readonly genderDivision: string | null;
  readonly organizerName: string | null;
  readonly externalRef: string | null;
  readonly startsOn: string | null;
  readonly endsOn: string | null;
  readonly description: string | null;
}

/** A fully-resolved new competition row ready for insertion. */
export interface NewCompetition {
  readonly id: string;
  readonly teamId: string;
  readonly content: CompetitionContent;
  readonly createdBy: string;
  readonly now: Date;
}

/** An optimistic-version-guarded lifecycle status change of a competition. */
export interface CompetitionStatusChange {
  readonly id: string;
  readonly teamId: string;
  readonly expectedRecordVersion: number;
  readonly toStatus: CompetitionStatus;
  readonly publishedBy: string | null;
  readonly publishedAt: Date | null;
  readonly activatedAt: Date | null;
  readonly completedAt: Date | null;
  readonly cancelledAt: Date | null;
  readonly archivedAt: Date | null;
  readonly cancellationReason: string | null;
  readonly now: Date;
}

export interface CreateCompetitionCommand {
  readonly content: CompetitionContent;
}

export interface TransitionCompetitionCommand {
  readonly transition: CompetitionTransition;
  readonly expectedRecordVersion: number;
  readonly reason: string | null;
}

// --- Stages / rounds ---------------------------------------------------------

export interface Stage {
  readonly stageId: string;
  readonly competitionId: string;
  readonly name: string;
  readonly stageFormat: StageFormat;
  readonly ordinal: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface NewStage {
  readonly id: string;
  readonly competitionId: string;
  readonly name: string;
  readonly stageFormat: StageFormat;
  readonly ordinal: number;
  readonly now: Date;
}

export interface StageContent {
  readonly name: string;
  readonly stageFormat: StageFormat;
}

export interface CreateStageCommand {
  readonly content: StageContent;
}

export interface Round {
  readonly roundId: string;
  readonly stageId: string;
  readonly competitionId: string;
  readonly name: string;
  readonly ordinal: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface NewRound {
  readonly id: string;
  readonly stageId: string;
  readonly competitionId: string;
  readonly name: string;
  readonly ordinal: number;
  readonly now: Date;
}

export interface RoundContent {
  readonly stageId: string;
  readonly name: string;
}

export interface CreateRoundCommand {
  readonly content: RoundContent;
}

/** The full stage/round structure of a competition. */
export interface CompetitionStructure {
  readonly stages: readonly Stage[];
  readonly rounds: readonly Round[];
}

// --- Opponents ---------------------------------------------------------------

export interface Opponent {
  readonly opponentId: string;
  readonly teamId: string;
  readonly name: string;
  readonly shortName: string | null;
  readonly logoRef: string | null;
  readonly contactName: string | null;
  readonly contactInfo: string | null;
  readonly notes: string | null;
  readonly status: OpponentStatus;
  readonly recordVersion: number;
  readonly createdBy: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface OpponentContent {
  readonly name: string;
  readonly shortName: string | null;
  readonly logoRef: string | null;
  readonly contactName: string | null;
  readonly contactInfo: string | null;
  readonly notes: string | null;
}

export interface NewOpponent {
  readonly id: string;
  readonly teamId: string;
  readonly content: OpponentContent;
  readonly createdBy: string;
  readonly now: Date;
}

export interface CreateOpponentCommand {
  readonly content: OpponentContent;
}

export type OpponentPage = PagedResult<Opponent>;

// --- Fixtures ----------------------------------------------------------------

/** The full persisted fixture aggregate. */
export interface Fixture {
  readonly fixtureId: string;
  readonly competitionId: string;
  readonly teamId: string;
  readonly seasonId: string | null;
  readonly stageId: string | null;
  readonly roundId: string | null;
  readonly opponentId: string;
  readonly venueId: string | null;
  readonly homeAway: MatchSide;
  readonly scheduledAt: Date;
  readonly status: FixtureStatus;
  readonly rescheduleCount: number;
  readonly previousScheduledAt: Date | null;
  readonly rescheduleReason: string | null;
  readonly cancellationReason: string | null;
  readonly recordVersion: number;
  readonly createdBy: string | null;
  readonly rescheduledAt: Date | null;
  readonly finalizedAt: Date | null;
  readonly cancelledAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** Author-supplied content of a fixture (create command). */
export interface FixtureContent {
  readonly opponentId: string;
  readonly stageId: string | null;
  readonly roundId: string | null;
  readonly venueId: string | null;
  readonly homeAway: MatchSide;
  readonly scheduledAt: string;
}

/** A fully-resolved new fixture row ready for insertion. */
export interface NewFixture {
  readonly id: string;
  readonly competitionId: string;
  readonly teamId: string;
  readonly seasonId: string;
  readonly content: FixtureContent;
  readonly scheduledAt: Date;
  readonly createdBy: string;
  readonly now: Date;
}

/** An optimistic-version-guarded reschedule of a fixture. */
export interface FixtureReschedule {
  readonly id: string;
  readonly teamId: string;
  readonly expectedRecordVersion: number;
  readonly newScheduledAt: Date;
  readonly previousScheduledAt: Date;
  readonly venueId: string | null;
  readonly reason: string | null;
  readonly now: Date;
}

/** An optimistic-version-guarded lifecycle status change of a fixture. */
export interface FixtureStatusChange {
  readonly id: string;
  readonly teamId: string;
  readonly expectedRecordVersion: number;
  readonly toStatus: FixtureStatus;
  readonly finalizedAt: Date | null;
  readonly cancelledAt: Date | null;
  readonly cancellationReason: string | null;
  readonly now: Date;
}

export interface CreateFixtureCommand {
  readonly content: FixtureContent;
}

export interface RescheduleFixtureCommand {
  readonly scheduledAt: string;
  readonly venueId: string | null;
  readonly reason: string | null;
  readonly expectedRecordVersion: number;
}

export interface TransitionFixtureCommand {
  readonly transition: FixtureTransition;
  readonly expectedRecordVersion: number;
  readonly reason: string | null;
}

/**
 * A fixture as presented to the API: the stored UTC instant plus its Africa/Cairo
 * wall-clock rendering and the presentation timezone, so the client never has to
 * infer the local schedule from a bare UTC instant.
 */
export interface FixtureView extends Fixture {
  readonly scheduledAtCairo: string;
  readonly timezone: string;
}

export type CompetitionPage = PagedResult<Competition>;
export type FixturePage = PagedResult<FixtureView>;

// --- Transport inputs --------------------------------------------------------

export interface CompetitionContentInput {
  readonly name: string;
  readonly competitionType: CompetitionType;
  readonly seasonId: string;
  readonly genderDivision?: string | null;
  readonly organizerName?: string | null;
  readonly externalRef?: string | null;
  readonly startsOn?: string | null;
  readonly endsOn?: string | null;
  readonly description?: string | null;
}

export interface OpponentContentInput {
  readonly name: string;
  readonly shortName?: string | null;
  readonly logoRef?: string | null;
  readonly contactName?: string | null;
  readonly contactInfo?: string | null;
  readonly notes?: string | null;
}

export interface FixtureContentInput {
  readonly opponentId: string;
  readonly stageId?: string | null;
  readonly roundId?: string | null;
  readonly venueId?: string | null;
  readonly homeAway: MatchSide;
  readonly scheduledAt: string;
}
