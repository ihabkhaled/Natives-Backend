import { describe, expect, it } from 'vitest';

import {
  MATCH_EVENT_ACCEPTED_EVENT,
  MATCH_EVENT_CORRECTED_EVENT,
  MATCH_PLAY_RECORDED_ACTION,
  MATCH_STATS_ENGINE_VERSION,
  MATCH_STATS_PROJECTED_EVENT,
  MATCH_STATS_REBUILT_ACTION,
  POINT_COMPLETED_EVENT,
  POINT_STARTED_EVENT,
} from '../model/matches.constants';
import {
  AssistState,
  CapKind,
  MatchPlayType,
  MatchResult,
  MatchStatus,
  PointStartingLine,
  ScoringSide,
} from '../model/matches.enums';
import type {
  CompletePointContent,
  CorrectionContent,
  Match,
  MatchPlayEvent,
  MatchStatistics,
  PlayContent,
  StartPointContent,
} from '../model/matches.types';
import {
  buildCorrectionPlay,
  buildLineupEntry,
  buildPlayAcceptedEvent,
  buildPlayAudit,
  buildPlayCorrectedEvent,
  buildPointCompletedEvent,
  buildPointCompletedPlay,
  buildPointStartedEvent,
  buildPointStartedPlay,
  buildPossessionPlay,
  buildStatisticsAudit,
  buildStatsProjectedEvent,
} from './matches.builders';

const NOW = new Date('2026-05-01T10:00:00.000Z');

