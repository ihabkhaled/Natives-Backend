import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { describe, expect, it, vi } from 'vitest';

import { SquadScopeNotFoundError } from '../errors/squad-scope-not-found.error';
import { SquadScopeRepository } from '../infrastructure/squad-scope.repository';
import { SquadScopeService } from './squad-scope.service';

const TX = { run: vi.fn() } as unknown as TransactionScope;

function repo(
  overrides: Partial<Record<keyof SquadScopeRepository, boolean>> = {},
): SquadScopeRepository {
  return {
    activeTeamExists: vi
      .fn()
      .mockResolvedValue(overrides.activeTeamExists ?? true),
    seasonExistsInTeam: vi
      .fn()
      .mockResolvedValue(overrides.seasonExistsInTeam ?? true),
    competitionExistsInScope: vi
      .fn()
      .mockResolvedValue(overrides.competitionExistsInScope ?? true),
  };
}

describe('SquadScopeService', () => {
  it('passes when the team and season exist and no competition is required', async () => {
    const service = new SquadScopeService(repo());
    await expect(
      service.validate(TX, 'team-1', 'season-1', null),
    ).resolves.toBeUndefined();
  });

  it('validates the competition when one is supplied', async () => {
    const service = new SquadScopeService(repo());
    await expect(
      service.validate(TX, 'team-1', 'season-1', 'comp-1'),
    ).resolves.toBeUndefined();
  });

  it('rejects a missing team, season, or competition with a 404', async () => {
    await expect(
      new SquadScopeService(repo({ activeTeamExists: false })).validate(
        TX,
        'team-1',
        'season-1',
        null,
      ),
    ).rejects.toBeInstanceOf(SquadScopeNotFoundError);
    await expect(
      new SquadScopeService(repo({ seasonExistsInTeam: false })).validate(
        TX,
        'team-1',
        'season-1',
        null,
      ),
    ).rejects.toBeInstanceOf(SquadScopeNotFoundError);
    await expect(
      new SquadScopeService(repo({ competitionExistsInScope: false })).validate(
        TX,
        'team-1',
        'season-1',
        'comp-1',
      ),
    ).rejects.toBeInstanceOf(SquadScopeNotFoundError);
  });
});
