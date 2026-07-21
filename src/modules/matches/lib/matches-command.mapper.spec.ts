import { describe, expect, it } from 'vitest';

import {
  AssistState,
  MatchPlayType,
  MatchStatus,
  PointStartingLine,
  ScoringSide,
} from '../model/matches.enums';
import {
  toCompletePointContent,
  toCorrectionContent,
  toExpectedRecordVersion,
  toMatchContent,
  toMatchListFilter,
  toMatchRulesetContent,
  toPlayContent,
  toPointContent,
  toStartPointContent,
  toTimeoutContent,
} from './matches-command.mapper';

describe('matches command mapper', () => {
  it('collapses absent match fields onto explicit nulls', () => {
    expect(toMatchContent({ fixtureId: 'fixture-1' })).toEqual({
      fixtureId: 'fixture-1',
      rosterId: null,
      rulesetId: null,
      notes: null,
    });
  });

  it('carries supplied match fields through unchanged', () => {
    expect(
      toMatchContent({
        fixtureId: 'fixture-1',
        rosterId: 'roster-1',
        rulesetId: 'rules-1',
        notes: 'windy',
      }),
    ).toEqual({
      fixtureId: 'fixture-1',
      rosterId: 'roster-1',
      rulesetId: 'rules-1',
      notes: 'windy',
    });
  });

  it('leaves every unconfigured cap NULL rather than zero', () => {
    const content = toMatchRulesetContent({
      rulesetKey: 'wfdf-indoor',
      name: 'Indoor',
      gameTo: 15,
    });
    expect(content.hardCap).toBeNull();
    expect(content.softCapMinutes).toBeNull();
    expect(content.softCapPlus).toBeNull();
    expect(content.timeCapMinutes).toBeNull();
    expect(content.halftimeAt).toBeNull();
    expect(content.timeoutsPerPeriod).toBeNull();
    expect(content.seasonId).toBeNull();
    expect(content.notes).toBeNull();
  });

  it('applies the documented ruleset defaults only when absent', () => {
    expect(
      toMatchRulesetContent({
        rulesetKey: 'wfdf-indoor',
        name: 'Indoor',
        gameTo: 15,
      }),
    ).toMatchObject({ winBy: 1, timeoutsPerTeam: 0, periods: 1 });
    expect(
      toMatchRulesetContent({
        rulesetKey: 'wfdf-indoor',
        name: 'Indoor',
        gameTo: 15,
        winBy: 2,
        timeoutsPerTeam: 4,
        periods: 2,
        hardCap: 17,
        softCapMinutes: 40,
        softCapPlus: 1,
        timeCapMinutes: 60,
        halftimeAt: 8,
        timeoutsPerPeriod: 2,
        seasonId: 'season-1',
        notes: 'league rules',
      }),
    ).toMatchObject({
      winBy: 2,
      timeoutsPerTeam: 4,
      periods: 2,
      hardCap: 17,
      softCapMinutes: 40,
      softCapPlus: 1,
      timeCapMinutes: 60,
      halftimeAt: 8,
      timeoutsPerPeriod: 2,
      seasonId: 'season-1',
      notes: 'league rules',
    });
  });

  it('defaults an unspecified point to exactly one and keeps a scorer null', () => {
    expect(
      toPointContent({
        operationId: 'op-abcdef01',
        scoringSide: ScoringSide.Us,
      }),
    ).toEqual({
      operationId: 'op-abcdef01',
      scoringSide: ScoringSide.Us,
      points: 1,
      scorerMembershipId: null,
      assistMembershipId: null,
      occurredAt: null,
      expectedStreamVersion: null,
    });
  });

  it('carries a fully specified point operation through unchanged', () => {
    expect(
      toPointContent({
        operationId: 'op-abcdef01',
        scoringSide: ScoringSide.Them,
        points: 2,
        scorerMembershipId: 'member-1',
        assistMembershipId: 'member-2',
        occurredAt: '2026-03-01T10:00:00.000Z',
        expectedStreamVersion: 0,
      }),
    ).toMatchObject({
      points: 2,
      scorerMembershipId: 'member-1',
      assistMembershipId: 'member-2',
      occurredAt: '2026-03-01T10:00:00.000Z',
      expectedStreamVersion: 0,
    });
  });

  it('maps a timeout operation', () => {
    expect(
      toTimeoutContent({
        operationId: 'op-abcdef02',
        scoringSide: ScoringSide.Them,
      }),
    ).toEqual({
      operationId: 'op-abcdef02',
      scoringSide: ScoringSide.Them,
      occurredAt: null,
    });
  });

  it('allow-lists the match list filter', () => {
    expect(toMatchListFilter({})).toEqual({
      competitionId: null,
      fixtureId: null,
      status: null,
    });
    expect(
      toMatchListFilter({
        competitionId: 'comp-1',
        fixtureId: 'fixture-1',
        status: MatchStatus.Live,
      }),
    ).toEqual({
      competitionId: 'comp-1',
      fixtureId: 'fixture-1',
      status: MatchStatus.Live,
    });
  });

  it('defaults the expected record version to the first', () => {
    expect(toExpectedRecordVersion(undefined)).toBe(1);
    expect(toExpectedRecordVersion(7)).toBe(7);
  });
  it('collapses an absent puller, instant, and note onto explicit nulls', () => {
    expect(
      toStartPointContent({
        operationId: 'op-1',
        startingLine: PointStartingLine.Defense,
        lineMembershipIds: ['ana'],
      }),
    ).toEqual({
      operationId: 'op-1',
      startingLine: PointStartingLine.Defense,
      lineMembershipIds: ['ana'],
      pullerMembershipId: null,
      occurredAt: null,
      notes: null,
    });
  });

  it('carries a supplied puller, instant, and note through unchanged', () => {
    expect(
      toStartPointContent({
        operationId: 'op-1',
        startingLine: PointStartingLine.Offense,
        lineMembershipIds: ['ana', 'bo'],
        pullerMembershipId: 'bo',
        occurredAt: '2026-05-01T10:00:00.000Z',
        notes: 'wind at our backs',
      }),
    ).toMatchObject({
      pullerMembershipId: 'bo',
      occurredAt: '2026-05-01T10:00:00.000Z',
      notes: 'wind at our backs',
    });
  });

  it('keeps an unmeasured point length NULL, never zero seconds', () => {
    expect(
      toCompletePointContent({
        operationId: 'op-1',
        scoringSide: ScoringSide.Us,
      }).durationSeconds,
    ).toBeNull();
    expect(
      toCompletePointContent({
        operationId: 'op-1',
        scoringSide: ScoringSide.Us,
        durationSeconds: 0,
        occurredAt: '2026-05-01T10:00:00.000Z',
        notes: 'quick point',
      }),
    ).toMatchObject({
      durationSeconds: 0,
      occurredAt: '2026-05-01T10:00:00.000Z',
      notes: 'quick point',
    });
  });

  it('defaults an unstated assist to UNKNOWN rather than to none', () => {
    expect(
      toPlayContent({
        operationId: 'op-1',
        playType: MatchPlayType.Goal,
      }),
    ).toEqual({
      operationId: 'op-1',
      playType: MatchPlayType.Goal,
      primaryMembershipId: null,
      secondaryMembershipId: null,
      assistState: AssistState.Unknown,
      callahan: false,
      occurredAt: null,
      notes: null,
    });
  });

  it('preserves a deliberate no-assist and a Callahan flag', () => {
    expect(
      toPlayContent({
        operationId: 'op-1',
        playType: MatchPlayType.Goal,
        primaryMembershipId: 'ana',
        secondaryMembershipId: 'bo',
        assistState: AssistState.None,
        callahan: true,
        occurredAt: '2026-05-01T10:00:00.000Z',
        notes: 'clean layout',
      }),
    ).toMatchObject({
      primaryMembershipId: 'ana',
      secondaryMembershipId: 'bo',
      assistState: AssistState.None,
      callahan: true,
    });
  });

  it('maps a retraction to its target and reason', () => {
    expect(
      toCorrectionContent({
        operationId: 'op-1',
        playId: 'play-1',
        reason: 'credited to the wrong player',
      }),
    ).toEqual({
      operationId: 'op-1',
      playId: 'play-1',
      reason: 'credited to the wrong player',
    });
  });
});
