import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ListStaffAssignmentsResult } from '../model/teams.types';
import { StaffAssignmentQueryService } from './staff-assignment-query.service';

const SCOPE = {} as never;

const RESULT: ListStaffAssignmentsResult = {
  items: [],
  total: 0,
  limit: 20,
  offset: 0,
};

function build() {
  const unitOfWork = {
    runInTransaction: vi.fn((op: (scope: never) => unknown) => op(SCOPE)),
  };
  const staff = { listByTeam: vi.fn().mockResolvedValue(RESULT) };
  const service = new StaffAssignmentQueryService(
    unitOfWork as never,
    staff as never,
  );
  return { service, staff };
}

describe('StaffAssignmentQueryService', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('lists staff assignments for a team through the unit of work', async () => {
    const page = { limit: 20, offset: 0 };
    const result = await harness.service.list('team-1', page);
    expect(result).toBe(RESULT);
    expect(harness.staff.listByTeam).toHaveBeenCalledWith(
      SCOPE,
      'team-1',
      page,
    );
  });
});
