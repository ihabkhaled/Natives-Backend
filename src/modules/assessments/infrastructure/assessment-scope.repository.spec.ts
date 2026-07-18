import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AssessmentScopeRepository } from './assessment-scope.repository';

function build() {
  const scope = { run: vi.fn() };
  return { scope, repository: new AssessmentScopeRepository() };
}

describe('AssessmentScopeRepository', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('reports an active team by parameterized id', async () => {
    harness.scope.run.mockResolvedValueOnce([{ id: 'team-1' }]);
    await expect(
      harness.repository.activeTeamExists(harness.scope as never, 'team-1'),
    ).resolves.toBe(true);
    expect(String(harness.scope.run.mock.calls[0]?.[0])).toContain(
      `"status" = 'active'`,
    );
    expect(harness.scope.run.mock.calls[0]?.[1]).toEqual(['team-1']);
  });

  it('reports a missing team as absent', async () => {
    harness.scope.run.mockResolvedValueOnce([]);
    await expect(
      harness.repository.activeTeamExists(harness.scope as never, 'team-x'),
    ).resolves.toBe(false);
  });

  it('reports a non-archived in-team season and its absence', async () => {
    harness.scope.run.mockResolvedValueOnce([{ id: 'season-1' }]);
    await expect(
      harness.repository.seasonExistsInTeam(
        harness.scope as never,
        'team-1',
        'season-1',
      ),
    ).resolves.toBe(true);
    expect(harness.scope.run.mock.calls[0]?.[1]).toEqual([
      'season-1',
      'team-1',
    ]);

    harness.scope.run.mockResolvedValueOnce([]);
    await expect(
      harness.repository.seasonExistsInTeam(
        harness.scope as never,
        'team-1',
        'season-x',
      ),
    ).resolves.toBe(false);
  });
});
