import { beforeEach, describe, expect, it, vi } from 'vitest';

import { StaffAssignmentStatus } from '../model/teams.enums';
import type { StaffAssignmentRow } from '../model/teams.rows';
import type { NewStaffAssignment } from '../model/teams.types';
import { StaffAssignmentRepository } from './staff-assignment.repository';

const NOW = new Date('2026-06-01T12:00:00.000Z');

function buildScope() {
  return { run: vi.fn() };
}

function assignmentRow(
  overrides: Partial<StaffAssignmentRow> = {},
): StaffAssignmentRow {
  return {
    id: 'assignment-1',
    team_id: 'team-1',
    membership_id: 'membership-1',
    title_entry_id: 'entry-1',
    photo_url: null,
    status: 'active',
    created_by: 'admin-1',
    removed_by: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    removed_at: null,
    version: 1,
    ...overrides,
  };
}

const NEW_ASSIGNMENT: NewStaffAssignment = {
  id: 'assignment-1',
  teamId: 'team-1',
  membershipId: 'membership-1',
  titleEntryId: 'entry-1',
  photoUrl: null,
  createdBy: 'admin-1',
  now: NOW,
};

describe('StaffAssignmentRepository', () => {
  let repository: StaffAssignmentRepository;
  let scope: ReturnType<typeof buildScope>;

  beforeEach(() => {
    repository = new StaffAssignmentRepository();
    scope = buildScope();
  });

  it('reports whether a membership exists within a team', async () => {
    scope.run.mockResolvedValueOnce([{ id: 'membership-1' }]);
    await expect(
      repository.membershipExistsInTeam(
        scope as never,
        'team-1',
        'membership-1',
      ),
    ).resolves.toBe(true);

    scope.run.mockResolvedValueOnce([]);
    await expect(
      repository.membershipExistsInTeam(scope as never, 'team-1', 'ghost'),
    ).resolves.toBe(false);
  });

  it('reports whether an active assignment already exists', async () => {
    scope.run.mockResolvedValueOnce([{ id: 'assignment-1' }]);
    await expect(
      repository.existsActive(
        scope as never,
        'team-1',
        'membership-1',
        'entry-1',
      ),
    ).resolves.toBe(true);

    scope.run.mockResolvedValueOnce([]);
    await expect(
      repository.existsActive(
        scope as never,
        'team-1',
        'membership-1',
        'entry-1',
      ),
    ).resolves.toBe(false);
  });

  it('finds an assignment within a team or returns null', async () => {
    scope.run.mockResolvedValueOnce([assignmentRow()]);
    await expect(
      repository.findByIdInTeam(scope as never, 'team-1', 'assignment-1'),
    ).resolves.toMatchObject({ status: StaffAssignmentStatus.Active });

    scope.run.mockResolvedValueOnce([]);
    await expect(
      repository.findByIdInTeam(scope as never, 'team-1', 'ghost'),
    ).resolves.toBeNull();
  });

  it('inserts an assignment', async () => {
    scope.run.mockResolvedValue([assignmentRow()]);
    await expect(
      repository.insert(scope as never, NEW_ASSIGNMENT),
    ).resolves.toMatchObject({
      id: 'assignment-1',
      membershipId: 'membership-1',
    });
  });

  it('throws when the insert returns no row', async () => {
    scope.run.mockResolvedValue([]);
    await expect(
      repository.insert(scope as never, NEW_ASSIGNMENT),
    ).rejects.toThrow(/returned row/u);
  });

  it('removes an assignment or returns null when not active', async () => {
    scope.run.mockResolvedValueOnce([assignmentRow({ status: 'removed' })]);
    await expect(
      repository.remove(scope as never, {
        id: 'assignment-1',
        teamId: 'team-1',
        updatedBy: 'admin-1',
        now: NOW,
      }),
    ).resolves.toMatchObject({ status: StaffAssignmentStatus.Removed });

    scope.run.mockResolvedValueOnce([]);
    await expect(
      repository.remove(scope as never, {
        id: 'assignment-1',
        teamId: 'team-1',
        updatedBy: 'admin-1',
        now: NOW,
      }),
    ).resolves.toBeNull();
  });

  it('lists the public staff directory, aggregating titles per membership', async () => {
    scope.run.mockResolvedValueOnce([
      {
        membership_id: 'membership-1',
        display_name: 'Sherif Ashraf',
        nickname: '3alamy',
        titles: ['Coach'],
        photo_url: null,
      },
      {
        membership_id: 'membership-2',
        display_name: null,
        nickname: null,
        titles: ['Analysis', 'Co-Coach', 'Technical'],
        photo_url: 'https://example.test/photo.jpg',
      },
    ]);

    const entries = await repository.listPublicDirectory(
      scope as never,
      'team-1',
    );

    expect(entries).toEqual([
      {
        membershipId: 'membership-1',
        displayName: 'Sherif Ashraf',
        nickname: '3alamy',
        titles: ['Coach'],
        photoUrl: null,
      },
      {
        membershipId: 'membership-2',
        displayName: 'Staff member',
        nickname: null,
        titles: ['Analysis', 'Co-Coach', 'Technical'],
        photoUrl: 'https://example.test/photo.jpg',
      },
    ]);
    const sql = String(scope.run.mock.calls[0]?.[0]);
    expect(sql).toContain('LEFT JOIN "member_profiles"');
    expect(sql).toContain('LEFT JOIN "users"');
    expect(sql).toContain('array_agg(DISTINCT "rce"."label"');
  });

  it('lists assignments with a total, defaulting the count to zero', async () => {
    scope.run.mockResolvedValueOnce([assignmentRow()]);
    scope.run.mockResolvedValueOnce([{ count: 1 }]);
    await expect(
      repository.listByTeam(scope as never, 'team-1', { limit: 20, offset: 0 }),
    ).resolves.toMatchObject({ total: 1 });

    scope.run.mockResolvedValueOnce([]);
    scope.run.mockResolvedValueOnce([]);
    const fallback = await repository.listByTeam(scope as never, 'team-1', {
      limit: 20,
      offset: 0,
    });
    expect(fallback.total).toBe(0);
  });
});
