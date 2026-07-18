import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ScheduleQueryService } from './schedule-query.service';

const SCOPE = {} as never;
const PAGE = { limit: 20, offset: 0 };

function build() {
  const unitOfWork = {
    runInTransaction: vi.fn((op: (scope: never) => unknown) => op(SCOPE)),
  };
  const schedules = {
    list: vi
      .fn()
      .mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0 }),
  };
  const lookup = {
    requireSchedule: vi.fn().mockResolvedValue({ id: 'sch-1' }),
  };
  const service = new ScheduleQueryService(
    unitOfWork as never,
    schedules as never,
    lookup as never,
  );
  return { service, schedules, lookup };
}

describe('ScheduleQueryService', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('lists schedules for a team via the repository', async () => {
    const result = await harness.service.listSchedules('team-1', PAGE);
    expect(result.total).toBe(0);
    expect(harness.schedules.list).toHaveBeenCalledWith(SCOPE, 'team-1', PAGE);
  });

  it('resolves a single schedule within team scope', async () => {
    const result = await harness.service.getSchedule('team-1', 'sch-1');
    expect(result).toEqual({ id: 'sch-1' });
    expect(harness.lookup.requireSchedule).toHaveBeenCalledWith(
      SCOPE,
      'team-1',
      'sch-1',
    );
  });
});
