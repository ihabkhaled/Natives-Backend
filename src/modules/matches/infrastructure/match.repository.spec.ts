import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { describe, expect, it, vi } from 'vitest';

import { CapKind, MatchResult, MatchStatus } from '../model/matches.enums';
import type { MatchRow } from '../model/matches.rows';
import type { MatchStatusChange, NewMatch } from '../model/matches.types';
import { MatchRepository } from './match.repository';

const NOW = new Date('2026-03-01T10:00:00.000Z');

function row(overrides: Partial<MatchRow> = {}): MatchRow {
  return {
    id: 'match-1',
    team_id: 'team-1',
    season_id: 'season-1',
    competition_id: 'comp-1',
    fixture_id: 'fixture-1',
    roster_id: null,
    ruleset_id: 'rules-1',
    status: 'scheduled',
    home_away: 'home',
    our_score: 0,
    opponent_score: 0,
    period: 1,
    stream_version: 0,
    record_version: 1,
    revision: 1,
    result: 'undecided',
    cap_applied: 'none',
    engine_version: 'match-scoring-v1',
    supersedes_match_id: null,
    reopen_reason: null,
    reopened_by: null,
    reopened_at: null,
    created_by: 'user-1',
    started_at: null,
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

function scopeReturning(...results: MatchRow[][]): {
  scope: TransactionScope;
  run: ReturnType<typeof vi.fn>;
} {
  const run = vi.fn();
  for (const result of results) {
    run.mockResolvedValueOnce(result);
  }
  return { scope: { run }, run };
}

function newMatch(): NewMatch {
  return {
    id: 'match-1',
    teamId: 'team-1',
    seasonId: 'season-1',
    competitionId: 'comp-1',
    fixtureId: 'fixture-1',
    rosterId: 'roster-1',
    rulesetId: 'rules-1',
    homeAway: 'home',
    engineVersion: 'match-scoring-v1',
    revision: 1,
    supersedesMatchId: null,
    notes: null,
    createdBy: 'user-1',
    now: NOW,
  };
}

function statusChange(
  overrides: Partial<MatchStatusChange> = {},
): MatchStatusChange {
  return {
    id: 'match-1',
    teamId: 'team-1',
    expectedRecordVersion: 1,
    toStatus: MatchStatus.Live,
    period: 1,
    result: MatchResult.Undecided,
    startedAt: NOW,
    pausedAt: null,
    resumedAt: null,
    halftimeAt: null,
    completedAt: null,
    abandonedAt: null,
    abandonReason: null,
    now: NOW,
    ...overrides,
  };
}

describe('MatchRepository', () => {
  it('inserts a match with a static column list and bound parameters', async () => {
    const { scope, run } = scopeReturning([row()]);
    const repository = new MatchRepository();
    const match = await repository.insert(scope, newMatch());
    expect(match.matchId).toBe('match-1');
    expect(String(run.mock.calls[0]?.[0])).toContain('INSERT INTO "matches"');
    expect(String(run.mock.calls[0]?.[0])).not.toContain('SELECT *');
    expect(run.mock.calls[0]?.[1]).toEqual([
      'match-1',
      'team-1',
      'season-1',
      'comp-1',
      'fixture-1',
      'roster-1',
      'rules-1',
      'home',
      'match-scoring-v1',
      1,
      null,
      null,
      'user-1',
      NOW.toISOString(),
    ]);
  });

  it('raises when a write returns nothing', async () => {
    const { scope } = scopeReturning([]);
    await expect(
      new MatchRepository().insert(scope, newMatch()),
    ).rejects.toThrow('Expected a returned row from the match write');
  });

  it('resolves a match only inside its own team', async () => {
    const { scope, run } = scopeReturning([row()]);
    const match = await new MatchRepository().findForWrite(
      scope,
      'team-1',
      'match-1',
    );
    expect(match?.matchId).toBe('match-1');
    expect(run.mock.calls[0]?.[1]).toEqual(['match-1', 'team-1']);
  });

  it('returns null for a match another team owns', async () => {
    const { scope } = scopeReturning([]);
    expect(
      await new MatchRepository().findForWrite(scope, 'team-2', 'match-1'),
    ).toBeNull();
  });

  it('guards a status change on the optimistic record version', async () => {
    const { scope, run } = scopeReturning([row({ status: 'live' })]);
    const changed = await new MatchRepository().applyStatusChange(
      scope,
      statusChange(),
    );
    expect(changed?.status).toBe(MatchStatus.Live);
    expect(String(run.mock.calls[0]?.[0])).toContain('"record_version" = $3');
    expect(run.mock.calls[0]?.[1]?.[6]).toBe(NOW.toISOString());
  });

  it('returns null when the status guard misses', async () => {
    const { scope } = scopeReturning([]);
    expect(
      await new MatchRepository().applyStatusChange(scope, statusChange()),
    ).toBeNull();
  });

  it('serializes an unstamped instant as null', async () => {
    const { scope, run } = scopeReturning([row()]);
    await new MatchRepository().applyStatusChange(
      scope,
      statusChange({ startedAt: null }),
    );
    expect(run.mock.calls[0]?.[1]?.[6]).toBeNull();
  });

  it('publishes a result under the version guard', async () => {
    const { scope, run } = scopeReturning([
      row({ status: 'finalized', result: 'win', finalized_at: NOW }),
    ]);
    const finalized = await new MatchRepository().applyFinalization(scope, {
      id: 'match-1',
      teamId: 'team-1',
      expectedRecordVersion: 4,
      result: MatchResult.Win,
      finalizedBy: 'admin-1',
      now: NOW,
    });
    expect(finalized?.status).toBe(MatchStatus.Finalized);
    expect(String(run.mock.calls[0]?.[0])).toContain(`"status" = 'finalized'`);
    expect(run.mock.calls[0]?.[1]).toEqual([
      'match-1',
      'team-1',
      4,
      MatchResult.Win,
      'admin-1',
      NOW.toISOString(),
    ]);
  });

  it('returns null when the finalization guard misses', async () => {
    const { scope } = scopeReturning([]);
    expect(
      await new MatchRepository().applyFinalization(scope, {
        id: 'match-1',
        teamId: 'team-1',
        expectedRecordVersion: 99,
        result: MatchResult.Win,
        finalizedBy: 'admin-1',
        now: NOW,
      }),
    ).toBeNull();
  });

  it('reopens by bumping the revision and clearing the published result', async () => {
    const { scope, run } = scopeReturning([
      row({ status: 'live', revision: 2, reopen_reason: 'wrong side' }),
    ]);
    const reopened = await new MatchRepository().applyReopening(scope, {
      id: 'match-1',
      teamId: 'team-1',
      expectedRecordVersion: 6,
      revision: 2,
      reason: 'wrong side',
      reopenedBy: 'admin-1',
      now: NOW,
    });
    expect(reopened?.revision).toBe(2);
    const statement = String(run.mock.calls[0]?.[0]);
    expect(statement).toContain('"revision" = $4');
    expect(statement).toContain('"finalized_at" = NULL');
    expect(statement).toContain(`"result" = 'undecided'`);
  });

  it('returns null when the reopen guard misses', async () => {
    const { scope } = scopeReturning([]);
    expect(
      await new MatchRepository().applyReopening(scope, {
        id: 'match-1',
        teamId: 'team-1',
        expectedRecordVersion: 99,
        revision: 2,
        reason: 'wrong side',
        reopenedBy: 'admin-1',
        now: NOW,
      }),
    ).toBeNull();
  });

  it('guards the score projection on the previous stream version', async () => {
    const { scope, run } = scopeReturning([
      row({ our_score: 1, stream_version: 1 }),
    ]);
    const updated = await new MatchRepository().applyScoreUpdate(scope, {
      id: 'match-1',
      teamId: 'team-1',
      ourScore: 1,
      opponentScore: 0,
      streamVersion: 1,
      capApplied: CapKind.None,
      now: NOW,
    });
    expect(updated?.streamVersion).toBe(1);
    expect(String(run.mock.calls[0]?.[0])).toContain(
      '"stream_version" = $5 - 1',
    );
  });

  it('returns null when a concurrent device already advanced the stream', async () => {
    const { scope } = scopeReturning([]);
    expect(
      await new MatchRepository().applyScoreUpdate(scope, {
        id: 'match-1',
        teamId: 'team-1',
        ourScore: 1,
        opponentScore: 0,
        streamVersion: 1,
        capApplied: CapKind.None,
        now: NOW,
      }),
    ).toBeNull();
  });

  it('lists a bounded, deterministically ordered page under the filters', async () => {
    const { scope, run } = scopeReturning([row()]);
    const items = await new MatchRepository().listForScope(
      scope,
      'team-1',
      { competitionId: 'comp-1', fixtureId: null, status: MatchStatus.Live },
      { limit: 5000, offset: 20 },
    );
    expect(items).toHaveLength(1);
    expect(String(run.mock.calls[0]?.[0])).toContain(
      'ORDER BY "created_at" DESC, "id" ASC',
    );
    expect(run.mock.calls[0]?.[1]).toEqual([
      'team-1',
      'comp-1',
      null,
      MatchStatus.Live,
      100,
      20,
    ]);
  });

  it('counts the same filtered scope and tolerates an empty result', async () => {
    const run = vi
      .fn()
      .mockResolvedValueOnce([{ count: 3 }])
      .mockResolvedValueOnce([]);
    const repository = new MatchRepository();
    const filter = { competitionId: null, fixtureId: null, status: null };
    expect(await repository.countForScope({ run }, 'team-1', filter)).toBe(3);
    expect(await repository.countForScope({ run }, 'team-1', filter)).toBe(0);
  });
});
