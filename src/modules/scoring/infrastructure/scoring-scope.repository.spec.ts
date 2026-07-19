import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ScoringScopeRepository } from './scoring-scope.repository';

function build() {
  const scope = { run: vi.fn() };
  return { scope, repository: new ScoringScopeRepository() };
}

describe('ScoringScopeRepository', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('reports team existence from the probe result', async () => {
    harness.scope.run.mockResolvedValueOnce([{ id: 'team-1' }]);
    await expect(
      harness.repository.activeTeamExists(harness.scope as never, 'team-1'),
    ).resolves.toBe(true);
    harness.scope.run.mockResolvedValueOnce([]);
    await expect(
      harness.repository.activeTeamExists(harness.scope as never, 'team-1'),
    ).resolves.toBe(false);
  });

  it('reports season existence within a team', async () => {
    harness.scope.run.mockResolvedValueOnce([{ id: 'season-1' }]);
    await expect(
      harness.repository.seasonExistsInTeam(
        harness.scope as never,
        'team-1',
        'season-1',
      ),
    ).resolves.toBe(true);
  });

  it('reports membership existence within a team', async () => {
    harness.scope.run.mockResolvedValueOnce([]);
    await expect(
      harness.repository.membershipExistsInTeam(
        harness.scope as never,
        'team-1',
        'mem-1',
      ),
    ).resolves.toBe(false);
  });
});
