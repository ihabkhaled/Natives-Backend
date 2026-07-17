import type { AuthUserIdentity } from '@core/auth';
import { Permission, Role } from '@shared/enums';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EscalationDeniedError } from '../errors/escalation-denied.error';
import { GrantEffect } from '../model/rbac.enums';
import type { PermissionGrant } from '../model/rbac.types';
import { PrivilegeCeilingService } from './privilege-ceiling.service';

const NOW = new Date('2026-06-01T12:00:00.000Z');
const PAST = new Date('2026-01-01T00:00:00.000Z');
const SCOPE_STUB = {};

function build() {
  const clock = { now: vi.fn().mockReturnValue(NOW), uptime: vi.fn() };
  const repository = {
    loadRolePermissions: vi.fn(),
    loadAssignmentGrants: vi.fn().mockResolvedValue([]),
  };
  const service = new PrivilegeCeilingService(clock, repository as never);
  return { service, repository };
}

function admin(): AuthUserIdentity {
  return { userId: 'admin-1', email: 'a@example.com', roles: [Role.Admin] };
}

function member(): AuthUserIdentity {
  return { userId: 'coach-1', email: 'c@example.com', roles: [Role.User] };
}

describe('PrivilegeCeilingService', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('allows an actor whose baseline covers the target role', async () => {
    harness.repository.loadRolePermissions.mockResolvedValue([
      Permission.MemberRolesManage,
    ]);

    await expect(
      harness.service.assertCanManageRole(
        SCOPE_STUB as never,
        admin(),
        'role-1',
        {},
      ),
    ).resolves.toBeUndefined();
  });

  it('rejects an actor who lacks a target permission (escalation)', async () => {
    harness.repository.loadRolePermissions.mockResolvedValue([
      Permission.MemberRolesManage,
    ]);

    await expect(
      harness.service.assertCanManageRole(
        SCOPE_STUB as never,
        member(),
        'role-1',
        {},
      ),
    ).rejects.toBeInstanceOf(EscalationDeniedError);
  });

  it('counts scoped database grants toward the actor ceiling', async () => {
    harness.repository.loadRolePermissions.mockResolvedValue([
      Permission.MemberRolesManage,
    ]);
    const grant: PermissionGrant = {
      permission: Permission.MemberRolesManage,
      effect: GrantEffect.Allow,
      teamId: 'team-1',
      seasonId: null,
      effectiveFrom: PAST,
      effectiveTo: null,
    };
    harness.repository.loadAssignmentGrants.mockResolvedValue([grant]);

    await expect(
      harness.service.assertCanManageRole(
        SCOPE_STUB as never,
        { userId: 'u', email: 'e@example.com', roles: [] },
        'role-1',
        { teamId: 'team-1' },
      ),
    ).resolves.toBeUndefined();
  });
});
