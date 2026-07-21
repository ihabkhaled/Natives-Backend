import { deriveMatchStatistics } from '@modules/matches/domain/match-statistics.policy';
import {
  AssistState,
  MatchPlayType,
  PointStartingLine,
  ScoringSide,
} from '@modules/matches/model/matches.enums';
import type {
  MatchPlayEvent,
  MatchPointLineupEntry,
  MatchRosterMember,
  MatchStatistics,
  MatchStatisticsSource,
  PlayerMatchStatistics,
} from '@modules/matches/model/matches.types';
import { describe, expect, it } from 'vitest';

/**
 * GOLDEN MATCH-STATISTICS TESTS (UN-504).
 *
 * The fixtures are synthetic and deterministic: a frozen instant, fixed ids, no
 * production data. Two streams describe the SAME match:
 *
 *   - the CLEAN stream, recorded by a scorekeeper who made no mistakes;
 *   - the CORRECTED stream, recorded by one who credited a goal to the wrong
 *     player, put the wrong line on the field for a point, and recorded a
 *     phantom block — then retracted each mistake with a compensating correction
 *     and recorded the truth.
 *
 * The corrected stream is longer, its sequence numbers differ, and its play ids
 * differ. The statistics it rebuilds to must be EXACTLY the statistics of the
 * clean stream. That equality is the whole contract: a correction is never an
 * edit, and a rebuild is never an approximation.
 */

const NOW = new Date('2026-05-01T10:00:00.000Z');

const ANA = '11111111-1111-4111-8111-111111111111';
const BO = '22222222-2222-4222-8222-222222222222';
const CY = '33333333-3333-4333-8333-333333333333';
const ZED = '44444444-4444-4444-8444-444444444444';

const ROSTER: readonly MatchRosterMember[] = [
  { membershipId: ANA, rosterEntryId: 'entry-ana' },
  { membershipId: BO, rosterEntryId: 'entry-bo' },
  { membershipId: CY, rosterEntryId: 'entry-cy' },
  { membershipId: ZED, rosterEntryId: 'entry-zed' },
];

function play(
  playId: string,
  sequence: number,
  pointNumber: number,
  overrides: Partial<MatchPlayEvent>,
): MatchPlayEvent {
  return {
    playId,
    matchId: 'match-1',
    teamId: 'team-1',
    sequence,
    operationId: `op-${playId}`,
    requestHash: `hash-${playId}`,
    playType: MatchPlayType.Throw,
    pointNumber,
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
    recordedBy: 'keeper-1',
    occurredAt: null,
    recordedAt: NOW,
    ...overrides,
  };
}

function start(
  playId: string,
  sequence: number,
  pointNumber: number,
  startingLine: PointStartingLine,
  retracted = false,
): MatchPlayEvent {
  return play(playId, sequence, pointNumber, {
    playType: MatchPlayType.PointStarted,
    startingLine,
    retracted,
  });
}

function complete(
  playId: string,
  sequence: number,
  pointNumber: number,
  scoringSide: ScoringSide,
): MatchPlayEvent {
  return play(playId, sequence, pointNumber, {
    playType: MatchPlayType.PointCompleted,
    scoringSide,
    durationSeconds: 60,
  });
}

function goal(
  playId: string,
  sequence: number,
  pointNumber: number,
  scorer: string,
  assister: string | null,
  retracted = false,
): MatchPlayEvent {
  return play(playId, sequence, pointNumber, {
    playType: MatchPlayType.Goal,
    primaryMembershipId: scorer,
    secondaryMembershipId: assister,
    assistState: assister === null ? AssistState.None : AssistState.Recorded,
    retracted,
  });
}

function correction(
  playId: string,
  sequence: number,
  pointNumber: number,
  correctsPlayId: string,
): MatchPlayEvent {
  return play(playId, sequence, pointNumber, {
    playType: MatchPlayType.Correction,
    correctsPlayId,
    correctionReason: 'recorded against the wrong player',
  });
}

function line(
  playId: string,
  pointNumber: number,
  membershipIds: readonly string[],
): readonly MatchPointLineupEntry[] {
  return membershipIds.map((membershipId, index) => ({
    lineupId: `${playId}-${index}`,
    matchId: 'match-1',
    playId,
    pointNumber,
    membershipId,
    rosterEntryId: `entry-${membershipId.slice(0, 2)}`,
    puller: index === 0,
  }));
}

