import type {
  CompetitionContent,
  CompetitionContentInput,
  FixtureContent,
  FixtureContentInput,
  OpponentContent,
  OpponentContentInput,
} from '../model/competitions.types';

/**
 * Normalizes loosely-typed transport input into the strict command shapes. Absent
 * optional fields become explicit nulls (never coerced away), keeping controllers
 * a single delegation and downstream layers free of `undefined`.
 */
export function toCompetitionContent(
  input: CompetitionContentInput,
): CompetitionContent {
  return {
    name: input.name,
    competitionType: input.competitionType,
    seasonId: input.seasonId,
    genderDivision: input.genderDivision ?? null,
    organizerName: input.organizerName ?? null,
    externalRef: input.externalRef ?? null,
    startsOn: input.startsOn ?? null,
    endsOn: input.endsOn ?? null,
    description: input.description ?? null,
  };
}

export function toOpponentContent(
  input: OpponentContentInput,
): OpponentContent {
  return {
    name: input.name,
    shortName: input.shortName ?? null,
    logoRef: input.logoRef ?? null,
    contactName: input.contactName ?? null,
    contactInfo: input.contactInfo ?? null,
    notes: input.notes ?? null,
  };
}

export function toFixtureContent(input: FixtureContentInput): FixtureContent {
  return {
    opponentId: input.opponentId,
    stageId: input.stageId ?? null,
    roundId: input.roundId ?? null,
    venueId: input.venueId ?? null,
    homeAway: input.homeAway,
    scheduledAt: input.scheduledAt,
  };
}
