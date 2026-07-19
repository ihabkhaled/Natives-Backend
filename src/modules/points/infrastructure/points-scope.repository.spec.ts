import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PointsScopeRepository } from './points-scope.repository';

function build() {
  const run = vi.fn();
  const scope = { run } as never;
  return { run, scope, repository: new PointsScopeRepository() };
}

describe('PointsScopeRepository', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('resolves team/season/membership existence from single-row probes', async () => {
    harness.run.mockResolvedValueOnce([{ id: 't' }]);
    expect(await harness.repository.activeTeamExists(harness.scope, 't')).toBe(
      true,
    );
    harness.run.mockResolvedValueOnce([]);
    expect(
      await harness.repository.seasonExistsInTeam(harness.scope, 't', 's'),
    ).toBe(false);
    harness.run.mockResolvedValueOnce([{ id: 'm' }]);
    expect(
      await harness.repository.membershipExistsInTeam(harness.scope, 't', 'm'),
    ).toBe(true);
  });

  it('resolves the caller membership or null', async () => {
    harness.run.mockResolvedValueOnce([{ id: 'mem-1' }]);
    expect(
      await harness.repository.membershipForUser(harness.scope, 't', 'u'),
    ).toBe('mem-1');
    harness.run.mockResolvedValueOnce([]);
    expect(
      await harness.repository.membershipForUser(harness.scope, 't', 'u'),
    ).toBeNull();
  });
});
