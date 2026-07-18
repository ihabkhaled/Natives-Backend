import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TeamScopeRepository } from './team-scope.repository';

function buildScope() {
  return { run: vi.fn() };
}

describe('TeamScopeRepository', () => {
  let repo: TeamScopeRepository;
  let scope: ReturnType<typeof buildScope>;

  beforeEach(() => {
    repo = new TeamScopeRepository();
    scope = buildScope();
  });

  it('reports an active team as existing', async () => {
    scope.run.mockResolvedValueOnce([{ id: 'team-1' }]);
    await expect(repo.activeTeamExists(scope as never, 'team-1')).resolves.toBe(
      true,
    );
  });

  it('reports a missing or archived team as absent', async () => {
    scope.run.mockResolvedValueOnce([]);
    await expect(repo.activeTeamExists(scope as never, 'ghost')).resolves.toBe(
      false,
    );
  });
});
