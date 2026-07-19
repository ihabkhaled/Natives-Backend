import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MeasurementScopeRepository } from './measurement-scope.repository';

function build() {
  const scope = { run: vi.fn() };
  return { scope, repository: new MeasurementScopeRepository() };
}

describe('MeasurementScopeRepository', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('reports team existence from the probe rows', async () => {
    harness.scope.run.mockResolvedValueOnce([{ id: 'team-1' }]);
    await expect(
      harness.repository.activeTeamExists(harness.scope as never, 'team-1'),
    ).resolves.toBe(true);
    harness.scope.run.mockResolvedValueOnce([]);
    await expect(
      harness.repository.activeTeamExists(harness.scope as never, 'team-1'),
    ).resolves.toBe(false);
  });

  it('reports season and membership existence', async () => {
    harness.scope.run.mockResolvedValueOnce([{ id: 'season-1' }]);
    await expect(
      harness.repository.seasonExistsInTeam(
        harness.scope as never,
        'team-1',
        'season-1',
      ),
    ).resolves.toBe(true);
    harness.scope.run.mockResolvedValueOnce([]);
    await expect(
      harness.repository.membershipExistsInTeam(
        harness.scope as never,
        'team-1',
        'member-1',
      ),
    ).resolves.toBe(false);
  });

  it('resolves the caller membership or null', async () => {
    harness.scope.run.mockResolvedValueOnce([{ id: 'member-1' }]);
    await expect(
      harness.repository.findActiveMembershipIdForUser(
        harness.scope as never,
        'team-1',
        'user-1',
      ),
    ).resolves.toBe('member-1');
    harness.scope.run.mockResolvedValueOnce([]);
    await expect(
      harness.repository.findActiveMembershipIdForUser(
        harness.scope as never,
        'team-1',
        'user-1',
      ),
    ).resolves.toBeNull();
  });
});
