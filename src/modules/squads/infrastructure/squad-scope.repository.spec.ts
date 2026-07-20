import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { describe, expect, it, vi } from 'vitest';

import type { IdRow } from '../model/squads.rows';
import { SquadScopeRepository } from './squad-scope.repository';

function scope(rows: IdRow[]): TransactionScope {
  return { run: vi.fn().mockResolvedValue(rows) };
}

describe('SquadScopeRepository', () => {
  const repository = new SquadScopeRepository();

  it('reports team, season, and competition existence', async () => {
    expect(await repository.activeTeamExists(scope([{ id: 't' }]), 't')).toBe(
      true,
    );
    expect(await repository.activeTeamExists(scope([]), 't')).toBe(false);
    expect(
      await repository.seasonExistsInTeam(scope([{ id: 's' }]), 't', 's'),
    ).toBe(true);
    expect(await repository.seasonExistsInTeam(scope([]), 't', 's')).toBe(
      false,
    );
    expect(
      await repository.competitionExistsInScope(
        scope([{ id: 'c' }]),
        't',
        's',
        'c',
      ),
    ).toBe(true);
    expect(
      await repository.competitionExistsInScope(scope([]), 't', 's', 'c'),
    ).toBe(false);
  });
});
