import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EMPTY_POINTS_STANDING } from '../lib/signals.mapper';
import { PointsDashboardSignalsService } from './points-dashboard-signals.service';

function build() {
  const scope = { run: vi.fn() };
  const unitOfWork = {
    runInTransaction: vi.fn(async (op: (s: typeof scope) => Promise<unknown>) =>
      op(scope),
    ),
  };
  const repository = {
    standingFor: vi
      .fn()
      .mockResolvedValue([
        { total: '18', rank: 1, population: 6, latest_at: null },
      ]),
  };
  const service = new PointsDashboardSignalsService(
    unitOfWork as never,
    repository,
  );
  return { repository, scope, service };
}

describe('PointsDashboardSignalsService', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('projects the standing for the requested scope', async () => {
    const standing = await harness.service.standing({
      teamId: 'team-1',
      seasonId: 'season-1',
      membershipId: 'membership-1',
    });

    expect(standing).toEqual({
      total: 18,
      rank: 1,
      population: 6,
      asOf: null,
    });
    expect(harness.repository.standingFor).toHaveBeenCalledWith(
      harness.scope,
      'team-1',
      'season-1',
      'membership-1',
    );
  });

  it('never queries the ledger without a viewer membership', async () => {
    const standing = await harness.service.standing({
      teamId: 'team-1',
      seasonId: null,
      membershipId: null,
    });

    expect(standing).toBe(EMPTY_POINTS_STANDING);
    expect(harness.repository.standingFor).not.toHaveBeenCalled();
  });
});
