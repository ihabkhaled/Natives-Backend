import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ActivityScopeRepository } from './activity-scope.repository';

function build() {
  const scope = { run: vi.fn() };
  return { scope, repository: new ActivityScopeRepository() };
}

describe('ActivityScopeRepository', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('detects an active team and its absence', async () => {
    harness.scope.run.mockResolvedValueOnce([{ id: 't1' }]);
    await expect(
      harness.repository.activeTeamExists(harness.scope as never, 't1'),
    ).resolves.toBe(true);
    expect(String(harness.scope.run.mock.calls[0]?.[0])).toContain(
      `"status" = 'active'`,
    );

    harness.scope.run.mockResolvedValueOnce([]);
    await expect(
      harness.repository.activeTeamExists(harness.scope as never, 'tx'),
    ).resolves.toBe(false);
  });

  it('detects an in-team non-archived season', async () => {
    harness.scope.run.mockResolvedValueOnce([{ id: 's1' }]);
    await expect(
      harness.repository.seasonExistsInTeam(harness.scope as never, 't1', 's1'),
    ).resolves.toBe(true);
    expect(harness.scope.run.mock.calls[0]?.[1]).toEqual(['s1', 't1']);
  });

  it('resolves the acting active membership id or null', async () => {
    harness.scope.run.mockResolvedValueOnce([{ id: 'm1' }]);
    await expect(
      harness.repository.findActiveMembershipId(
        harness.scope as never,
        't1',
        'u1',
      ),
    ).resolves.toBe('m1');
    expect(String(harness.scope.run.mock.calls[0]?.[0])).toContain(
      `"status" = 'active'`,
    );

    harness.scope.run.mockResolvedValueOnce([]);
    await expect(
      harness.repository.findActiveMembershipId(
        harness.scope as never,
        't1',
        'u2',
      ),
    ).resolves.toBeNull();
  });

  it('counts active buddy memberships and defaults to zero', async () => {
    harness.scope.run.mockResolvedValueOnce([{ count: 2 }]);
    await expect(
      harness.repository.countActiveMembershipsInTeam(
        harness.scope as never,
        't1',
        ['m2', 'm3'],
      ),
    ).resolves.toBe(2);
    expect(harness.scope.run.mock.calls[0]?.[1]).toEqual(['t1', ['m2', 'm3']]);

    harness.scope.run.mockResolvedValueOnce([]);
    await expect(
      harness.repository.countActiveMembershipsInTeam(
        harness.scope as never,
        't1',
        ['m2'],
      ),
    ).resolves.toBe(0);
  });
});
