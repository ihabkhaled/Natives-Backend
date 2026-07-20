import { describe, expect, it, vi } from 'vitest';

import { MatchScopeRepository } from './match-scope.repository';

describe('MatchScopeRepository', () => {
  it('resolves a fixture scope, inheriting the competition season', async () => {
    const run = vi.fn().mockResolvedValue([
      {
        competition_id: 'comp-1',
        season_id: 'season-1',
        home_away: 'away',
      },
    ]);
    const scope = await new MatchScopeRepository().resolveFixtureScope(
      { run },
      'team-1',
      'fixture-1',
    );
    expect(scope).toEqual({
      competitionId: 'comp-1',
      seasonId: 'season-1',
      homeAway: 'away',
    });
    const statement = String(run.mock.calls[0]?.[0]);
    expect(statement).toContain('COALESCE(f."season_id", c."season_id")');
    expect(statement).toContain('f."deleted_at" IS NULL');
    expect(run.mock.calls[0]?.[1]).toEqual(['fixture-1', 'team-1']);
  });

  it('returns null for a fixture another team owns', async () => {
    const run = vi.fn().mockResolvedValue([]);
    expect(
      await new MatchScopeRepository().resolveFixtureScope(
        { run },
        'team-2',
        'fixture-1',
      ),
    ).toBeNull();
  });

  it('probes the roster against both the team and the fixture', async () => {
    const run = vi
      .fn()
      .mockResolvedValueOnce([{ id: 'roster-1' }])
      .mockResolvedValueOnce([]);
    const repository = new MatchScopeRepository();
    expect(
      await repository.rosterExistsForFixture(
        { run },
        'team-1',
        'fixture-1',
        'roster-1',
      ),
    ).toBe(true);
    expect(
      await repository.rosterExistsForFixture(
        { run },
        'team-1',
        'fixture-2',
        'roster-1',
      ),
    ).toBe(false);
    expect(run.mock.calls[0]?.[1]).toEqual(['roster-1', 'team-1', 'fixture-1']);
  });

  it('probes only an active team', async () => {
    const run = vi
      .fn()
      .mockResolvedValueOnce([{ id: 'team-1' }])
      .mockResolvedValueOnce([]);
    const repository = new MatchScopeRepository();
    expect(await repository.activeTeamExists({ run }, 'team-1')).toBe(true);
    expect(await repository.activeTeamExists({ run }, 'team-2')).toBe(false);
    expect(String(run.mock.calls[0]?.[0])).toContain(`"status" = 'active'`);
  });

  it('probes a membership inside the team for scorer attribution', async () => {
    const run = vi
      .fn()
      .mockResolvedValueOnce([{ id: 'member-1' }])
      .mockResolvedValueOnce([]);
    const repository = new MatchScopeRepository();
    expect(
      await repository.membershipExistsInTeam({ run }, 'team-1', 'member-1'),
    ).toBe(true);
    expect(
      await repository.membershipExistsInTeam({ run }, 'team-1', 'member-9'),
    ).toBe(false);
  });

  it('probes a season inside the team', async () => {
    const run = vi
      .fn()
      .mockResolvedValueOnce([{ id: 'season-1' }])
      .mockResolvedValueOnce([]);
    const repository = new MatchScopeRepository();
    expect(
      await repository.seasonExistsInTeam({ run }, 'team-1', 'season-1'),
    ).toBe(true);
    expect(
      await repository.seasonExistsInTeam({ run }, 'team-1', 'season-9'),
    ).toBe(false);
  });
});