function match(): Match {
  return {
    matchId: 'match-1',
    teamId: 'team-1',
    seasonId: 'season-1',
    competitionId: 'comp-1',
    fixtureId: 'fixture-1',
    rosterId: 'roster-1',
    rulesetId: 'rules-1',
    status: MatchStatus.Live,
    homeAway: 'home',
    ourScore: 2,
    opponentScore: 1,
    period: 2,
    streamVersion: 4,
    recordVersion: 3,
    revision: 1,
    result: MatchResult.Undecided,
    capApplied: CapKind.None,
    engineVersion: 'match-scoring-v1',
    supersedesMatchId: null,
    reopenReason: null,
    reopenedBy: null,
    reopenedAt: null,
    createdBy: 'coach-1',
    startedAt: NOW,
    pausedAt: null,
    resumedAt: null,
    halftimeAt: null,
    completedAt: null,
    finalizedBy: null,
    finalizedAt: null,
    abandonedAt: null,
    abandonReason: null,
    notes: null,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function play(overrides: Partial<MatchPlayEvent> = {}): MatchPlayEvent {
  return {
    playId: 'play-1',
    matchId: 'match-1',
    teamId: 'team-1',
    sequence: 5,
    operationId: 'op-1',
    requestHash: 'hash-1',
    playType: MatchPlayType.Goal,
    pointNumber: 3,
    period: 2,
    startingLine: null,
    scoringSide: null,
    primaryMembershipId: 'ana',
    secondaryMembershipId: null,
    assistState: null,
    callahan: false,
    durationSeconds: null,
    correctsPlayId: null,
    correctionReason: null,
    retracted: false,
    notes: null,
    recordedBy: 'keeper-1',
    occurredAt: null,
    recordedAt: NOW,
    ...overrides,
  };
}

function startContent(): StartPointContent {
  return {
    operationId: 'op-start',
    startingLine: PointStartingLine.Defense,
    lineMembershipIds: ['ana', 'bo'],
    pullerMembershipId: 'bo',
    occurredAt: null,
    notes: 'downwind',
  };
}

function completeContent(): CompletePointContent {
  return {
    operationId: 'op-done',
    scoringSide: ScoringSide.Us,
    durationSeconds: null,
    occurredAt: null,
    notes: null,
  };
}

function playContent(overrides: Partial<PlayContent> = {}): PlayContent {
  return {
    operationId: 'op-play',
    playType: MatchPlayType.Goal,
    primaryMembershipId: 'ana',
    secondaryMembershipId: 'bo',
    assistState: AssistState.Recorded,
    callahan: false,
    occurredAt: null,
    notes: null,
    ...overrides,
  };
}

function correctionContent(): CorrectionContent {
  return {
    operationId: 'op-fix',
    playId: 'play-1',
    reason: 'credited to the wrong player',
  };
}

function statistics(): MatchStatistics {
  return {
    matchId: 'match-1',
    teamId: 'team-1',
    rulesetKey: 'wfdf-indoor',
    rulesetVersion: 3,
    statsEngineVersion: MATCH_STATS_ENGINE_VERSION,
    lineupsRecorded: true,
    playsRecorded: true,
    opponentErrorAttribution: false,
    team: {
      pointsStarted: 3,
      pointsCompleted: 2,
      holds: 1,
      breaks: 1,
      opponentHolds: 0,
      opponentBreaks: 0,
      goalsFor: 2,
      goalsAgainst: 0,
      drops: 0,
      throwaways: 0,
      blocks: 1,
      turnovers: 0,
      opponentErrors: null,
    },
    players: [],
  };
}

describe('match point stream builders', () => {
  it('builds a point start carrying the line and the puller', () => {
    const built = buildPointStartedPlay(
      'start-1',
      match(),
      startContent(),
      'hash-1',
      7,
      3,
      NOW,
      'keeper-1',
      NOW,
    );
    expect(built).toMatchObject({
      id: 'start-1',
      matchId: 'match-1',
      teamId: 'team-1',
      sequence: 7,
      pointNumber: 3,
      period: 2,
      playType: MatchPlayType.PointStarted,
      startingLine: PointStartingLine.Defense,
      primaryMembershipId: 'bo',
      notes: 'downwind',
      recordedBy: 'keeper-1',
    });
    expect(built.scoringSide).toBeNull();
    expect(built.correctsPlayId).toBeNull();
  });

  it('builds a completion keeping an unmeasured length NULL', () => {
    const built = buildPointCompletedPlay(
      'done-1',
      match(),
      completeContent(),
      'hash-1',
      8,
      3,
      null,
      'keeper-1',
      NOW,
    );
    expect(built.playType).toBe(MatchPlayType.PointCompleted);
    expect(built.scoringSide).toBe(ScoringSide.Us);
    expect(built.durationSeconds).toBeNull();
    expect(built.startingLine).toBeNull();
  });

  it('builds a possession fact carrying a recorded assist target', () => {
    const built = buildPossessionPlay(
      'goal-1',
      match(),
      playContent(),
      'hash-1',
      9,
      3,
      null,
      'keeper-1',
      NOW,
    );
    expect(built.playType).toBe(MatchPlayType.Goal);
    expect(built.secondaryMembershipId).toBe('bo');
    expect(built.assistState).toBe(AssistState.Recorded);
  });

  it('drops the assist target when the assist was NOT recorded', () => {
    const noAssist = buildPossessionPlay(
      'goal-1',
      match(),
      playContent({ assistState: AssistState.None, callahan: true }),
      'hash-1',
      9,
      3,
      null,
      'keeper-1',
      NOW,
    );
    const unknown = buildPossessionPlay(
      'goal-2',
      match(),
      playContent({ assistState: AssistState.Unknown }),
      'hash-2',
      10,
      3,
      null,
      'keeper-1',
      NOW,
    );
    expect(noAssist.secondaryMembershipId).toBeNull();
    expect(noAssist.callahan).toBe(true);
    expect(unknown.secondaryMembershipId).toBeNull();
  });

  it('builds a retraction pointing at the fact it compensates', () => {
    const built = buildCorrectionPlay(
      'fix-1',
      match(),
      correctionContent(),
      'hash-1',
      11,
      play(),
      'keeper-1',
      NOW,
    );
    expect(built).toMatchObject({
      playType: MatchPlayType.Correction,
      correctsPlayId: 'play-1',
      correctionReason: 'credited to the wrong player',
      pointNumber: 3,
    });
    expect(built.primaryMembershipId).toBeNull();
    expect(built.occurredAt).toBeNull();
  });

  it('builds a lineup row tied to the point-start fact', () => {
    expect(
      buildLineupEntry(
        'line-1',
        match(),
        'start-1',
        3,
        'ana',
        'entry-ana',
        true,
        NOW,
      ),
    ).toEqual({
      id: 'line-1',
      matchId: 'match-1',
      teamId: 'team-1',
      playId: 'start-1',
      pointNumber: 3,
      membershipId: 'ana',
      rosterEntryId: 'entry-ana',
      puller: true,
      now: NOW,
    });
  });

  it('audits a point-stream append without a player identity', () => {
    const audit = buildPlayAudit(
      MATCH_PLAY_RECORDED_ACTION,
      'keeper-1',
      match(),
      play(),
    );
    expect(audit.action).toBe(MATCH_PLAY_RECORDED_ACTION);
    expect(audit.resourceId).toBe('play-1');
    expect(audit.teamId).toBe('team-1');
    expect(audit.diff.playType).toBe(MatchPlayType.Goal);
    expect(JSON.stringify(audit.diff)).not.toContain('ana');
  });

  it('audits a statistics rebuild citing the engine and ruleset', () => {
    const audit = buildStatisticsAudit(
      MATCH_STATS_REBUILT_ACTION,
      'analyst-1',
      statistics(),
    );
    expect(audit.action).toBe(MATCH_STATS_REBUILT_ACTION);
    expect(audit.resourceId).toBe('match-1');
    expect(audit.diff.statsEngineVersion).toBe(MATCH_STATS_ENGINE_VERSION);
    expect(audit.diff.pointsCompleted).toBe(2);
  });

  it('publishes point started with the line SIZE, never its members', () => {
    const event = buildPointStartedEvent(
      match(),
      play({
        playType: MatchPlayType.PointStarted,
        startingLine: PointStartingLine.Defense,
      }),
      7,
      'keeper-1',
    );
    expect(event.eventType).toBe(POINT_STARTED_EVENT);
    expect(event.payload.lineSize).toBe(7);
    expect(event.payload.startingLine).toBe(PointStartingLine.Defense);
    expect(JSON.stringify(event.payload)).not.toContain('ana');
  });

  it('publishes point completed with the classification inputs', () => {
    const event = buildPointCompletedEvent(
      match(),
      play({
        playType: MatchPlayType.PointCompleted,
        scoringSide: ScoringSide.Them,
        durationSeconds: 61,
      }),
      'keeper-1',
    );
    expect(event.eventType).toBe(POINT_COMPLETED_EVENT);
    expect(event.payload.scoringSide).toBe(ScoringSide.Them);
    expect(event.payload.durationSeconds).toBe(61);
  });

  it('publishes an accepted fact naming only its type and position', () => {
    const event = buildPlayAcceptedEvent(match(), play(), 'keeper-1');
    expect(event.eventType).toBe(MATCH_EVENT_ACCEPTED_EVENT);
    expect(event.payload.playType).toBe(MatchPlayType.Goal);
    expect(event.payload.sequence).toBe(5);
  });

  it('publishes a correction naming what it retracted', () => {
    const event = buildPlayCorrectedEvent(
      match(),
      play({ playType: MatchPlayType.Correction, correctsPlayId: 'play-1' }),
      MatchPlayType.Goal,
      'keeper-1',
    );
    expect(event.eventType).toBe(MATCH_EVENT_CORRECTED_EVENT);
    expect(event.payload.correctsPlayId).toBe('play-1');
    expect(event.payload.correctedPlayType).toBe(MatchPlayType.Goal);
  });

  it('publishes a stats projection citing the rules it was derived under', () => {
    const event = buildStatsProjectedEvent(match(), statistics(), 'analyst-1');
    expect(event.eventType).toBe(MATCH_STATS_PROJECTED_EVENT);
    expect(event.eventVersion).toBe(1);
    expect(event.payload.rulesetKey).toBe('wfdf-indoor');
    expect(event.payload.rulesetVersion).toBe(3);
    expect(event.payload.playerCount).toBe(0);
  });
});
