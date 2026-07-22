import { describe, expect, it } from 'vitest';

import {
  AchievementStatus,
  AchievementTransition,
  AchievementVisibility,
  MatchOutcome,
  StandingEntrantKind,
  StandingQualification,
  StandingRuleStatus,
  StandingSource,
  StandingTieBreak,
} from '../model/standings.enums';
import type {
  CompetitionStanding,
  FinalizedMatchResult,
  StandingsRuleVersion,
} from '../model/standings.types';
import {
  canTransitionAchievement,
  isApproveTarget,
  isArchiveTarget,
  isHistoricAchievement,
  isPubliclyVisible,
  isRejectTarget,
  isTeamVisible,
  targetStatusOf,
} from './achievement.state-machine';
import {
  applyResult,
  emptyTally,
  foldResults,
  mirrorTally,
  pointDifference,
  pointsFor,
  scoreTally,
} from './standings-computation.policy';
import {
  compareBy,
  compareSpirit,
  compareStandings,
  metricOf,
  orderStandings,
} from './standings-tiebreak.policy';

const NOW = new Date('2025-03-01T00:00:00.000Z');

const RULE: StandingsRuleVersion = {
  ruleVersionId: 'rule-1',
  teamId: 'team-1',
  ruleKey: 'wfdf',
  version: 1,
  name: 'WFDF',
  winPoints: 3,
  lossPoints: 0,
  tiePoints: 1,
  tieBreakOrder: [
    StandingTieBreak.StandingPoints,
    StandingTieBreak.Wins,
    StandingTieBreak.PointDifference,
    StandingTieBreak.Alphabetical,
  ],
  effectiveFrom: NOW,
  status: StandingRuleStatus.Active,
  createdBy: 'user-1',
  createdAt: NOW,
};

function result(
  outcome: MatchOutcome,
  ourScore: number,
  opponentScore: number,
): FinalizedMatchResult {
  return {
    matchId: `match-${outcome}-${ourScore}`,
    competitionId: 'comp-1',
    stageId: null,
    opponentId: 'opp-1',
    ourScore,
    opponentScore,
    result: outcome,
  };
}

