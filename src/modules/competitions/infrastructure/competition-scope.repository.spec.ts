import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { describe, expect, it, vi } from 'vitest';

import { CompetitionScopeRepository } from './competition-scope.repository';

function scope(rows: unknown[]): TransactionScope {
  return {
    run: vi.fn().mockResolvedValue(rows),
  };
}

describe('CompetitionScopeRepository', () => {
  const repository = new CompetitionScopeRepository();

  it('reports team existence from a single-row probe', async () => {
    expect(
      await repository.activeTeamExists(scope([{ id: 'team-1' }]), 'team-1'),
    ).toBe(true);
    expect(await repository.activeTeamExists(scope([]), 'team-1')).toBe(false);
  });

  it('reports season existence within a team', async () => {
    expect(
      await repository.seasonExistsInTeam(
        scope([{ id: 'season-1' }]),
        'team-1',
        'season-1',
      ),
    ).toBe(true);
    expect(
      await repository.seasonExistsInTeam(scope([]), 'team-1', 'season-1'),
    ).toBe(false);
  });

  it('reports venue existence within a team', async () => {
    expect(
      await repository.venueExistsInTeam(
        scope([{ id: 'venue-1' }]),
        'team-1',
        'venue-1',
      ),
    ).toBe(true);
    expect(
      await repository.venueExistsInTeam(scope([]), 'team-1', 'venue-1'),
    ).toBe(false);
  });
});
