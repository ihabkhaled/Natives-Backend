import { describe, expect, it } from 'vitest';

import { MATCH_STATS_ENGINE_VERSION } from '../model/matches.constants';
import {
  AssistState,
  MatchPlayType,
  PointOutcome,
  PointStartingLine,
  ScoringSide,
} from '../model/matches.enums';
import type {
  MatchPlayEvent,
  MatchPointLineupEntry,
  MatchStatistics,
  MatchStatisticsSource,
  PlayerMatchStatistics,
} from '../model/matches.types';
import {
  deriveMatchStatistics,
  orderPlays,
  resolveCompletedPoints,
} from './match-statistics.policy';

const NOW = new Date('2026-05-01T10:00:00.000Z');

function play(overrides: Partial<MatchPlayEvent> = {}): MatchPlayEvent {
  return {
    playId: 'play-1',
    matchId: 'match-1',
    teamId: 'team-1',
    sequence: 1,
    operationId: 'op-1',
    requestHash: 'hash-1',
    playType: MatchPlayType.Throw,
    pointNumber: 1,
    period: 1,
    startingLine: null,
    scoringSide: null,
    primaryMembershipId: null,
    secondaryMembershipId: null,
    assistState: null,
    callahan: false,
    durationSeconds: null,
    correctsPlayId: null,
    correctionReason: null,
    retracted: false,
    notes: null,
    recordedBy: 'user-1',
    occurredAt: null,
    recordedAt: NOW,
    ...overrides,
  };
}

function started(
  playId: string,
  sequence: number,
  pointNumber: number,
  startingLine: PointStartingLine,
  overrides: Partial<MatchPlayEvent> = {},
): MatchPlayEvent {
  return play({
    playId,
    sequence,
    pointNumber,
    playType: MatchPlayType.PointStarted,
    startingLine,
    ...overrides,
  });
}

function completed(
  playId: string,
  sequence: number,
  pointNumber: number,
  scoringSide: ScoringSide,
  overrides: Partial<MatchPlayEvent> = {},
): MatchPlayEvent {
  return play({
    playId,
    sequence,
    pointNumber,
    playType: MatchPlayType.PointCompleted,
    scoringSide,
    ...overrides,
  });
}

function lineup(
  playId: string,
  pointNumber: number,
  membershipIds: readonly string[],
): readonly MatchPointLineupEntry[] {
  return membershipIds.map((membershipId, index) => ({
    lineupId: `${playId}-${membershipId}`,
    matchId: 'match-1',
    playId,
    pointNumber,
    membershipId,
    rosterEntryId: `entry-${membershipId}`,
    puller: index === 0,
  }));
}

function source(
  overrides: Partial<MatchStatisticsSource> = {},
): MatchStatisticsSource {
  return {
    matchId: 'match-1',
    teamId: 'team-1',
    rulesetKey: 'wfdf-indoor',
    rulesetVersion: 2,
    opponentErrorAttribution: true,
    plays: [],
    lineups: [],
    roster: [],
    ...overrides,
  };
}

function playerOf(
  statistics: MatchStatistics,
  membershipId: string,
): PlayerMatchStatistics {
  const found = statistics.players.find(
    player => player.membershipId === membershipId,
  );
  if (found === undefined) {
    throw new Error(`Expected ${membershipId} to be present in the report`);
  }
  return found;
}

/**
 * A two-point match: point 1 started on offense and held, point 2 started on
 * defense and lost. Ana scores both our goals, Bo assists one of them, Cy is on
 * the line for both points and never touches the disc.
 */
function twoPointStream(): readonly MatchPlayEvent[] {
  return [
    started('start-1', 1, 1, PointStartingLine.Offense),
    play({
      playId: 'goal-1',
      sequence: 2,
      pointNumber: 1,
      playType: MatchPlayType.Goal,
      primaryMembershipId: 'ana',
      secondaryMembershipId: 'bo',
      assistState: AssistState.Recorded,
    }),
    completed('done-1', 3, 1, ScoringSide.Us, { durationSeconds: 42 }),
    started('start-2', 4, 2, PointStartingLine.Defense),
    play({
      playId: 'drop-1',
      sequence: 5,
      pointNumber: 2,
      playType: MatchPlayType.Drop,
      primaryMembershipId: 'bo',
    }),
    completed('done-2', 6, 2, ScoringSide.Them),
  ];
}

function twoPointLineups(): readonly MatchPointLineupEntry[] {
  return [
    ...lineup('start-1', 1, ['ana', 'bo', 'cy']),
    ...lineup('start-2', 2, ['ana', 'cy']),
  ];
}

