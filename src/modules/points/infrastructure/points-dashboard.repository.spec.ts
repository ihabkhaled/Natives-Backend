import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PointsDashboardRepository } from './points-dashboard.repository';

describe('PointsDashboardRepository', () => {
  let repository: PointsDashboardRepository;
  let scope: { run: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    repository = new PointsDashboardRepository();
    scope = { run: vi.fn().mockResolvedValue([]) };
  });

  it('ranks in the database and returns only the requested member row', async () => {
    await repository.standingFor(
      scope as never,
      'team-1',
      'season-1',
      'membership-1',
    );

    const sql = String(scope.run.mock.calls[0]?.[0]);
    expect(sql).toContain('RANK() OVER');
    expect(sql).toContain('LIMIT 1');
    expect(scope.run.mock.calls[0]?.[1]).toEqual([
      'team-1',
      'season-1',
      'membership-1',
    ]);
  });

  it('falls back to the whole team when no season is scoped', async () => {
    await repository.standingFor(scope as never, 'team-1', null, 'm-1');

    expect(String(scope.run.mock.calls[0]?.[0])).toContain(
      '$2::uuid IS NULL OR',
    );
    expect(scope.run.mock.calls[0]?.[1]?.[1]).toBeNull();
  });
});
