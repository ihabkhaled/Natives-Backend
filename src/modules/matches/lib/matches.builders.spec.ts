import { describe, expect, it } from 'vitest';

import {
  CapKind,
  MatchEventType,
  MatchResult,
  MatchRevisionAction,
  MatchStatus,
  RulesetStatus,
  ScoringSide,
} from '../model/matches.enums';
import type {
  Match,
  MatchEvent,
  MatchRevision,
  MatchRuleset,
  MatchRulesetContent,
  PointContent,
  TimeoutContent,
  VoidContent,
} from '../model/matches.types';
import {
  buildEventAudit,
  buildMatchAudit,
  buildMatchFinalization,
  buildMatchFinalizedEvent,
  buildMatchReopenedEvent,
  buildMatchReopening,
  buildMatchScoreUpdate,
  buildMatchStartedEvent,
  buildMatchStateChangedEvent,
  buildMatchStatusChange,
  buildNewMatch,
  buildNewMatchRevision,
  buildNewMatchRuleset,
  buildPointEvent,
  buildRevisionAudit,
  buildRulesetAudit,
  buildTimeoutEvent,
  buildVoidEvent,
  toScore,
} from './matches.builders';

const NOW = new Date('2026-03-01T10:00:00.000Z');
const LATER = new Date('2026-03-01T11:00:00.000Z');

function match(overrides: Partial<Match> = {}): Match {
  return {
    matchId: 'match-1',
    teamId: 'team-1',
    seasonId: 'season-1',
    competitionId: 'comp-1',
    fixtureId: 'fixture-1',
    rosterId: null,
    rulesetId: 'rules-1',
    status: MatchStatus.Live,
    homeAway: 'home',
    ourScore: 8,
    opponentScore: 6,
    period: 1,
    streamVersion: 14,
    recordVersion: 5,
    revision: 1,
    result: MatchResult.Undecided,
    capApplied: CapKind.None,
    engineVersion: 'match-scoring-v1',
    supersedesMatchId: null,
    reopenReason: null,
    reopenedBy: null,
    reopenedAt: null,
    createdBy: 'user-1',
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
    ...overrides,
  };
}

