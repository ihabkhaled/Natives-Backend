import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PracticeDashboardSignalsService } from './practice-dashboard-signals.service';

const NOW = new Date('2026-07-20T12:00:00.000Z');

function build() {
  const scope = { run: vi.fn() };
  const unitOfWork = {
    runInTransaction: vi.fn(async (op: (s: typeof scope) => Promise<unknown>) =>
      op(scope),
    ),
  };
  const clock = { now: vi.fn().mockReturnValue(NOW), uptime: vi.fn() };
  const repository = {
    listUpcomingSessions: vi
      .fn()
      .mockResolvedValue([
        { id: 'session-1', starts_at: NOW, has_rsvp: false },
      ]),
    listAttendanceCounts: vi
      .fn()
      .mockResolvedValue([
        { status: 'present', count: 4, latest_at: '2026-07-10T00:00:00.000Z' },
      ]),
    countDraftSessions: vi
      .fn()
      .mockResolvedValue([{ count: 2, boundary_at: NOW }]),
    countOpenAttendanceSheets: vi
      .fn()
      .mockResolvedValue([{ count: 0, boundary_at: null }]),
  };
  const service = new PracticeDashboardSignalsService(
    unitOfWork as never,
    clock,
    repository,
  );
  return { clock, repository, scope, service };
}

describe('PracticeDashboardSignalsService', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('collects every signal against a single frozen clock reading', async () => {
    const signals = await harness.service.collect({
      teamId: 'team-1',
      membershipId: 'membership-1',
    });

    expect(signals.upcomingSessions).toEqual([
      { sessionId: 'session-1', startsAt: NOW, hasRsvp: false },
    ]);
    expect(signals.attendanceCounts).toEqual([{ status: 'present', count: 4 }]);
    expect(signals.attendanceAsOf).toEqual(
      new Date('2026-07-10T00:00:00.000Z'),
    );
    expect(signals.draftSessions).toEqual({ count: 2, asOf: NOW });
    expect(harness.clock.now).toHaveBeenCalledTimes(1);
  });

  it('reports an empty backlog as null, never zero', async () => {
    const signals = await harness.service.collect({
      teamId: 'team-1',
      membershipId: 'membership-1',
    });

    expect(signals.openAttendanceSheets).toEqual({ count: null, asOf: null });
  });

  it('skips the attendance read when there is no viewer membership', async () => {
    const signals = await harness.service.collect({
      teamId: 'team-1',
      membershipId: null,
    });

    expect(harness.repository.listAttendanceCounts).not.toHaveBeenCalled();
    expect(signals.attendanceCounts).toEqual([]);
    expect(signals.attendanceAsOf).toBeNull();
  });
});