/**
 * Point 1: started on offense, Ana scores assisted by Bo, we hold.
 * Point 2: started on defense, Cy blocks, Bo scores unassisted, we break.
 * Point 3: started on offense, we lose it — the opponent breaks.
 * Zed is on the roster and never takes the field.
 */
function cleanSource(): MatchStatisticsSource {
  return {
    matchId: 'match-1',
    teamId: 'team-1',
    rulesetKey: 'wfdf-indoor',
    rulesetVersion: 2,
    opponentErrorAttribution: true,
    plays: [
      start('c-s1', 1, 1, PointStartingLine.Offense),
      goal('c-g1', 2, 1, ANA, BO),
      complete('c-d1', 3, 1, ScoringSide.Us),
      start('c-s2', 4, 2, PointStartingLine.Defense),
      play('c-b1', 5, 2, {
        playType: MatchPlayType.Block,
        primaryMembershipId: CY,
      }),
      goal('c-g2', 6, 2, BO, null),
      complete('c-d2', 7, 2, ScoringSide.Us),
      start('c-s3', 8, 3, PointStartingLine.Offense),
      play('c-t1', 9, 3, {
        playType: MatchPlayType.Throwaway,
        primaryMembershipId: ANA,
      }),
      complete('c-d3', 10, 3, ScoringSide.Them),
    ],
    lineups: [
      ...line('c-s1', 1, [ANA, BO, CY]),
      ...line('c-s2', 2, [ANA, BO, CY]),
      ...line('c-s3', 3, [ANA, BO]),
    ],
    roster: ROSTER,
  };
}

/**
 * The same match as recorded by a scorekeeper who made three mistakes and
 * retracted each one: the point-1 goal was credited to Cy, the point-2 line
 * wrongly included Zed, and a block was recorded that never happened.
 */
function correctedSource(): MatchStatisticsSource {
  return {
    matchId: 'match-1',
    teamId: 'team-1',
    rulesetKey: 'wfdf-indoor',
    rulesetVersion: 2,
    opponentErrorAttribution: true,
    plays: [
      start('x-s1', 1, 1, PointStartingLine.Offense),
      goal('x-g1-wrong', 2, 1, CY, BO, true),
      correction('x-fix1', 3, 1, 'x-g1-wrong'),
      goal('x-g1', 4, 1, ANA, BO),
      complete('x-d1', 5, 1, ScoringSide.Us),
      start('x-s2-wrong', 6, 2, PointStartingLine.Defense, true),
      correction('x-fix2', 7, 2, 'x-s2-wrong'),
      start('x-s2', 8, 2, PointStartingLine.Defense),
      play('x-b1', 9, 2, {
        playType: MatchPlayType.Block,
        primaryMembershipId: CY,
      }),
      play('x-b-phantom', 10, 2, {
        playType: MatchPlayType.Block,
        primaryMembershipId: ZED,
        retracted: true,
      }),
      correction('x-fix3', 11, 2, 'x-b-phantom'),
      goal('x-g2', 12, 2, BO, null),
      complete('x-d2', 13, 2, ScoringSide.Us),
      start('x-s3', 14, 3, PointStartingLine.Offense),
      play('x-t1', 15, 3, {
        playType: MatchPlayType.Throwaway,
        primaryMembershipId: ANA,
      }),
      complete('x-d3', 16, 3, ScoringSide.Them),
    ],
    lineups: [
      ...line('x-s1', 1, [ANA, BO, CY]),
      ...line('x-s2-wrong', 2, [ANA, BO, CY, ZED]),
      ...line('x-s2', 2, [ANA, BO, CY]),
      ...line('x-s3', 3, [ANA, BO]),
    ],
    roster: ROSTER,
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
    throw new Error('Expected the player to be present in the report');
  }
  return found;
}

