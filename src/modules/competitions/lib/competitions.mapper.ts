import { CAIRO_TIMEZONE } from '../model/competitions.constants';
import {
  COMPETITION_STATUS_VALUES,
  COMPETITION_TYPE_VALUES,
  FIXTURE_STATUS_VALUES,
  MATCH_SIDE_VALUES,
  OPPONENT_STATUS_VALUES,
  STAGE_FORMAT_VALUES,
} from '../model/competitions.enums';
import type {
  CompetitionRow,
  FixtureRow,
  OpponentRow,
  RoundRow,
  StageRow,
} from '../model/competitions.rows';
import type {
  Competition,
  Fixture,
  FixturePage,
  FixtureView,
  Opponent,
  PageRequest,
  Round,
  Stage,
} from '../model/competitions.types';
import {
  parseEnumValue,
  toCairoWallClock,
  toDate,
  toNullableDate,
} from './competitions.helpers';

export function toCompetition(row: CompetitionRow): Competition {
  return {
    competitionId: row.id,
    teamId: row.team_id,
    seasonId: row.season_id,
    name: row.name,
    competitionType: parseEnumValue(
      COMPETITION_TYPE_VALUES,
      row.competition_type,
      'competition type',
    ),
    status: parseEnumValue(
      COMPETITION_STATUS_VALUES,
      row.status,
      'competition status',
    ),
    genderDivision: row.gender_division,
    organizerName: row.organizer_name,
    externalRef: row.external_ref,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    description: row.description,
    cancellationReason: row.cancellation_reason,
    recordVersion: row.record_version,
    createdBy: row.created_by,
    publishedBy: row.published_by,
    publishedAt: toNullableDate(row.published_at),
    activatedAt: toNullableDate(row.activated_at),
    completedAt: toNullableDate(row.completed_at),
    cancelledAt: toNullableDate(row.cancelled_at),
    archivedAt: toNullableDate(row.archived_at),
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  };
}

export function toStage(row: StageRow): Stage {
  return {
    stageId: row.id,
    competitionId: row.competition_id,
    name: row.name,
    stageFormat: parseEnumValue(
      STAGE_FORMAT_VALUES,
      row.stage_format,
      'stage format',
    ),
    ordinal: row.ordinal,
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  };
}

export function toRound(row: RoundRow): Round {
  return {
    roundId: row.id,
    stageId: row.stage_id,
    competitionId: row.competition_id,
    name: row.name,
    ordinal: row.ordinal,
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  };
}

export function toOpponent(row: OpponentRow): Opponent {
  return {
    opponentId: row.id,
    teamId: row.team_id,
    name: row.name,
    shortName: row.short_name,
    logoRef: row.logo_ref,
    contactName: row.contact_name,
    contactInfo: row.contact_info,
    notes: row.notes,
    status: parseEnumValue(
      OPPONENT_STATUS_VALUES,
      row.status,
      'opponent status',
    ),
    recordVersion: row.record_version,
    createdBy: row.created_by,
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  };
}

export function toFixture(row: FixtureRow): Fixture {
  return {
    fixtureId: row.id,
    competitionId: row.competition_id,
    teamId: row.team_id,
    seasonId: row.season_id,
    stageId: row.stage_id,
    roundId: row.round_id,
    opponentId: row.opponent_id,
    venueId: row.venue_id,
    homeAway: parseEnumValue(MATCH_SIDE_VALUES, row.home_away, 'match side'),
    scheduledAt: toDate(row.scheduled_at),
    status: parseEnumValue(FIXTURE_STATUS_VALUES, row.status, 'fixture status'),
    rescheduleCount: row.reschedule_count,
    previousScheduledAt: toNullableDate(row.previous_scheduled_at),
    rescheduleReason: row.reschedule_reason,
    cancellationReason: row.cancellation_reason,
    recordVersion: row.record_version,
    createdBy: row.created_by,
    rescheduledAt: toNullableDate(row.rescheduled_at),
    finalizedAt: toNullableDate(row.finalized_at),
    cancelledAt: toNullableDate(row.cancelled_at),
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  };
}

/** Present a fixture with its Africa/Cairo wall-clock rendering and timezone. */
export function toFixtureView(fixture: Fixture): FixtureView {
  return {
    ...fixture,
    scheduledAtCairo: toCairoWallClock(fixture.scheduledAt),
    timezone: CAIRO_TIMEZONE,
  };
}

/** Present a bounded page of fixtures as Cairo-aware views. */
export function toFixtureViewPage(
  fixtures: readonly Fixture[],
  total: number,
  page: PageRequest,
): FixturePage {
  return {
    items: fixtures.map(fixture => toFixtureView(fixture)),
    total,
    limit: page.limit,
    offset: page.offset,
  };
}
