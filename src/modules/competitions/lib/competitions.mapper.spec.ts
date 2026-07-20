import { describe, expect, it } from 'vitest';

import {
  CompetitionStatus,
  CompetitionType,
  FixtureStatus,
  MatchSide,
  OpponentStatus,
  StageFormat,
} from '../model/competitions.enums';
import type {
  CompetitionRow,
  FixtureRow,
  OpponentRow,
  RoundRow,
  StageRow,
} from '../model/competitions.rows';
import {
  toCompetition,
  toFixture,
  toFixtureView,
  toOpponent,
  toRound,
  toStage,
} from './competitions.mapper';

function competitionRow(): CompetitionRow {
  return {
    id: 'comp-1',
    team_id: 'team-1',
    season_id: 'season-1',
    name: 'Cairo Winter League',
    competition_type: 'league',
    status: 'published',
    gender_division: 'open',
    organizer_name: 'EUF',
    external_ref: 'https://euf.example/leagues/1',
    starts_on: '2026-01-01',
    ends_on: '2026-03-01',
    description: null,
    cancellation_reason: null,
    record_version: 2,
    created_by: 'user-1',
    published_by: 'user-1',
    published_at: '2026-01-01T09:00:00.000Z',
    activated_at: null,
    completed_at: null,
    cancelled_at: null,
    archived_at: null,
    created_at: '2025-12-01T09:00:00.000Z',
    updated_at: '2026-01-01T09:00:00.000Z',
  };
}

function fixtureRow(): FixtureRow {
  return {
    id: 'fixture-1',
    competition_id: 'comp-1',
    team_id: 'team-1',
    season_id: 'season-1',
    stage_id: 'stage-1',
    round_id: 'round-1',
    opponent_id: 'opp-1',
    venue_id: 'venue-1',
    home_away: 'home',
    scheduled_at: '2026-01-15T18:30:00.000Z',
    status: 'scheduled',
    reschedule_count: 0,
    previous_scheduled_at: null,
    reschedule_reason: null,
    cancellation_reason: null,
    record_version: 1,
    created_by: 'user-1',
    rescheduled_at: null,
    finalized_at: null,
    cancelled_at: null,
    created_at: '2025-12-01T09:00:00.000Z',
    updated_at: '2025-12-01T09:00:00.000Z',
  };
}

describe('competitions mapper', () => {
  it('maps a competition row to the domain aggregate', () => {
    const competition = toCompetition(competitionRow());
    expect(competition.competitionId).toBe('comp-1');
    expect(competition.competitionType).toBe(CompetitionType.League);
    expect(competition.status).toBe(CompetitionStatus.Published);
    expect(competition.publishedAt?.toISOString()).toBe(
      '2026-01-01T09:00:00.000Z',
    );
    expect(competition.cancelledAt).toBeNull();
  });

  it('maps a stage and a round row', () => {
    const stageRow: StageRow = {
      id: 'stage-1',
      competition_id: 'comp-1',
      name: 'Group stage',
      stage_format: 'group',
      ordinal: 1,
      created_at: '2025-12-01T09:00:00.000Z',
      updated_at: '2025-12-01T09:00:00.000Z',
    };
    const roundRow: RoundRow = {
      id: 'round-1',
      stage_id: 'stage-1',
      competition_id: 'comp-1',
      name: 'Round 1',
      ordinal: 1,
      created_at: '2025-12-01T09:00:00.000Z',
      updated_at: '2025-12-01T09:00:00.000Z',
    };
    expect(toStage(stageRow).stageFormat).toBe(StageFormat.Group);
    expect(toRound(roundRow).roundId).toBe('round-1');
  });

  it('maps an opponent row', () => {
    const row: OpponentRow = {
      id: 'opp-1',
      team_id: 'team-1',
      name: 'Alexandria Sharks',
      short_name: 'Sharks',
      logo_ref: 'media/sharks.png',
      contact_name: 'Manager',
      contact_info: 'sharks@example.test',
      notes: null,
      status: 'active',
      record_version: 1,
      created_by: 'user-1',
      created_at: '2025-12-01T09:00:00.000Z',
      updated_at: '2025-12-01T09:00:00.000Z',
    };
    const opponent = toOpponent(row);
    expect(opponent.status).toBe(OpponentStatus.Active);
    expect(opponent.shortName).toBe('Sharks');
  });

  it('maps a fixture row and presents its Cairo wall-clock', () => {
    const fixture = toFixture(fixtureRow());
    expect(fixture.homeAway).toBe(MatchSide.Home);
    expect(fixture.status).toBe(FixtureStatus.Scheduled);
    const view = toFixtureView(fixture);
    expect(view.scheduledAt.toISOString()).toBe('2026-01-15T18:30:00.000Z');
    expect(view.scheduledAtCairo).toBe('2026-01-15T20:30');
    expect(view.timezone).toBe('Africa/Cairo');
  });
});
