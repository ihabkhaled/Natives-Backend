import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AssessmentDashboardSignalsService } from './assessment-dashboard-signals.service';

function build() {
  const scope = { run: vi.fn() };
  const unitOfWork = {
    runInTransaction: vi.fn(async (op: (s: typeof scope) => Promise<unknown>) =>
      op(scope),
    ),
  };
  const repository = {
    countPublishedForMember: vi
      .fn()
      .mockResolvedValue([
        { count: 2, boundary_at: '2026-07-15T00:00:00.000Z' },
      ]),
    countAwaitingReview: vi
      .fn()
      .mockResolvedValue([{ count: 0, boundary_at: null }]),
  };
  const service = new AssessmentDashboardSignalsService(
    unitOfWork as never,
    repository,
  );
  return { repository, service };
}

describe('AssessmentDashboardSignalsService', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('collects both signals in one transaction', async () => {
    const signals = await harness.service.collect({
      teamId: 'team-1',
      membershipId: 'membership-1',
    });

    expect(signals.publishedForViewer).toEqual({
      count: 2,
      asOf: new Date('2026-07-15T00:00:00.000Z'),
    });
    expect(signals.awaitingReview).toEqual({ count: null, asOf: null });
  });

  it('skips the member read when there is no viewer membership', async () => {
    const signals = await harness.service.collect({
      teamId: 'team-1',
      membershipId: null,
    });

    expect(harness.repository.countPublishedForMember).not.toHaveBeenCalled();
    expect(signals.publishedForViewer).toEqual({ count: null, asOf: null });
  });
});