describe('GOLDEN: derived match statistics', () => {
  it('rebuilds a CORRECTED stream to EXACTLY the clean stream statistics', () => {
    const clean = deriveMatchStatistics(cleanSource());
    const corrected = deriveMatchStatistics(correctedSource());
    expect(corrected.team).toEqual(clean.team);
    expect(corrected.players).toEqual(clean.players);
    expect(corrected).toEqual(clean);
  });

  it('proves the two streams really did differ', () => {
    expect(correctedSource().plays).toHaveLength(16);
    expect(cleanSource().plays).toHaveLength(10);
    expect(correctedSource().lineups.length).toBeGreaterThan(
      cleanSource().lineups.length,
    );
  });

  it('rebuilds identically no matter how often it is re-derived', () => {
    const first = deriveMatchStatistics(correctedSource());
    const second = deriveMatchStatistics(correctedSource());
    const third = deriveMatchStatistics(correctedSource());
    expect(second).toEqual(first);
    expect(third).toEqual(first);
  });

  it('is order-independent: a shuffled stream folds to the same result', () => {
    const source = correctedSource();
    const shuffled = {
      ...source,
      plays: [...source.plays].reverse(),
      lineups: [...source.lineups].reverse(),
    };
    expect(deriveMatchStatistics(shuffled)).toEqual(
      deriveMatchStatistics(source),
    );
  });

  it('credits the goal to the player the correction named, never both', () => {
    const corrected = deriveMatchStatistics(correctedSource());
    expect(playerOf(corrected, ANA).goals).toBe(1);
    expect(playerOf(corrected, CY).goals).toBe(0);
    expect(playerOf(corrected, BO).goals).toBe(1);
    expect(playerOf(corrected, BO).assists).toBe(1);
  });

  it('drops the retracted line entirely from points played', () => {
    const corrected = deriveMatchStatistics(correctedSource());
    expect(playerOf(corrected, ZED).pointsPlayed).toBe(0);
    expect(playerOf(corrected, CY).pointsPlayed).toBe(2);
    expect(playerOf(corrected, ANA).pointsPlayed).toBe(3);
  });

  it('drops a retracted phantom block from both player and team totals', () => {
    const corrected = deriveMatchStatistics(correctedSource());
    expect(playerOf(corrected, ZED).blocks).toBe(0);
    expect(playerOf(corrected, CY).blocks).toBe(1);
    expect(corrected.team.blocks).toBe(1);
  });

  // --- Points played derive from LINEUP membership ---------------------------

  it('derives points played from lineup membership, not from the score', () => {
    const clean = deriveMatchStatistics(cleanSource());
    expect(playerOf(clean, ANA).pointsPlayed).toBe(3);
    expect(playerOf(clean, BO).pointsPlayed).toBe(3);
    expect(playerOf(clean, CY).pointsPlayed).toBe(2);
    expect(clean.team.pointsCompleted).toBe(3);
  });

  it('splits points played by the line each point started on', () => {
    const clean = deriveMatchStatistics(cleanSource());
    expect(playerOf(clean, CY).offencePointsPlayed).toBe(1);
    expect(playerOf(clean, CY).defencePointsPlayed).toBe(1);
    expect(playerOf(clean, ANA).offencePointsPlayed).toBe(2);
    expect(playerOf(clean, ANA).defencePointsPlayed).toBe(1);
  });

  it('classifies hold, break, and the opponent mirror from the same facts', () => {
    const clean = deriveMatchStatistics(cleanSource());
    expect(clean.team).toMatchObject({
      holds: 1,
      breaks: 1,
      opponentBreaks: 1,
      opponentHolds: 0,
      goalsFor: 2,
      goalsAgainst: 1,
    });
  });

  // --- Zero-contribution completeness ---------------------------------------

  it('keeps EVERY rostered player present, zero-stat ones included', () => {
    const clean = deriveMatchStatistics(cleanSource());
    expect(clean.players.map(player => player.membershipId)).toEqual(
      [ANA, BO, CY, ZED].sort((left, right) => (left < right ? -1 : 1)),
    );
    expect(clean.players).toHaveLength(ROSTER.length);
  });

  it('reports the zero-stat rostered player as 0, never null and never absent', () => {
    const zed = playerOf(deriveMatchStatistics(cleanSource()), ZED);
    expect(zed.rostered).toBe(true);
    expect(zed.pointsPlayed).toBe(0);
    expect(zed.offencePointsPlayed).toBe(0);
    expect(zed.defencePointsPlayed).toBe(0);
    expect(zed.goals).toBe(0);
    expect(zed.assists).toBe(0);
    expect(zed.callahans).toBe(0);
    expect(zed.drops).toBe(0);
    expect(zed.throwaways).toBe(0);
    expect(zed.blocks).toBe(0);
    expect(zed.opponentErrorsForced).toBe(0);
    for (const value of Object.values(zed)) {
      expect(value).not.toBeNull();
    }
  });

  it('keeps zero-stat players present in the corrected rebuild too', () => {
    const corrected = deriveMatchStatistics(correctedSource());
    expect(corrected.players).toHaveLength(ROSTER.length);
    expect(playerOf(corrected, ZED).goals).toBe(0);
  });

  // --- Measured zero vs missing ---------------------------------------------

  it('distinguishes a MEASURED zero from a MISSING measurement', () => {
    const measured = playerOf(deriveMatchStatistics(cleanSource()), ZED);
    const untracked = playerOf(
      deriveMatchStatistics({
        ...cleanSource(),
        plays: [],
        lineups: [],
      }),
      ZED,
    );
    expect(measured.pointsPlayed).toBe(0);
    expect(measured.goals).toBe(0);
    expect(untracked.pointsPlayed).toBeNull();
    expect(untracked.goals).toBeNull();
    expect(untracked.rostered).toBe(true);
  });

  it('reports points played as null when only possession facts were kept', () => {
    const noLineups = deriveMatchStatistics({
      ...cleanSource(),
      lineups: [],
    });
    expect(noLineups.lineupsRecorded).toBe(false);
    expect(noLineups.playsRecorded).toBe(true);
    expect(playerOf(noLineups, ANA).pointsPlayed).toBeNull();
    expect(playerOf(noLineups, ANA).goals).toBe(1);
  });

  it('reports possession figures as null when only lineups were kept', () => {
    const source = cleanSource();
    const envelopeOnly = deriveMatchStatistics({
      ...source,
      plays: source.plays.filter(
        entry =>
          entry.playType === MatchPlayType.PointStarted ||
          entry.playType === MatchPlayType.PointCompleted,
      ),
    });
    expect(envelopeOnly.playsRecorded).toBe(false);
    expect(playerOf(envelopeOnly, ANA).goals).toBeNull();
    expect(playerOf(envelopeOnly, ANA).pointsPlayed).toBe(3);
    expect(envelopeOnly.team.pointsCompleted).toBe(3);
  });

  it('withholds opponent errors as null unless the ruleset approves them', () => {
    const source = cleanSource();
    const withError = {
      ...source,
      plays: [
        ...source.plays,
        play('c-oe1', 11, 3, {
          playType: MatchPlayType.OpponentDrop,
          primaryMembershipId: CY,
        }),
      ],
    };
    const approved = deriveMatchStatistics(withError);
    const withheld = deriveMatchStatistics({
      ...withError,
      opponentErrorAttribution: false,
    });
    expect(playerOf(approved, CY).opponentErrorsForced).toBe(1);
    expect(playerOf(approved, ANA).opponentErrorsForced).toBe(0);
    expect(playerOf(withheld, CY).opponentErrorsForced).toBeNull();
    expect(withheld.team.opponentErrors).toBeNull();
  });

  // --- Explainability --------------------------------------------------------

  it('cites the versioned ruleset and named engine on every projection', () => {
    const clean = deriveMatchStatistics(cleanSource());
    expect(clean.rulesetKey).toBe('wfdf-indoor');
    expect(clean.rulesetVersion).toBe(2);
    expect(clean.statsEngineVersion).toBe('match-statistics-v1');
  });

  it('reconciles the goal count with the completed points that produced it', () => {
    const clean = deriveMatchStatistics(cleanSource());
    const playerGoals = clean.players.reduce(
      (total, player) => total + (player.goals ?? 0),
      0,
    );
    expect(playerGoals).toBe(clean.team.goalsFor);
    expect(clean.team.goalsFor + clean.team.goalsAgainst).toBe(
      clean.team.pointsCompleted,
    );
    expect(clean.team.holds + clean.team.breaks).toBe(clean.team.goalsFor);
  });
});
