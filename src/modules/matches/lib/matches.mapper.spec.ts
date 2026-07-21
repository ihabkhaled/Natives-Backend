import { describe, expect, it } from 'vitest';

import {
  AssistState,
  CapKind,
  MatchEventType,
  MatchPlayType,
  MatchResult,
  MatchRevisionAction,
  MatchStatus,
  PointStartingLine,
  RulesetStatus,
  ScoringSide,
} from '../model/matches.enums';
import type {
  MatchEventRow,
  MatchRevisionRow,
  MatchRow,
  MatchRulesetRow,
} from '../model/matches.rows';
import {
  toMatch,
  toMatchEvent,
  toMatchPlayEvent,
  toMatchPointLineupEntry,
  toMatchRevision,
  toMatchRosterMember,
  toMatchRuleset,
  toMatchScope,
  toOpenMatchPoint,
} from './matches.mapper';

const NOW = new Date('2026-03-01T10:00:00.000Z');

function matchRow(overrides: Partial<MatchRow> = {}): MatchRow {
  return {
    id: 'match-1',
    team_id: 'team-1',
    season_id: 'season-1',
    competition_id: 'comp-1',
    fixture_id: 'fixture-1',
    roster_id: null,
    ruleset_id: 'rules-1',
    status: 'live',
    home_away: 'home',
    our_score: '4',
    opponent_score: 3,
    period: '1',
    stream_version: '7',
    record_version: '8',
    revision: '1',
    result: 'undecided',
    cap_applied: 'none',
    engine_version: 'match-scoring-v1',
    supersedes_match_id: null,
    reopen_reason: null,
    reopened_by: null,
    reopened_at: null,
    created_by: 'user-1',
    started_at: NOW,
    paused_at: null,
    resumed_at: null,
    halftime_at: null,
    completed_at: null,
    finalized_by: null,
    finalized_at: null,
    abandoned_at: null,
    abandon_reason: null,
    notes: null,
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

function eventRow(overrides: Partial<MatchEventRow> = {}): MatchEventRow {
  return {
    id: 'event-1',
    match_id: 'match-1',
    team_id: 'team-1',
    sequence: '4',
    operation_id: 'op-abcdef01',
    request_hash: 'hash-a',
    event_type: 'point',
    scoring_side: 'us',
    points: '1',
    our_score_after: '4',
    opponent_score_after: '3',
    period: '1',
    scorer_membership_id: null,
    assist_membership_id: null,
    voids_event_id: null,
    voided: false,
    void_reason: null,
    recorded_by: 'user-1',
    occurred_at: null,
    recorded_at: NOW,
    ...overrides,
  };
}

function rulesetRow(overrides: Partial<MatchRulesetRow> = {}): MatchRulesetRow {
  return {
    id: 'rules-1',
    team_id: 'team-1',
    season_id: null,
    ruleset_key: 'wfdf-indoor',
    ruleset_version: '2',
    name: 'Indoor',
    game_to: '15',
    win_by: '2',
    hard_cap: null,
    soft_cap_minutes: null,
    soft_cap_plus: null,
    time_cap_minutes: null,
    halftime_at: null,
    timeouts_per_team: '2',
    timeouts_per_period: null,
    periods: '2',
    opponent_error_attribution: true,
    status: 'active',
    notes: null,
    created_by: null,
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

function revisionRow(
  overrides: Partial<MatchRevisionRow> = {},
): MatchRevisionRow {
  return {
    id: 'revision-1',
    match_id: 'match-1',
    team_id: 'team-1',
    sequence: '1',
    revision: '1',
    action: 'finalized',
    reason: 'published',
    from_status: 'completed',
    to_status: 'finalized',
    our_score_before: '15',
    opponent_score_before: '12',
    our_score_after: '15',
    opponent_score_after: '12',
    stream_version: '27',
    actor_user_id: 'admin-1',
    created_at: NOW,
    ...overrides,
  };
}

describe('matches mapper', () => {
  it('maps a match row into the aggregate, coercing numeric columns', () => {
    const match = toMatch(matchRow());
    expect(match).toMatchObject({
      matchId: 'match-1',
      status: MatchStatus.Live,
      result: MatchResult.Undecided,
      capApplied: CapKind.None,
      ourScore: 4,
      opponentScore: 3,
      streamVersion: 7,
      recordVersion: 8,
      revision: 1,
    });
    expect(match.startedAt).toEqual(NOW);
    expect(match.finalizedAt).toBeNull();
  });

  it('rejects a status outside the closed set', () => {
    expect(() => toMatch(matchRow({ status: 'nonsense' }))).toThrow(
      'Unrecognized match status: nonsense',
    );
  });

  it('maps a stream row and preserves an unattributed point as null', () => {
    const event = toMatchEvent(eventRow());
    expect(event).toMatchObject({
      eventId: 'event-1',
      sequence: 4,
      eventType: MatchEventType.Point,
      scoringSide: ScoringSide.Us,
      points: 1,
      ourScoreAfter: 4,
      voided: false,
    });
    expect(event.scorerMembershipId).toBeNull();
    expect(event.occurredAt).toBeNull();
  });

  it('maps a non-scoring event with a null side and null points', () => {
    const event = toMatchEvent(
      eventRow({
        event_type: 'period_start',
        scoring_side: null,
        points: null,
      }),
    );
    expect(event.eventType).toBe(MatchEventType.PeriodStart);
    expect(event.scoringSide).toBeNull();
    expect(event.points).toBeNull();
  });

  it('maps a ruleset and keeps every unconfigured cap null, never zero', () => {
    const ruleset = toMatchRuleset(rulesetRow());
    expect(ruleset).toMatchObject({
      rulesetKey: 'wfdf-indoor',
      rulesetVersion: 2,
      gameTo: 15,
      winBy: 2,
      timeoutsPerTeam: 2,
      periods: 2,
      opponentErrorAttribution: true,
      status: RulesetStatus.Active,
    });
    expect(ruleset.hardCap).toBeNull();
    expect(ruleset.softCapMinutes).toBeNull();
    expect(ruleset.softCapPlus).toBeNull();
    expect(ruleset.timeCapMinutes).toBeNull();
    expect(ruleset.halftimeAt).toBeNull();
    expect(ruleset.timeoutsPerPeriod).toBeNull();
  });

  it('maps a configured cap through as a real number', () => {
    const ruleset = toMatchRuleset(
      rulesetRow({
        hard_cap: '17',
        soft_cap_minutes: '40',
        soft_cap_plus: '1',
        time_cap_minutes: '60',
        halftime_at: '8',
        timeouts_per_period: '0',
      }),
    );
    expect(ruleset.hardCap).toBe(17);
    expect(ruleset.softCapMinutes).toBe(40);
    expect(ruleset.softCapPlus).toBe(1);
    expect(ruleset.timeCapMinutes).toBe(60);
    expect(ruleset.halftimeAt).toBe(8);
    expect(ruleset.timeoutsPerPeriod).toBe(0);
  });

  it('maps a revision row with both score pairs intact', () => {
    const revision = toMatchRevision(revisionRow());
    expect(revision).toMatchObject({
      revisionId: 'revision-1',
      sequence: 1,
      revision: 1,
      action: MatchRevisionAction.Finalized,
      fromStatus: MatchStatus.Completed,
      toStatus: MatchStatus.Finalized,
      ourScoreBefore: 15,
      opponentScoreBefore: 12,
      ourScoreAfter: 15,
      opponentScoreAfter: 12,
      streamVersion: 27,
    });
  });

  it('maps the resolved fixture scope', () => {
    expect(
      toMatchScope({
        competition_id: 'comp-1',
        season_id: 'season-1',
        home_away: 'away',
      }),
    ).toEqual({
      competitionId: 'comp-1',
      seasonId: 'season-1',
      homeAway: 'away',
    });
  });
  it('maps a point-stream fact with its derived retracted flag', () => {
    const mapped = toMatchPlayEvent({
      id: 'play-1',
      match_id: 'match-1',
      team_id: 'team-1',
      sequence: '3',
      operation_id: 'op-1',
      request_hash: 'hash-1',
      play_type: 'goal',
      point_number: '2',
      period: '1',
      starting_line: null,
      scoring_side: null,
      primary_membership_id: 'ana',
      secondary_membership_id: 'bo',
      assist_state: 'recorded',
      callahan: false,
      duration_seconds: null,
      corrects_play_id: null,
      correction_reason: null,
      retracted: true,
      notes: null,
      recorded_by: 'keeper-1',
      occurred_at: null,
      recorded_at: NOW,
    });
    expect(mapped).toMatchObject({
      playId: 'play-1',
      sequence: 3,
      pointNumber: 2,
      playType: MatchPlayType.Goal,
      assistState: AssistState.Recorded,
      startingLine: null,
      scoringSide: null,
      durationSeconds: null,
      retracted: true,
    });
  });

  it('maps a point envelope fact preserving its line and side', () => {
    const mapped = toMatchPlayEvent({
      id: 'start-1',
      match_id: 'match-1',
      team_id: 'team-1',
      sequence: 1,
      operation_id: 'op-1',
      request_hash: 'hash-1',
      play_type: 'point_started',
      point_number: 1,
      period: 1,
      starting_line: 'defense',
      scoring_side: 'them',
      primary_membership_id: null,
      secondary_membership_id: null,
      assist_state: null,
      callahan: true,
      duration_seconds: '90',
      corrects_play_id: 'other-1',
      correction_reason: 'wrong line',
      retracted: false,
      notes: 'note',
      recorded_by: null,
      occurred_at: NOW,
      recorded_at: NOW,
    });
    expect(mapped).toMatchObject({
      playType: MatchPlayType.PointStarted,
      startingLine: PointStartingLine.Defense,
      scoringSide: ScoringSide.Them,
      durationSeconds: 90,
      callahan: true,
      correctsPlayId: 'other-1',
      occurredAt: NOW,
    });
  });

  it('maps a lineup row, preserving an unrecorded roster entry as null', () => {
    expect(
      toMatchPointLineupEntry({
        id: 'line-1',
        match_id: 'match-1',
        play_id: 'start-1',
        point_number: '4',
        membership_id: 'ana',
        roster_entry_id: null,
        puller: true,
      }),
    ).toEqual({
      lineupId: 'line-1',
      matchId: 'match-1',
      playId: 'start-1',
      pointNumber: 4,
      membershipId: 'ana',
      rosterEntryId: null,
      puller: true,
    });
  });

  it('maps a rostered member of the match roster', () => {
    expect(
      toMatchRosterMember({
        membership_id: 'ana',
        roster_entry_id: 'entry-1',
      }),
    ).toEqual({ membershipId: 'ana', rosterEntryId: 'entry-1' });
  });

  it('maps the open point with the line it started on', () => {
    expect(
      toOpenMatchPoint({
        id: 'start-1',
        point_number: '5',
        period: '2',
        starting_line: 'offense',
      }),
    ).toEqual({
      playId: 'start-1',
      pointNumber: 5,
      period: 2,
      startingLine: PointStartingLine.Offense,
    });
  });

  it('refuses an open point with no recorded line rather than guessing', () => {
    expect(() =>
      toOpenMatchPoint({
        id: 'start-1',
        point_number: 5,
        period: 2,
        starting_line: null,
      }),
    ).toThrow('Unrecognized starting line');
  });
});
