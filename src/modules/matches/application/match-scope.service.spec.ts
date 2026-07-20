import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { describe, expect, it, vi } from 'vitest';

import { MatchScopeNotFoundError } from '../errors/match-scope-not-found.error';
import { MatchScopeService } from './match-scope.service';

const TX = { run: vi.fn() } as unknown as TransactionScope;
const SCOPE = {
  competitionId: 'comp-1',
  seasonId: 'season-1',
  homeAway: 'home',
};

function build(
  overrides: {
    activeTeam?: boolean;
    fixtureScope?: typeof SCOPE | null;
    roster?: boolean;
    membership?: boolean;
    season?: boolean;
  } = {},
): MatchScopeService {
  return new MatchScopeService({
    activeTeamExists: vi.fn().mockResolvedValue(overrides.activeTeam ?? true),
    resolveFixtureScope: vi
      .fn()
      .mockResolvedValue(
        overrides.fixtureScope === undefined ? SCOPE : overrides.fixtureScope,
      ),
    rosterExistsForFixture: vi.fn().mockResolvedValue(overrides.roster ?? true),
    membershipExistsInTeam: vi
      .fn()
      .mockResolvedValue(overrides.membership ?? true),
    seasonExistsInTeam: vi.fn().mockResolvedValue(overrides.season ?? true),
  });
}

describe('MatchScopeService', () => {
  it('resolves the competition, season, and side of a fixture', async () => {
    await expect(
      build().forFixture(TX, 'team-1', 'fixture-1', null),
    ).resolves.toEqual(SCOPE);
  });

  it('hides an inactive or foreign team behind a not-found', async () => {
    await expect(
      build({ activeTeam: false }).forFixture(TX, 'team-1', 'fixture-1', null),
    ).rejects.toBeInstanceOf(MatchScopeNotFoundError);
  });

  it('hides a fixture another team owns behind a not-found', async () => {
    await expect(
      build({ fixtureScope: null }).forFixture(TX, 'team-1', 'fixture-1', null),
    ).rejects.toBeInstanceOf(MatchScopeNotFoundError);
  });

  it('accepts a match roster that belongs to the same fixture', async () => {
    await expect(
      build().forFixture(TX, 'team-1', 'fixture-1', 'roster-1'),
    ).resolves.toEqual(SCOPE);
  });

  it('refuses a roster that belongs to a different fixture', async () => {
    await expect(
      build({ roster: false }).forFixture(
        TX,
        'team-1',
        'fixture-1',
        'roster-1',
      ),
    ).rejects.toBeInstanceOf(MatchScopeNotFoundError);
  });

  it('skips the season probe when no season was named', async () => {
    await expect(
      build({ season: false }).requireSeason(TX, 'team-1', null),
    ).resolves.toBeUndefined();
  });

  it('refuses a season outside the team', async () => {
    await expect(
      build({ season: false }).requireSeason(TX, 'team-1', 'season-9'),
    ).rejects.toBeInstanceOf(MatchScopeNotFoundError);
    await expect(
      build().requireSeason(TX, 'team-1', 'season-1'),
    ).resolves.toBeUndefined();
  });

  it('skips the membership probe when a point is unattributed', async () => {
    await expect(
      build({ membership: false }).requireMembership(TX, 'team-1', null),
    ).resolves.toBeUndefined();
  });

  it('refuses a scorer outside the team', async () => {
    await expect(
      build({ membership: false }).requireMembership(TX, 'team-1', 'member-9'),
    ).rejects.toBeInstanceOf(MatchScopeNotFoundError);
    await expect(
      build().requireMembership(TX, 'team-1', 'member-1'),
    ).resolves.toBeUndefined();
  });
});
