import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { describe, expect, it, vi } from 'vitest';

import { RosterScopeNotFoundError } from '../errors/roster-scope-not-found.error';
import type { RosterScopeRepository } from '../infrastructure/roster-scope.repository';
import { RosterScopeService } from './roster-scope.service';

const TX = { run: vi.fn() } as unknown as TransactionScope;
const SCOPE = { competitionId: 'comp-1', seasonId: 'season-1' };

function build(overrides: {
  activeTeam?: boolean;
  competition?: typeof SCOPE | null;
  fixture?: typeof SCOPE | null;
  squad?: boolean;
}): RosterScopeService {
  const repository = {
    activeTeamExists: vi.fn().mockResolvedValue(overrides.activeTeam ?? true),
    resolveCompetitionScope: vi
      .fn()
      .mockResolvedValue(
        'competition' in overrides ? overrides.competition : SCOPE,
      ),
    resolveFixtureScope: vi
      .fn()
      .mockResolvedValue('fixture' in overrides ? overrides.fixture : SCOPE),
    squadExistsInScope: vi.fn().mockResolvedValue(overrides.squad ?? true),
  } as unknown as RosterScopeRepository;
  return new RosterScopeService(repository);
}

describe('RosterScopeService', () => {
  it('resolves a competition scope with no squad requested', async () => {
    expect(
      await build({}).forCompetition(TX, 'team-1', 'comp-1', null),
    ).toEqual(SCOPE);
  });

  it('resolves a competition scope and validates the named squad', async () => {
    expect(
      await build({}).forCompetition(TX, 'team-1', 'comp-1', 'squad-1'),
    ).toEqual(SCOPE);
  });

  it('hides an archived team behind a not-found scope', async () => {
    await expect(
      build({ activeTeam: false }).forCompetition(TX, 'team-1', 'comp-1', null),
    ).rejects.toBeInstanceOf(RosterScopeNotFoundError);
  });

  it('hides a foreign or deleted competition behind a not-found scope', async () => {
    await expect(
      build({ competition: null }).forCompetition(TX, 'team-1', 'comp-9', null),
    ).rejects.toBeInstanceOf(RosterScopeNotFoundError);
  });

  it('hides a squad outside the resolved season behind a not-found scope', async () => {
    await expect(
      build({ squad: false }).forCompetition(TX, 'team-1', 'comp-1', 'squad-9'),
    ).rejects.toBeInstanceOf(RosterScopeNotFoundError);
  });

  it('resolves a fixture scope for a match roster', async () => {
    expect(await build({}).forFixture(TX, 'team-1', 'fixture-1')).toEqual(
      SCOPE,
    );
  });

  it('hides a foreign or deleted fixture behind a not-found scope', async () => {
    await expect(
      build({ fixture: null }).forFixture(TX, 'team-1', 'fixture-9'),
    ).rejects.toBeInstanceOf(RosterScopeNotFoundError);
  });

  it('refuses a fixture scope for an archived team', async () => {
    await expect(
      build({ activeTeam: false }).forFixture(TX, 'team-1', 'fixture-1'),
    ).rejects.toBeInstanceOf(RosterScopeNotFoundError);
  });
});
