import { beforeEach, describe, expect, it, vi } from 'vitest';

import { StaffAssignmentNotFoundError } from '../errors/staff-assignment-not-found.error';
import { StaffAssignmentStatus } from '../model/teams.enums';
import type { StaffAssignment } from '../model/teams.types';
import { RemoveStaffAssignmentUseCase } from './remove-staff-assignment.use-case';

const NOW = new Date('2026-06-01T12:00:00.000Z');
const ACTOR = { userId: 'admin-1', email: 'a@example.test', roles: [] };
const SCOPE = {} as never;

const REMOVED: StaffAssignment = {
  id: 'assignment-1',
  teamId: 'team-1',
  membershipId: 'membership-1',
  titleEntryId: 'entry-1',
  photoUrl: null,
  status: StaffAssignmentStatus.Removed,
  createdBy: 'admin-1',
  removedBy: 'admin-1',
  createdAt: NOW,
  updatedAt: NOW,
  removedAt: NOW,
  version: 2,
};

function build() {
  const unitOfWork = {
    runInTransaction: vi.fn((op: (scope: never) => unknown) => op(SCOPE)),
  };
  const clock = { now: () => NOW, uptime: () => 0 };
  const idGenerator = { generate: vi.fn().mockReturnValue('generated') };
  const teamLookup = { requireActive: vi.fn().mockResolvedValue(undefined) };
  const staff = { remove: vi.fn().mockResolvedValue(REMOVED) };
  const audit = { append: vi.fn() };
  const useCase = new RemoveStaffAssignmentUseCase(
    unitOfWork as never,
    clock,
    idGenerator,
    teamLookup as never,
    staff as never,
    audit,
  );
  return { useCase, staff, audit };
}

describe('RemoveStaffAssignmentUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('removes an assignment and audits', async () => {
    const result = await harness.useCase.execute(
      ACTOR,
      'team-1',
      'assignment-1',
    );
    expect(result).toBe(REMOVED);
    expect(harness.audit.append).toHaveBeenCalledOnce();
  });

  it('raises not-found when nothing active matched', async () => {
    harness.staff.remove.mockResolvedValue(null);
    await expect(
      harness.useCase.execute(ACTOR, 'team-1', 'assignment-1'),
    ).rejects.toBeInstanceOf(StaffAssignmentNotFoundError);
  });
});
