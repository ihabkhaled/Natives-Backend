import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GrantEffect } from '../model/rbac.enums';
import type { RoleAssignmentRow } from '../model/rbac.rows';
import type { NewRoleAssignment } from '../model/rbac.types';
import { RbacRepository } from './rbac.repository';

const NOW = new Date('2026-06-01T12:00:00.000Z');

function buildScope() {
  return { run: vi.fn() };
}

function assignmentRow(
  overrides: Partial<RoleAssignmentRow> = {},
): RoleAssignmentRow {
  return {
    id: 'assign-1',
    user_id: 'user-1',
    role_id: 'role-1',
    role_key: 'MEMBER',
    team_id: null,
    season_id: null,
    effective_from: '2026-01-01T00:00:00.000Z',
    effective_to: null,
    granted_by: 'admin-1',
    revoked_at: null,
    created_at: '2026-01-01T00:00:00.000Z',
    version: 1,
    ...overrides,
  };
}

const NEW_ASSIGNMENT: NewRoleAssignment = {
  id: 'assign-1',
  userId: 'user-1',
  roleId: 'role-1',
  roleKey: 'MEMBER',
  teamId: 'team-1',
  seasonId: null,
  effectiveFrom: NOW,
  effectiveTo: null,
  grantedBy: 'admin-1',
};

describe('RbacRepository', () => {
  let repository: RbacRepository;
  let scope: ReturnType<typeof buildScope>;

  beforeEach(() => {
    repository = new RbacRepository();
    scope = buildScope();
  });

  it('reports whether a user is active', async () => {
    scope.run.mockResolvedValueOnce([{ id: 'user-1' }]);
    await expect(
      repository.isUserActive(scope as never, 'user-1'),
    ).resolves.toBe(true);

    scope.run.mockResolvedValueOnce([]);
    await expect(
      repository.isUserActive(scope as never, 'user-1'),
    ).resolves.toBe(false);
  });

  it('reads the current policy version', async () => {
    scope.run.mockResolvedValue([{ version: 7 }]);

    await expect(repository.currentPolicyVersion(scope as never)).resolves.toBe(
      7,
    );
  });

  it('throws when the policy version row is missing', async () => {
    scope.run.mockResolvedValue([]);

    await expect(
      repository.currentPolicyVersion(scope as never),
    ).rejects.toThrow(/policy version/u);
  });

  it('bumps the policy version', async () => {
    scope.run.mockResolvedValue([]);

    await repository.bumpPolicyVersion(scope as never, NOW);

    expect(scope.run.mock.calls[0]?.[0]).toContain('rbac_policy_version');
    expect(scope.run.mock.calls[0]?.[1]).toEqual([NOW.toISOString()]);
  });

  it('maps assignment grants, parsing string and Date timestamps', async () => {
    scope.run.mockResolvedValue([
      {
        permission: 'team.read',
        team_id: null,
        season_id: null,
        effective_from: '2026-01-01T00:00:00.000Z',
        effective_to: null,
      },
      {
        permission: 'match.score',
        team_id: 'team-1',
        season_id: 'season-1',
        effective_from: NOW,
        effective_to: NOW,
      },
    ]);

    const grants = await repository.loadAssignmentGrants(
      scope as never,
      'user-1',
    );

    expect(grants[0]).toEqual({
      permission: 'team.read',
      effect: GrantEffect.Allow,
      teamId: null,
      seasonId: null,
      effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
      effectiveTo: null,
    });
    expect(grants[1]?.effectiveTo).toEqual(NOW);
    expect(grants[1]?.teamId).toBe('team-1');
  });

  it('finds a role by key or returns null', async () => {
    scope.run.mockResolvedValueOnce([{ id: 'role-1', key: 'MEMBER' }]);
    await expect(
      repository.findRoleByKey(scope as never, 'MEMBER'),
    ).resolves.toEqual({ id: 'role-1', key: 'MEMBER' });

    scope.run.mockResolvedValueOnce([]);
    await expect(
      repository.findRoleByKey(scope as never, 'GHOST'),
    ).resolves.toBeNull();
  });

  it('loads role permission keys', async () => {
    scope.run.mockResolvedValue([{ key: 'team.read' }, { key: 'member.list' }]);

    await expect(
      repository.loadRolePermissions(scope as never, 'role-1'),
    ).resolves.toEqual(['team.read', 'member.list']);
  });

  it('inserts an assignment and maps the returned row', async () => {
    scope.run.mockResolvedValue([assignmentRow({ team_id: 'team-1' })]);

    const result = await repository.insertAssignment(
      scope as never,
      NEW_ASSIGNMENT,
    );

    expect(result.id).toBe('assign-1');
    expect(result.roleKey).toBe('MEMBER');
    expect(result.teamId).toBe('team-1');
    expect(result.effectiveFrom).toEqual(new Date('2026-01-01T00:00:00.000Z'));
  });

  it('inserts an assignment with an effective-to bound', async () => {
    scope.run.mockResolvedValue([
      assignmentRow({ effective_to: '2026-12-01T00:00:00.000Z' }),
    ]);

    const result = await repository.insertAssignment(scope as never, {
      ...NEW_ASSIGNMENT,
      effectiveTo: new Date('2026-12-01T00:00:00.000Z'),
    });

    expect(result.effectiveTo).toEqual(new Date('2026-12-01T00:00:00.000Z'));
  });

  it('throws when the insert returns no row', async () => {
    scope.run.mockResolvedValue([]);

    await expect(
      repository.insertAssignment(scope as never, NEW_ASSIGNMENT),
    ).rejects.toThrow(/returned row/u);
  });

  it('finds an active assignment by id or returns null', async () => {
    scope.run.mockResolvedValueOnce([assignmentRow()]);
    await expect(
      repository.findActiveAssignmentById(scope as never, 'assign-1'),
    ).resolves.toMatchObject({ id: 'assign-1', roleKey: 'MEMBER' });

    scope.run.mockResolvedValueOnce([]);
    await expect(
      repository.findActiveAssignmentById(scope as never, 'missing'),
    ).resolves.toBeNull();
  });

  it('reports whether a revoke affected a row', async () => {
    scope.run.mockResolvedValueOnce([{ id: 'assign-1' }]);
    await expect(
      repository.revokeAssignment(scope as never, 'assign-1', NOW),
    ).resolves.toBe(true);

    scope.run.mockResolvedValueOnce([]);
    await expect(
      repository.revokeAssignment(scope as never, 'assign-1', NOW),
    ).resolves.toBe(false);
  });

  it('lists active assignments for a user', async () => {
    scope.run.mockResolvedValue([assignmentRow(), assignmentRow({ id: 'a2' })]);

    const result = await repository.listActiveAssignmentsForUser(
      scope as never,
      'user-1',
    );

    expect(result).toHaveLength(2);
    expect(result[1]?.id).toBe('a2');
  });

  it('appends an audit event as jsonb', async () => {
    scope.run.mockResolvedValue([]);

    await repository.appendAuditEvent(scope as never, {
      id: 'event-1',
      eventType: 'rbac.roleAssigned',
      actorUserId: 'admin-1',
      context: { targetUserId: 'user-1', teamId: null },
      occurredAt: NOW,
    });

    expect(scope.run.mock.calls[0]?.[0]).toContain('security_events');
    expect(scope.run.mock.calls[0]?.[1]?.[3]).toBe(
      JSON.stringify({ targetUserId: 'user-1', teamId: null }),
    );
  });
});
