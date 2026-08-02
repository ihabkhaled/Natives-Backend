import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SlugConflictError } from '../errors/slug-conflict.error';
import { StaffMembershipNotFoundError } from '../errors/staff-membership-not-found.error';
import { StaffTitleNotFoundError } from '../errors/staff-title-not-found.error';
import {
  CatalogName,
  ResourceStatus,
  StaffAssignmentStatus,
} from '../model/teams.enums';
import type { CatalogEntry, StaffAssignment } from '../model/teams.types';
import { AssignStaffTitleUseCase } from './assign-staff-title.use-case';

const NOW = new Date('2026-06-01T12:00:00.000Z');
const ACTOR = { userId: 'admin-1', email: 'a@example.test', roles: [] };
const SCOPE = {} as never;

const TITLE_ENTRY: CatalogEntry = {
  id: 'entry-1',
  teamId: 'team-1',
  catalog: CatalogName.StaffTitle,
  key: 'coach',
  label: 'Coach',
  sortOrder: 0,
  metadata: {},
  referenceCount: 0,
  status: ResourceStatus.Active,
  createdBy: 'admin-1',
  updatedBy: null,
  createdAt: NOW,
  updatedAt: NOW,
  version: 1,
};

const ASSIGNMENT: StaffAssignment = {
  id: 'assignment-1',
  teamId: 'team-1',
  membershipId: 'membership-1',
  titleEntryId: 'entry-1',
  photoUrl: null,
  status: StaffAssignmentStatus.Active,
  createdBy: 'admin-1',
  removedBy: null,
  createdAt: NOW,
  updatedAt: NOW,
  removedAt: null,
  version: 1,
};

const COMMAND = {
  membershipId: 'membership-1',
  titleEntryId: 'entry-1',
  photoUrl: null,
};

function build() {
  const unitOfWork = {
    runInTransaction: vi.fn((op: (scope: never) => unknown) => op(SCOPE)),
  };
  const clock = { now: () => NOW, uptime: () => 0 };
  const idGenerator = { generate: vi.fn().mockReturnValue('generated') };
  const teamLookup = { requireActive: vi.fn().mockResolvedValue(undefined) };
  const catalog = { findByIdInTeam: vi.fn().mockResolvedValue(TITLE_ENTRY) };
  const staff = {
    membershipExistsInTeam: vi.fn().mockResolvedValue(true),
    existsActive: vi.fn().mockResolvedValue(false),
    insert: vi.fn().mockResolvedValue(ASSIGNMENT),
  };
  const audit = { append: vi.fn() };
  const useCase = new AssignStaffTitleUseCase(
    unitOfWork as never,
    clock,
    idGenerator,
    teamLookup as never,
    catalog as never,
    staff as never,
    audit,
  );
  return { useCase, catalog, staff, audit };
}

describe('AssignStaffTitleUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('assigns a title and audits', async () => {
    const result = await harness.useCase.execute(ACTOR, 'team-1', COMMAND);
    expect(result).toBe(ASSIGNMENT);
    expect(harness.staff.insert.mock.calls[0]?.[1]).toMatchObject({
      membershipId: 'membership-1',
      titleEntryId: 'entry-1',
      createdBy: 'admin-1',
    });
    expect(harness.audit.append).toHaveBeenCalledOnce();
  });

  it('rejects when the membership does not exist in the team', async () => {
    harness.staff.membershipExistsInTeam.mockResolvedValue(false);
    await expect(
      harness.useCase.execute(ACTOR, 'team-1', COMMAND),
    ).rejects.toBeInstanceOf(StaffMembershipNotFoundError);
  });

  it('rejects when the title entry does not exist', async () => {
    harness.catalog.findByIdInTeam.mockResolvedValue(null);
    await expect(
      harness.useCase.execute(ACTOR, 'team-1', COMMAND),
    ).rejects.toBeInstanceOf(StaffTitleNotFoundError);
  });

  it('rejects when the entry is not a staff_title catalog entry', async () => {
    harness.catalog.findByIdInTeam.mockResolvedValue({
      ...TITLE_ENTRY,
      catalog: CatalogName.Position,
    });
    await expect(
      harness.useCase.execute(ACTOR, 'team-1', COMMAND),
    ).rejects.toBeInstanceOf(StaffTitleNotFoundError);
  });

  it('rejects when the entry is archived', async () => {
    harness.catalog.findByIdInTeam.mockResolvedValue({
      ...TITLE_ENTRY,
      status: ResourceStatus.Archived,
    });
    await expect(
      harness.useCase.execute(ACTOR, 'team-1', COMMAND),
    ).rejects.toBeInstanceOf(StaffTitleNotFoundError);
  });

  it('rejects a duplicate active assignment', async () => {
    harness.staff.existsActive.mockResolvedValue(true);
    await expect(
      harness.useCase.execute(ACTOR, 'team-1', COMMAND),
    ).rejects.toBeInstanceOf(SlugConflictError);
  });
});
