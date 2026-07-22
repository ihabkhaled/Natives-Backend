import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RBAC_SUPER_ADMIN_LIST_MAX } from '../model/rbac.constants';
import type { SuperAdminEntry } from '../model/rbac.types';
import { ListSuperAdminsUseCase } from './list-super-admins.use-case';

const NOW = new Date('2026-07-01T12:00:00.000Z');

const ENTRY: SuperAdminEntry = {
  assignmentId: 'assign-1',
  userId: 'user-1',
  email: 'root@example.test',
  displayName: 'Root',
  effectiveFrom: NOW,
  grantedBy: null,
};

function build() {
  const scope = { run: vi.fn() };
  const unitOfWork = {
    runInTransaction: vi.fn(async (op: (s: typeof scope) => Promise<unknown>) =>
      op(scope),
    ),
  };
  const repository = {
    listActiveGlobalAssignments: vi.fn().mockResolvedValue([ENTRY]),
    countActiveGlobalAssignments: vi.fn().mockResolvedValue(1),
  };
  const useCase = new ListSuperAdminsUseCase(
    unitOfWork as never,
    repository as never,
  );
  return { useCase, repository, scope };
}

describe('ListSuperAdminsUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('returns the bounded holder list with the authoritative total', async () => {
    const view = await harness.useCase.execute();

    expect(view).toEqual({ items: [ENTRY], total: 1 });
    expect(harness.repository.listActiveGlobalAssignments).toHaveBeenCalledWith(
      harness.scope,
      'SUPER_ADMIN',
      RBAC_SUPER_ADMIN_LIST_MAX,
    );
    expect(
      harness.repository.countActiveGlobalAssignments,
    ).toHaveBeenCalledWith(harness.scope, 'SUPER_ADMIN');
  });

  it('returns an empty page when nobody holds the role', async () => {
    harness.repository.listActiveGlobalAssignments.mockResolvedValue([]);
    harness.repository.countActiveGlobalAssignments.mockResolvedValue(0);

    await expect(harness.useCase.execute()).resolves.toEqual({
      items: [],
      total: 0,
    });
  });
});