describe('match statistics derivation engine', () => {
  it('cites the versioned ruleset and named engine it derived under', () => {
    const statistics = deriveMatchStatistics(source());
    expect(statistics.statsEngineVersion).toBe(MATCH_STATS_ENGINE_VERSION);
    expect(statistics.rulesetKey).toBe('wfdf-indoor');
    expect(statistics.rulesetVersion).toBe(2);
    expect(statistics.matchId).toBe('match-1');
    expect(statistics.teamId).toBe('team-1');
  });

  it('orders the stream by sequence and drops what no longer counts', () => {
    const ordered = orderPlays([
      play({ playId: 'c', sequence: 3 }),
      play({ playId: 'a', sequence: 1 }),
      play({ playId: 'gone', sequence: 2, retracted: true }),
      play({ playId: 'fix', sequence: 4, playType: MatchPlayType.Correction }),
    ]);
    expect(ordered.map(entry => entry.playId)).toEqual(['a', 'c']);
  });

  it('classifies each completed point as a hold or a break', () => {
    const points = resolveCompletedPoints(orderPlays(twoPointStream()));
    expect(points.map(point => point.outcome)).toEqual([
      PointOutcome.Hold,
      PointOutcome.OpponentHold,
    ]);
  });

  it('derives points played from LINEUP membership, not from the score', () => {
    const statistics = deriveMatchStatistics(
      source({ plays: twoPointStream(), lineups: twoPointLineups() }),
    );
    expect(playerOf(statistics, 'ana').pointsPlayed).toBe(2);
    expect(playerOf(statistics, 'bo').pointsPlayed).toBe(1);
    expect(playerOf(statistics, 'cy').pointsPlayed).toBe(2);
  });

  it('splits points played by the line the point started on', () => {
    const statistics = deriveMatchStatistics(
      source({ plays: twoPointStream(), lineups: twoPointLineups() }),
    );
    const ana = playerOf(statistics, 'ana');
    expect(ana.offencePointsPlayed).toBe(1);
    expect(ana.defencePointsPlayed).toBe(1);
    const bo = playerOf(statistics, 'bo');
    expect(bo.offencePointsPlayed).toBe(1);
    expect(bo.defencePointsPlayed).toBe(0);
  });

  it('credits goals, assists, and turnovers to the named players', () => {
    const statistics = deriveMatchStatistics(
      source({ plays: twoPointStream(), lineups: twoPointLineups() }),
    );
    expect(playerOf(statistics, 'ana').goals).toBe(1);
    expect(playerOf(statistics, 'bo').assists).toBe(1);
    expect(playerOf(statistics, 'bo').drops).toBe(1);
    expect(playerOf(statistics, 'ana').drops).toBe(0);
  });

  it('counts holds, breaks, and the opponent mirror at team level', () => {
    const statistics = deriveMatchStatistics(
      source({ plays: twoPointStream(), lineups: twoPointLineups() }),
    );
    expect(statistics.team).toMatchObject({
      pointsStarted: 2,
      pointsCompleted: 2,
      holds: 1,
      breaks: 0,
      opponentHolds: 1,
      opponentBreaks: 0,
      goalsFor: 1,
      goalsAgainst: 1,
    });
  });

  it('counts a point won from defense as a break', () => {
    const statistics = deriveMatchStatistics(
      source({
        plays: [
          started('s', 1, 1, PointStartingLine.Defense),
          completed('c', 2, 1, ScoringSide.Us),
        ],
      }),
    );
    expect(statistics.team.breaks).toBe(1);
    expect(statistics.team.holds).toBe(0);
  });

  it('counts a point lost from defense as an opponent break', () => {
    const statistics = deriveMatchStatistics(
      source({
        plays: [
          started('s', 1, 1, PointStartingLine.Offense),
          completed('c', 2, 1, ScoringSide.Them),
        ],
      }),
    );
    expect(statistics.team.opponentBreaks).toBe(1);
  });

  it('counts every recorded turnover kind at team level', () => {
    const statistics = deriveMatchStatistics(
      source({
        plays: [
          started('s', 1, 1, PointStartingLine.Offense),
          play({ playId: 'p1', sequence: 2, playType: MatchPlayType.Drop }),
          play({
            playId: 'p2',
            sequence: 3,
            playType: MatchPlayType.Throwaway,
          }),
          play({ playId: 'p3', sequence: 4, playType: MatchPlayType.Stall }),
          play({ playId: 'p4', sequence: 5, playType: MatchPlayType.Turnover }),
          play({ playId: 'p5', sequence: 6, playType: MatchPlayType.Block }),
        ],
      }),
    );
    expect(statistics.team.turnovers).toBe(4);
    expect(statistics.team.drops).toBe(1);
    expect(statistics.team.throwaways).toBe(1);
    expect(statistics.team.blocks).toBe(1);
  });

  // --- Zero-contribution completeness ---------------------------------------

  it('keeps a rostered player who did nothing, at a MEASURED zero', () => {
    const statistics = deriveMatchStatistics(
      source({
        plays: twoPointStream(),
        lineups: twoPointLineups(),
        roster: [
          { membershipId: 'ana', rosterEntryId: 'entry-ana' },
          { membershipId: 'bo', rosterEntryId: 'entry-bo' },
          { membershipId: 'cy', rosterEntryId: 'entry-cy' },
          { membershipId: 'zed', rosterEntryId: 'entry-zed' },
        ],
      }),
    );
    const zed = playerOf(statistics, 'zed');
    expect(zed.rostered).toBe(true);
    expect(zed.pointsPlayed).toBe(0);
    expect(zed.goals).toBe(0);
    expect(zed.assists).toBe(0);
    expect(zed.drops).toBe(0);
    expect(zed.throwaways).toBe(0);
    expect(zed.blocks).toBe(0);
    expect(zed.callahans).toBe(0);
    expect(zed.opponentErrorsForced).toBe(0);
  });

  it('never omits a rostered player, even from an empty stream', () => {
    const statistics = deriveMatchStatistics(
      source({
        roster: [
          { membershipId: 'ana', rosterEntryId: 'entry-ana' },
          { membershipId: 'bo', rosterEntryId: null },
        ],
      }),
    );
    expect(statistics.players.map(player => player.membershipId)).toEqual([
      'ana',
      'bo',
    ]);
    expect(playerOf(statistics, 'bo').rosterEntryId).toBeNull();
    expect(playerOf(statistics, 'ana').rosterEntryId).toBe('entry-ana');
  });

  it('reports a player seen only in the stream as not rostered', () => {
    const statistics = deriveMatchStatistics(
      source({ plays: twoPointStream(), lineups: twoPointLineups() }),
    );
    const ana = playerOf(statistics, 'ana');
    expect(ana.rostered).toBe(false);
    expect(ana.rosterEntryId).toBeNull();
  });

  it('orders players deterministically regardless of encounter order', () => {
    const statistics = deriveMatchStatistics(
      source({
        roster: [
          { membershipId: 'zed', rosterEntryId: null },
          { membershipId: 'ana', rosterEntryId: null },
          { membershipId: 'mia', rosterEntryId: null },
        ],
      }),
    );
    expect(statistics.players.map(player => player.membershipId)).toEqual([
      'ana',
      'mia',
      'zed',
    ]);
  });

  // --- Null is not zero ------------------------------------------------------

  it('reports points played as NULL when no lineup was recorded', () => {
    const statistics = deriveMatchStatistics(
      source({
        plays: twoPointStream(),
        roster: [{ membershipId: 'ana', rosterEntryId: null }],
      }),
    );
    expect(statistics.lineupsRecorded).toBe(false);
    const ana = playerOf(statistics, 'ana');
    expect(ana.pointsPlayed).toBeNull();
    expect(ana.offencePointsPlayed).toBeNull();
    expect(ana.defencePointsPlayed).toBeNull();
    expect(ana.goals).toBe(1);
  });

  it('reports possession figures as NULL when nothing was tracked', () => {
    const statistics = deriveMatchStatistics(
      source({
        plays: [
          started('s', 1, 1, PointStartingLine.Offense),
          completed('c', 2, 1, ScoringSide.Us),
        ],
        lineups: lineup('s', 1, ['ana']),
        roster: [{ membershipId: 'ana', rosterEntryId: null }],
      }),
    );
    expect(statistics.playsRecorded).toBe(false);
    const ana = playerOf(statistics, 'ana');
    expect(ana.pointsPlayed).toBe(1);
    expect(ana.goals).toBeNull();
    expect(ana.assists).toBeNull();
    expect(ana.blocks).toBeNull();
    expect(statistics.team.drops).toBeNull();
    expect(statistics.team.turnovers).toBeNull();
    expect(statistics.team.opponentErrors).toBeNull();
  });

  it('still reports the point envelope as measured when no plays exist', () => {
    const statistics = deriveMatchStatistics(
      source({
        plays: [
          started('s', 1, 1, PointStartingLine.Offense),
          completed('c', 2, 1, ScoringSide.Us),
        ],
      }),
    );
    expect(statistics.team.pointsCompleted).toBe(1);
    expect(statistics.team.goalsFor).toBe(1);
  });

  it('reports opponent errors as NULL when the ruleset does not approve them', () => {
    const plays = [
      started('s', 1, 1, PointStartingLine.Offense),
      play({
        playId: 'oe',
        sequence: 2,
        playType: MatchPlayType.OpponentDrop,
        primaryMembershipId: 'ana',
      }),
    ];
    const approved = deriveMatchStatistics(
      source({ plays, opponentErrorAttribution: true }),
    );
    const unapproved = deriveMatchStatistics(
      source({ plays, opponentErrorAttribution: false }),
    );
    expect(playerOf(approved, 'ana').opponentErrorsForced).toBe(1);
    expect(approved.team.opponentErrors).toBe(1);
    expect(playerOf(unapproved, 'ana').opponentErrorsForced).toBeNull();
    expect(unapproved.team.opponentErrors).toBeNull();
    expect(unapproved.opponentErrorAttribution).toBe(false);
  });

  it('credits a forced opponent throwaway the same way as a drop', () => {
    const statistics = deriveMatchStatistics(
      source({
        plays: [
          started('s', 1, 1, PointStartingLine.Offense),
          play({
            playId: 'oe',
            sequence: 2,
            playType: MatchPlayType.OpponentThrowaway,
            primaryMembershipId: 'ana',
          }),
        ],
      }),
    );
    expect(playerOf(statistics, 'ana').opponentErrorsForced).toBe(1);
  });

  // --- Goal edge cases -------------------------------------------------------

  it('records a Callahan as a goal with no assist credited to anyone', () => {
    const statistics = deriveMatchStatistics(
      source({
        plays: [
          started('s', 1, 1, PointStartingLine.Defense),
          play({
            playId: 'cal',
            sequence: 2,
            playType: MatchPlayType.Goal,
            primaryMembershipId: 'ana',
            secondaryMembershipId: null,
            assistState: AssistState.None,
            callahan: true,
          }),
        ],
        roster: [{ membershipId: 'bo', rosterEntryId: null }],
      }),
    );
    expect(playerOf(statistics, 'ana').goals).toBe(1);
    expect(playerOf(statistics, 'ana').callahans).toBe(1);
    expect(playerOf(statistics, 'ana').assists).toBe(0);
    expect(playerOf(statistics, 'bo').assists).toBe(0);
  });

  it('credits no assist for an explicitly unassisted goal', () => {
    const statistics = deriveMatchStatistics(
      source({
        plays: [
          started('s', 1, 1, PointStartingLine.Offense),
          play({
            playId: 'g',
            sequence: 2,
            playType: MatchPlayType.Goal,
            primaryMembershipId: 'ana',
            secondaryMembershipId: null,
            assistState: AssistState.None,
          }),
        ],
      }),
    );
    expect(playerOf(statistics, 'ana').goals).toBe(1);
    expect(playerOf(statistics, 'ana').callahans).toBe(0);
    expect(statistics.players).toHaveLength(1);
  });

  it('never invents an assist from an unknown assist state', () => {
    const statistics = deriveMatchStatistics(
      source({
        plays: [
          started('s', 1, 1, PointStartingLine.Offense),
          play({
            playId: 'g',
            sequence: 2,
            playType: MatchPlayType.Goal,
            primaryMembershipId: 'ana',
            secondaryMembershipId: 'bo',
            assistState: AssistState.Unknown,
          }),
        ],
      }),
    );
    expect(statistics.players.map(player => player.membershipId)).toEqual([
      'ana',
    ]);
  });

  it('ignores an assist target on a play that is not a goal', () => {
    const statistics = deriveMatchStatistics(
      source({
        plays: [
          started('s', 1, 1, PointStartingLine.Offense),
          play({
            playId: 'c',
            sequence: 2,
            playType: MatchPlayType.Completion,
            primaryMembershipId: 'ana',
            secondaryMembershipId: 'bo',
            assistState: AssistState.Recorded,
          }),
        ],
      }),
    );
    expect(playerOf(statistics, 'ana').goals).toBe(0);
    expect(statistics.players.map(player => player.membershipId)).toEqual([
      'ana',
    ]);
  });

  it('leaves an unattributed fact uncredited without dropping it', () => {
    const statistics = deriveMatchStatistics(
      source({
        plays: [
          started('s', 1, 1, PointStartingLine.Offense),
          play({
            playId: 'g',
            sequence: 2,
            playType: MatchPlayType.Goal,
            primaryMembershipId: null,
          }),
        ],
        roster: [{ membershipId: 'ana', rosterEntryId: null }],
      }),
    );
    expect(playerOf(statistics, 'ana').goals).toBe(0);
    expect(statistics.playsRecorded).toBe(true);
  });

  it('does not credit a play type that carries no per-player statistic', () => {
    const statistics = deriveMatchStatistics(
      source({
        plays: [
          started('s', 1, 1, PointStartingLine.Offense),
          play({
            playId: 'pull',
            sequence: 2,
            playType: MatchPlayType.Pull,
            primaryMembershipId: 'ana',
          }),
          play({
            playId: 'sub',
            sequence: 3,
            playType: MatchPlayType.Substitution,
            primaryMembershipId: 'ana',
          }),
        ],
      }),
    );
    const ana = playerOf(statistics, 'ana');
    expect(ana.goals).toBe(0);
    expect(ana.drops).toBe(0);
    expect(ana.blocks).toBe(0);
  });

  it('credits a throwaway and a block to their named players', () => {
    const statistics = deriveMatchStatistics(
      source({
        plays: [
          started('s', 1, 1, PointStartingLine.Offense),
          play({
            playId: 't',
            sequence: 2,
            playType: MatchPlayType.Throwaway,
            primaryMembershipId: 'ana',
          }),
          play({
            playId: 'b',
            sequence: 3,
            playType: MatchPlayType.Block,
            primaryMembershipId: 'ana',
          }),
        ],
      }),
    );
    expect(playerOf(statistics, 'ana').throwaways).toBe(1);
    expect(playerOf(statistics, 'ana').blocks).toBe(1);
  });

  // --- Defensive / partial data ---------------------------------------------

  it('ignores a point that started but never completed', () => {
    const statistics = deriveMatchStatistics(
      source({
        plays: [started('s', 1, 1, PointStartingLine.Offense)],
        lineups: lineup('s', 1, ['ana']),
        roster: [{ membershipId: 'ana', rosterEntryId: 'entry-ana' }],
      }),
    );
    expect(statistics.team.pointsStarted).toBe(1);
    expect(statistics.team.pointsCompleted).toBe(0);
    expect(playerOf(statistics, 'ana').pointsPlayed).toBe(0);
  });

  it('ignores a completion with no matching start', () => {
    const statistics = deriveMatchStatistics(
      source({ plays: [completed('c', 1, 7, ScoringSide.Us)] }),
    );
    expect(statistics.team.pointsCompleted).toBe(0);
  });

  it('ignores a start missing the line it was played on', () => {
    const statistics = deriveMatchStatistics(
      source({
        plays: [
          started('s', 1, 1, PointStartingLine.Offense, {
            startingLine: null,
          }),
          completed('c', 2, 1, ScoringSide.Us),
        ],
      }),
    );
    expect(statistics.team.pointsCompleted).toBe(0);
  });

  it('ignores a completion missing the side that scored it', () => {
    const statistics = deriveMatchStatistics(
      source({
        plays: [
          started('s', 1, 1, PointStartingLine.Offense),
          completed('c', 2, 1, ScoringSide.Us, { scoringSide: null }),
        ],
      }),
    );
    expect(statistics.team.pointsCompleted).toBe(0);
  });

  it('drops the whole line of a retracted point start', () => {
    const statistics = deriveMatchStatistics(
      source({
        plays: [
          started('s', 1, 1, PointStartingLine.Offense, { retracted: true }),
          completed('c', 2, 1, ScoringSide.Us),
        ],
        lineups: lineup('s', 1, ['ana']),
        roster: [{ membershipId: 'ana', rosterEntryId: null }],
      }),
    );
    expect(statistics.lineupsRecorded).toBe(false);
    expect(statistics.team.pointsCompleted).toBe(0);
    expect(playerOf(statistics, 'ana').pointsPlayed).toBeNull();
  });

  it('counts a player on the line for two points exactly twice', () => {
    const statistics = deriveMatchStatistics(
      source({
        plays: twoPointStream(),
        lineups: twoPointLineups(),
        roster: [{ membershipId: 'cy', rosterEntryId: 'entry-cy' }],
      }),
    );
    expect(playerOf(statistics, 'cy').pointsPlayed).toBe(2);
    expect(playerOf(statistics, 'cy').rosterEntryId).toBe('entry-cy');
  });
});