function standing(
  overrides: Partial<CompetitionStanding>,
): CompetitionStanding {
  return {
    standingId: 'standing-1',
    teamId: 'team-1',
    seasonId: 'season-1',
    competitionId: 'comp-1',
    stageId: null,
    ruleVersionId: 'rule-1',
    poolLabel: null,
    entrantKind: StandingEntrantKind.Team,
    opponentId: null,
    played: 1,
    wins: 1,
    losses: 0,
    ties: 0,
    pointsFor: 15,
    pointsAgainst: 10,
    standingPoints: 3,
    spiritScore: null,
    finalPlace: null,
    qualification: StandingQualification.Undecided,
    source: StandingSource.Derived,
    sourceReference: null,
    reconciliationNote: null,
    recordVersion: 1,
    recordedBy: null,
    computedAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe('standings computation policy', () => {
  it('starts from an all-zero tally', () => {
    expect(emptyTally().played).toBe(0);
  });

  it('folds wins, losses, and ties under the rule version', () => {
    const tally = foldResults(
      [
        result(MatchOutcome.Win, 15, 10),
        result(MatchOutcome.Loss, 8, 15),
        result(MatchOutcome.Draw, 12, 12),
      ],
      RULE,
    );
    expect(tally).toEqual({
      played: 3,
      wins: 1,
      losses: 1,
      ties: 1,
      pointsFor: 35,
      pointsAgainst: 37,
      standingPoints: 4,
    });
  });

  it('never counts an undecided match as a draw', () => {
    const tally = applyResult(
      emptyTally(),
      result(MatchOutcome.Undecided, 9, 9),
      RULE,
    );
    expect(tally).toEqual(emptyTally());
    expect(pointsFor(MatchOutcome.Undecided, RULE)).toBe(0);
  });

  it('scores each outcome under the rule version', () => {
    expect(pointsFor(MatchOutcome.Win, RULE)).toBe(3);
    expect(pointsFor(MatchOutcome.Draw, RULE)).toBe(1);
    expect(pointsFor(MatchOutcome.Loss, RULE)).toBe(0);
  });

  it('mirrors a tally for the opponent and rescores it', () => {
    const tally = foldResults([result(MatchOutcome.Win, 15, 10)], RULE);
    const mirrored = scoreTally(mirrorTally(tally), RULE);
    expect(mirrored.wins).toBe(0);
    expect(mirrored.losses).toBe(1);
    expect(mirrored.pointsFor).toBe(10);
    expect(mirrored.standingPoints).toBe(0);
  });

  it('reports the point difference', () => {
    expect(
      pointDifference(foldResults([result(MatchOutcome.Win, 15, 10)], RULE)),
    ).toBe(5);
  });
});

describe('standings tie-break policy', () => {
  it('orders by the rule version’s own criteria', () => {
    const rows = [
      standing({ standingId: 'b', standingPoints: 3, wins: 1 }),
      standing({ standingId: 'a', standingPoints: 6, wins: 2 }),
    ];
    expect(orderStandings(rows, RULE).map(row => row.standingId)).toEqual([
      'a',
      'b',
    ]);
  });

  it('falls through the tie-break chain deterministically', () => {
    const left = standing({
      standingId: 'a',
      opponentId: 'opp-a',
      entrantKind: StandingEntrantKind.Opponent,
      pointsFor: 30,
      pointsAgainst: 10,
    });
    const right = standing({
      standingId: 'b',
      opponentId: 'opp-b',
      entrantKind: StandingEntrantKind.Opponent,
      pointsFor: 20,
      pointsAgainst: 10,
    });
    expect(compareStandings(left, right, RULE)).toBeLessThan(0);
    expect(
      compareStandings(left, { ...left, standingId: 'z' }, RULE),
    ).toBeLessThan(0);
  });

  it('reads each comparable metric', () => {
    const row = standing({ pointsFor: 30, pointsAgainst: 12, wins: 4 });
    expect(metricOf(StandingTieBreak.Wins, row)).toBe(4);
    expect(metricOf(StandingTieBreak.PointDifference, row)).toBe(18);
    expect(metricOf(StandingTieBreak.PointsFor, row)).toBe(30);
    expect(metricOf(StandingTieBreak.PointsAgainst, row)).toBe(-12);
    expect(metricOf(StandingTieBreak.StandingPoints, row)).toBe(3);
  });

  it('sorts a null spirit score last instead of treating it as zero', () => {
    expect(compareSpirit(null, 12)).toBeGreaterThan(0);
    expect(compareSpirit(12, null)).toBeLessThan(0);
    expect(compareSpirit(null, null)).toBe(0);
    expect(compareSpirit(15, 12)).toBeLessThan(0);
    expect(
      compareBy(
        StandingTieBreak.Spirit,
        standing({ spiritScore: null }),
        standing({ spiritScore: 10 }),
      ),
    ).toBeGreaterThan(0);
  });

  it('breaks a tie alphabetically by entrant identity', () => {
    expect(
      compareBy(
        StandingTieBreak.Alphabetical,
        standing({ opponentId: 'a' }),
        standing({ opponentId: 'b' }),
      ),
    ).toBeLessThan(0);
  });
});

describe('achievement state machine', () => {
  it('maps each verb to its target status', () => {
    expect(targetStatusOf(AchievementTransition.Submit)).toBe(
      AchievementStatus.Submitted,
    );
    expect(targetStatusOf(AchievementTransition.Approve)).toBe(
      AchievementStatus.Approved,
    );
    expect(targetStatusOf(AchievementTransition.Reject)).toBe(
      AchievementStatus.Rejected,
    );
    expect(targetStatusOf(AchievementTransition.Archive)).toBe(
      AchievementStatus.Archived,
    );
  });

  it('allows only the approval path', () => {
    expect(
      canTransitionAchievement(
        AchievementStatus.Draft,
        AchievementStatus.Submitted,
      ),
    ).toBe(true);
    expect(
      canTransitionAchievement(
        AchievementStatus.Draft,
        AchievementStatus.Approved,
      ),
    ).toBe(false);
    expect(
      canTransitionAchievement(
        AchievementStatus.Submitted,
        AchievementStatus.Rejected,
      ),
    ).toBe(true);
    expect(
      canTransitionAchievement(
        AchievementStatus.Rejected,
        AchievementStatus.Approved,
      ),
    ).toBe(false);
    expect(
      canTransitionAchievement(
        AchievementStatus.Archived,
        AchievementStatus.Approved,
      ),
    ).toBe(false);
  });

  it('treats only an approved claim as history', () => {
    expect(isHistoricAchievement(AchievementStatus.Approved)).toBe(true);
    expect(isHistoricAchievement(AchievementStatus.Submitted)).toBe(false);
    expect(isApproveTarget(AchievementStatus.Approved)).toBe(true);
    expect(isRejectTarget(AchievementStatus.Rejected)).toBe(true);
    expect(isArchiveTarget(AchievementStatus.Archived)).toBe(true);
    expect(isArchiveTarget(AchievementStatus.Draft)).toBe(false);
  });

  it('keeps staff-only achievements out of team and public surfaces', () => {
    expect(isPubliclyVisible(AchievementVisibility.Public)).toBe(true);
    expect(isPubliclyVisible(AchievementVisibility.Team)).toBe(false);
    expect(isTeamVisible(AchievementVisibility.Team)).toBe(true);
    expect(isTeamVisible(AchievementVisibility.Staff)).toBe(false);
  });
});