function ruleset(): MatchRuleset {
  return {
    rulesetId: 'rules-1',
    teamId: 'team-1',
    seasonId: null,
    rulesetKey: 'wfdf-indoor',
    rulesetVersion: 2,
    name: 'Indoor',
    gameTo: 15,
    winBy: 1,
    hardCap: 17,
    softCapMinutes: null,
    softCapPlus: null,
    timeCapMinutes: 60,
    halftimeAt: null,
    timeoutsPerTeam: 2,
    timeoutsPerPeriod: null,
    periods: 2,
    status: RulesetStatus.Active,
    notes: null,
    createdBy: 'user-1',
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function rulesetContent(): MatchRulesetContent {
  return {
    rulesetKey: 'wfdf-indoor',
    seasonId: null,
    name: 'Indoor',
    gameTo: 15,
    winBy: 1,
    hardCap: 17,
    softCapMinutes: null,
    softCapPlus: null,
    timeCapMinutes: null,
    halftimeAt: null,
    timeoutsPerTeam: 2,
    timeoutsPerPeriod: null,
    periods: 2,
    notes: null,
  };
}

function pointContent(overrides: Partial<PointContent> = {}): PointContent {
  return {
    operationId: 'op-abcdef01',
    scoringSide: ScoringSide.Us,
    points: 1,
    scorerMembershipId: 'member-1',
    assistMembershipId: null,
    occurredAt: null,
    expectedStreamVersion: null,
    ...overrides,
  };
}

function timeoutContent(): TimeoutContent {
  return {
    operationId: 'op-abcdef02',
    scoringSide: ScoringSide.Them,
    occurredAt: null,
  };
}

function voidContent(): VoidContent {
  return {
    operationId: 'op-abcdef03',
    eventId: 'event-1',
    reason: 'scored for the wrong side',
  };
}

function event(): MatchEvent {
  return {
    eventId: 'event-9',
    matchId: 'match-1',
    teamId: 'team-1',
    sequence: 15,
    operationId: 'op-abcdef01',
    requestHash: 'hash-a',
    eventType: MatchEventType.Point,
    scoringSide: ScoringSide.Us,
    points: 1,
    ourScoreAfter: 9,
    opponentScoreAfter: 6,
    period: 1,
    scorerMembershipId: 'member-1',
    assistMembershipId: null,
    voidsEventId: null,
    voided: false,
    voidReason: null,
    recordedBy: 'user-1',
    occurredAt: null,
    recordedAt: NOW,
  };
}

function revision(): MatchRevision {
  return {
    revisionId: 'revision-1',
    matchId: 'match-1',
    teamId: 'team-1',
    sequence: 2,
    revision: 2,
    action: MatchRevisionAction.Reopened,
    reason: 'scorer credited the wrong side',
    fromStatus: MatchStatus.Finalized,
    toStatus: MatchStatus.Live,
    ourScoreBefore: 15,
    opponentScoreBefore: 12,
    ourScoreAfter: 15,
    opponentScoreAfter: 12,
    streamVersion: 27,
    actorUserId: 'admin-1',
    createdAt: NOW,
  };
}

describe('matches builders', () => {
  it('builds a brand-new match at revision one, superseding nothing', () => {
    expect(
      buildNewMatch(
        'match-1',
        'team-1',
        { competitionId: 'comp-1', seasonId: 'season-1', homeAway: 'away' },
        'fixture-1',
        'roster-1',
        'rules-1',
        null,
        'user-1',
        NOW,
      ),
    ).toMatchObject({
      revision: 1,
      supersedesMatchId: null,
      homeAway: 'away',
      engineVersion: 'match-scoring-v1',
      createdBy: 'user-1',
    });
  });

  it('builds a new ruleset version from the author content', () => {
    expect(
      buildNewMatchRuleset('rules-2', 'team-1', rulesetContent(), 3, 'u1', NOW),
    ).toMatchObject({
      id: 'rules-2',
      teamId: 'team-1',
      rulesetVersion: 3,
      gameTo: 15,
      hardCap: 17,
      softCapMinutes: null,
      createdBy: 'u1',
    });
  });

  it('stamps the kickoff instant only on the first start', () => {
    const first = buildMatchStatusChange(
      match({ status: MatchStatus.Ready, startedAt: null }),
      MatchStatus.Live,
      5,
      null,
      LATER,
    );
    expect(first.startedAt).toBe(LATER);
    expect(first.resumedAt).toBeNull();
  });

  it('stamps a resumption instant when play restarts', () => {
    const resumed = buildMatchStatusChange(
      match({ status: MatchStatus.Paused }),
      MatchStatus.Live,
      5,
      null,
      LATER,
    );
    expect(resumed.startedAt).toBe(NOW);
    expect(resumed.resumedAt).toBe(LATER);
  });

  it('advances the period only when resuming from halftime', () => {
    expect(
      buildMatchStatusChange(
        match({ status: MatchStatus.Halftime }),
        MatchStatus.Live,
        5,
        null,
        LATER,
      ).period,
    ).toBe(2);
    expect(
      buildMatchStatusChange(
        match({ status: MatchStatus.Paused }),
        MatchStatus.Live,
        5,
        null,
        LATER,
      ).period,
    ).toBe(1);
  });

  it('stamps the pause, halftime, and completion instants on their targets', () => {
    expect(
      buildMatchStatusChange(match(), MatchStatus.Paused, 5, null, LATER)
        .pausedAt,
    ).toBe(LATER);
    expect(
      buildMatchStatusChange(match(), MatchStatus.Halftime, 5, null, LATER)
        .halftimeAt,
    ).toBe(LATER);
    expect(
      buildMatchStatusChange(match(), MatchStatus.Completed, 5, null, LATER)
        .completedAt,
    ).toBe(LATER);
  });

  it('settles the result only when play completes', () => {
    expect(
      buildMatchStatusChange(match(), MatchStatus.Completed, 5, null, LATER)
        .result,
    ).toBe(MatchResult.Win);
    expect(
      buildMatchStatusChange(
        match({ ourScore: 6, opponentScore: 8 }),
        MatchStatus.Completed,
        5,
        null,
        LATER,
      ).result,
    ).toBe(MatchResult.Loss);
    expect(
      buildMatchStatusChange(match(), MatchStatus.Paused, 5, null, LATER)
        .result,
    ).toBe(MatchResult.Undecided);
  });

  it('leaves an abandoned match UNDECIDED and records its mandatory reason', () => {
    const change = buildMatchStatusChange(
      match({ ourScore: 3, opponentScore: 9 }),
      MatchStatus.Abandoned,
      5,
      'lightning on the field',
      LATER,
    );
    expect(change.result).toBe(MatchResult.Undecided);
    expect(change.abandonedAt).toBe(LATER);
    expect(change.abandonReason).toBe('lightning on the field');
  });

  it('derives the finalized result from the projected score', () => {
    expect(buildMatchFinalization(match(), 5, 'admin-1', LATER)).toMatchObject({
      result: MatchResult.Win,
      finalizedBy: 'admin-1',
      expectedRecordVersion: 5,
    });
  });

  it('builds a reopening that bumps the revision and keeps the reason', () => {
    expect(
      buildMatchReopening(match(), 9, 2, 'wrong side credited', 'a1', LATER),
    ).toMatchObject({
      revision: 2,
      reason: 'wrong side credited',
      reopenedBy: 'a1',
      expectedRecordVersion: 9,
    });
  });

  it('builds the guarded score projection write', () => {
    expect(
      buildMatchScoreUpdate(
        match(),
        { ourScore: 9, opponentScore: 6 },
        15,
        CapKind.Hard,
        LATER,
      ),
    ).toMatchObject({
      ourScore: 9,
      opponentScore: 6,
      streamVersion: 15,
      capApplied: CapKind.Hard,
    });
  });

  it('builds a point fact carrying the resulting score', () => {
    const built = buildPointEvent(
      'event-9',
      match(),
      pointContent(),
      'hash-a',
      15,
      { ourScore: 9, opponentScore: 6 },
      LATER,
      'user-1',
      NOW,
    );
    expect(built).toMatchObject({
      eventType: MatchEventType.Point,
      scoringSide: ScoringSide.Us,
      points: 1,
      sequence: 15,
      ourScoreAfter: 9,
      opponentScoreAfter: 6,
      scorerMembershipId: 'member-1',
      requestHash: 'hash-a',
      occurredAt: LATER,
    });
    expect(built.voidsEventId).toBeNull();
    expect(built.voidReason).toBeNull();
  });

  it('builds a timeout fact that leaves the score untouched', () => {
    const built = buildTimeoutEvent(
      'event-9',
      match(),
      timeoutContent(),
      'hash-b',
      15,
      null,
      'user-1',
      NOW,
    );
    expect(built).toMatchObject({
      eventType: MatchEventType.Timeout,
      scoringSide: ScoringSide.Them,
      ourScoreAfter: 8,
      opponentScoreAfter: 6,
    });
    expect(built.points).toBeNull();
  });

  it('builds a compensating void that names its target and reason', () => {
    const built = buildVoidEvent(
      'event-9',
      match(),
      voidContent(),
      'hash-c',
      15,
      { ourScore: 7, opponentScore: 6 },
      'user-1',
      NOW,
    );
    expect(built).toMatchObject({
      eventType: MatchEventType.Void,
      voidsEventId: 'event-1',
      voidReason: 'scored for the wrong side',
      ourScoreAfter: 7,
    });
    expect(built.scoringSide).toBeNull();
  });

  it('builds a revision row carrying the score before and after', () => {
    expect(
      buildNewMatchRevision(
        'revision-1',
        3,
        match({ status: MatchStatus.Finalized, ourScore: 15 }),
        MatchRevisionAction.Finalized,
        'published',
        MatchStatus.Completed,
        { ourScore: 15, opponentScore: 6 },
        'admin-1',
        NOW,
      ),
    ).toMatchObject({
      fromStatus: MatchStatus.Completed,
      toStatus: MatchStatus.Finalized,
      ourScoreBefore: 15,
      opponentScoreBefore: 6,
      ourScoreAfter: 15,
      opponentScoreAfter: 6,
      streamVersion: 14,
    });
  });

  it('reads the score pair off a match record', () => {
    expect(toScore(match())).toEqual({ ourScore: 8, opponentScore: 6 });
  });

  it('audits a match change without leaking anything personal', () => {
    const audit = buildMatchAudit('match.transitioned', 'u1', match());
    expect(audit).toMatchObject({
      action: 'match.transitioned',
      resourceType: 'match',
      resourceId: 'match-1',
      teamId: 'team-1',
      seasonId: 'season-1',
    });
    expect(audit.diff).toEqual({
      status: MatchStatus.Live,
      ourScore: 8,
      opponentScore: 6,
      revision: 1,
      streamVersion: 14,
      recordVersion: 5,
    });
  });

  it('audits a stream append by operation id, never by player name', () => {
    const audit = buildEventAudit('match.scored', 'u1', match(), event());
    expect(audit.resourceId).toBe('event-9');
    expect(audit.diff).toEqual({
      matchId: 'match-1',
      operationId: 'op-abcdef01',
      eventType: MatchEventType.Point,
      sequence: 15,
      ourScoreAfter: 9,
      opponentScoreAfter: 6,
    });
  });

  it('audits a revision with both score pairs', () => {
    const audit = buildRevisionAudit('match.reopened', 'a1', revision());
    expect(audit.resourceType).toBe('match_revision');
    expect(audit.seasonId).toBeNull();
    expect(audit.diff).toMatchObject({
      revision: 2,
      revisionAction: MatchRevisionAction.Reopened,
      ourScoreBefore: 15,
      opponentScoreAfter: 12,
    });
  });

  it('audits a published ruleset version with its caps', () => {
    const audit = buildRulesetAudit('u1', ruleset());
    expect(audit.action).toBe('match.ruleset.created');
    expect(audit.diff).toMatchObject({
      rulesetKey: 'wfdf-indoor',
      rulesetVersion: 2,
      gameTo: 15,
      hardCap: 17,
      timeCapMinutes: 60,
    });
  });

  it('publishes match.started with the kickoff instant', () => {
    const domainEvent = buildMatchStartedEvent(match(), 'u1');
    expect(domainEvent).toMatchObject({
      aggregateType: 'match',
      aggregateId: 'match-1',
      eventType: 'match.started.v1',
      eventVersion: 1,
    });
    expect(domainEvent.payload).toMatchObject({
      competitionId: 'comp-1',
      fixtureId: 'fixture-1',
      startedAt: NOW.toISOString(),
    });
  });

  it('publishes match.state_changed with both ends of the transition', () => {
    expect(
      buildMatchStateChangedEvent(
        match({ status: MatchStatus.Paused }),
        MatchStatus.Live,
        'u1',
      ).payload,
    ).toMatchObject({
      fromStatus: MatchStatus.Live,
      toStatus: MatchStatus.Paused,
      period: 1,
    });
  });

  it('publishes match.finalized with the stream version it derived from', () => {
    expect(
      buildMatchFinalizedEvent(
        match({
          status: MatchStatus.Finalized,
          result: MatchResult.Win,
          finalizedAt: LATER,
        }),
        'admin-1',
      ).payload,
    ).toMatchObject({
      result: MatchResult.Win,
      streamVersion: 14,
      finalizedAt: LATER.toISOString(),
    });
  });

  it('leaves an unstamped instant null in an event payload', () => {
    expect(
      buildMatchStartedEvent(match({ startedAt: null }), 'u1').payload
        .startedAt,
    ).toBeNull();
    expect(
      buildMatchFinalizedEvent(match(), 'u1').payload.finalizedAt,
    ).toBeNull();
  });

  it('publishes match.reopened with the score as it was published', () => {
    expect(
      buildMatchReopenedEvent(
        match({ status: MatchStatus.Live, revision: 2 }),
        { ourScore: 15, opponentScore: 12 },
        'admin-1',
      ).payload,
    ).toMatchObject({
      previousOurScore: 15,
      previousOpponentScore: 12,
      revision: 2,
    });
  });
});
