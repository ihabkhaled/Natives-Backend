import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { describe, expect, it, vi } from 'vitest';

import { RosterScopeRepository } from './roster-scope.repository';

function scopeReturning(result: unknown[]): {
  scope: TransactionScope;
  run: ReturnType<typeof vi.fn>;
} {
  const run = vi.fn().mockResolvedValue(result);
  return { scope: { run }, run };
}

describe('RosterScopeRepository', () => {
  const repository = new RosterScopeRepository();

  it('resolves the season of a live competition inside the caller’s team', async () => {
    const { scope, run } = scopeReturning([
      { competition_id: 'comp-1', season_id: 'season-1' },
    ]);
    expect(
      await repository.resolveCompetitionScope(scope, 'team-1', 'comp-1'),
    ).toEqual({ competitionId: 'comp-1', seasonId: 'season-1' });
    expect(String(run.mock.calls[0]?.[0])).toContain('c."deleted_at" IS NULL');
  });

  it('hides a deleted or foreign competition as an unresolved scope', async () => {
    const { scope } = scopeReturning([]);
    expect(
      await repository.resolveCompetitionScope(scope, 'team-1', 'comp-9'),
    ).toBeNull();
  });

  it('resolves a fixture scope, inheriting the competition season', async () => {
    const { scope, run } = scopeReturning([
      { competition_id: 'comp-1', season_id: 'season-1' },
    ]);
    expect(
      await repository.resolveFixtureScope(scope, 'team-1', 'fixture-1'),
    ).toEqual({ competitionId: 'comp-1', seasonId: 'season-1' });
    expect(String(run.mock.calls[0]?.[0])).toContain(
      'COALESCE(f."season_id", c."season_id")',
    );
  });

  it('hides a deleted or foreign fixture as an unresolved scope', async () => {
    const { scope } = scopeReturning([]);
    expect(
      await repository.resolveFixtureScope(scope, 'team-1', 'fixture-9'),
    ).toBeNull();
  });

  it('probes a squad inside the resolved team and season', async () => {
    const present = scopeReturning([{ id: 'squad-1' }]);
    expect(
      await repository.squadExistsInScope(
        present.scope,
        'team-1',
        'season-1',
        'squad-1',
      ),
    ).toBe(true);
    const absent = scopeReturning([]);
    expect(
      await repository.squadExistsInScope(
        absent.scope,
        'team-1',
        'season-1',
        'squad-9',
      ),
    ).toBe(false);
  });

  it('probes an active team', async () => {
    const active = scopeReturning([{ id: 'team-1' }]);
    expect(await repository.activeTeamExists(active.scope, 'team-1')).toBe(
      true,
    );
    const archived = scopeReturning([]);
    expect(await repository.activeTeamExists(archived.scope, 'team-2')).toBe(
      false,
    );
  });
});
