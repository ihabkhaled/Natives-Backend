import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { RoleAssignment } from '../model/rbac.types';
import { RoleAssignmentQueryService } from './role-assignment-query.service';

const NOW = new Date('2026-07-20T12:00:00.000Z');

function assignment(overrides: Partial<RoleAssignment> = {}): RoleAssignment {
  return {
    id: 'assignment-1',
    userId: 'user-1',
    roleId: 'role-1',
    roleKey: 'COACH',
    teamId: 'team-1',
    seasonId: null,
    effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
    effectiveTo: null,
    grantedBy: null,
    revokedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    version: 1,
    ...overrides,
  };
}

function build() {
  const scope = { run: vi.fn() };
  const unitOfWork = {
    runInTransaction: vi.fn(async (op: (s: typeof scope) => Promise<unknown>) =>
      op(scope),
    ),
  };
  const clock = { now: vi.fn().mockReturnValue(NOW), uptime: vi.fn() };
  const repository = { listActiveAssignmentsForUser: vi.fn() };
  const service = new RoleAssignmentQueryService(
    unitOfWork as never,
    clock,
    repository as never,
  );
  return { clock, repository, scope, service };
}

describe('RoleAssignmentQueryService', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('reads every unrevoked assignment inside one transaction', async () => {
    const rows = [assignment()];
    harness.repository.listActiveAssignmentsForUser.mockResolvedValue(rows);

    expect(await harness.service.listForUser('user-1')).toBe(rows);
    expect(
      harness.repository.listActiveAssignmentsForUser,
    ).toHaveBeenCalledWith(harness.scope, 'user-1');
  });

  it('narrows the live list to assignments in effect at the frozen clock', async () => {
    harness.repository.listActiveAssignmentsForUser.mockResolvedValue([
      assignment({ id: 'live' }),
      assignment({
        id: 'expired',
        effectiveTo: new Date('2026-01-02T00:00:00.000Z'),
      }),
      assignment({
        id: 'future',
        effectiveFrom: new Date('2026-12-01T00:00:00.000Z'),
      }),
    ]);

    const live = await harness.service.listLiveForUser('user-1');

    expect(live.map(item => item.id)).toEqual(['live']);
    expect(harness.clock.now).toHaveBeenCalled();
  });

  it('returns an empty live list when the user holds nothing', async () => {
    harness.repository.listActiveAssignmentsForUser.mockResolvedValue([]);

    expect(await harness.service.listLiveForUser('user-1')).toEqual([]);
  });
});
