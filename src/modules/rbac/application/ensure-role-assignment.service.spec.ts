import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EscalationDeniedError } from '../errors/escalation-denied.error';
import { ProtectedRoleError } from '../errors/protected-role.error';
import { RoleNotFoundError } from '../errors/role-not-found.error';
import type { RoleAssignment } from '../model/rbac.types';
import { EnsureRoleAssignmentService } from './ensure-role-assignment.service';

const NOW = new Date('2026-07-01T12:00:00.000Z');

const ROLE = { id: 'role-1', key: 'MEMBER', scope: 'team', isAssignable: true };

const ACTOR = {
  userId: 'admin-1',
  email: 'admin@example.test',
  roles: ['user'],
};

const ASSIGNMENT: RoleAssignment = {
  id: 'assign-1',
  userId: 'user-9',
  roleId: 'role-1',
  roleKey: 'MEMBER',
  teamId: 'team-1',
  seasonId: null,
  effectiveFrom: NOW,
  effectiveTo: null,
  grantedBy: 'admin-1',
  revokedAt: null,
  createdAt: NOW,
  version: 1,
};

const COMMAND = {
  userId: 'user-9',
  roleKey: 'MEMBER',
  teamId: 'team-1',
  grantedBy: 'admin-1',
  now: NOW,
};

function build() {
  const scope = { run: vi.fn() };
  const idGenerator = { generate: vi.fn().mockReturnValue('generated-id') };
  const repository = {
    findRoleByKey: vi.fn().mockResolvedValue(ROLE),
    findActiveAssignmentByScope: vi.fn().mockResolvedValue(null),
    insertAssignment: vi.fn().mockResolvedValue(ASSIGNMENT),
    bumpPolicyVersion: vi.fn(),
    appendAuditEvent: vi.fn(),
  };
  const ceiling = { assertCanManageRole: vi.fn().mockResolvedValue(undefined) };
  const service = new EnsureRoleAssignmentService(
    idGenerator,
    repository as never,
    ceiling as never,
  );
  return { scope, service, repository, ceiling };
}

describe('EnsureRoleAssignmentService.ensureTeamRole', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('grants the role, bumps the policy version, and audits the grant', async () => {
    await harness.service.ensureTeamRole(harness.scope as never, COMMAND);

    expect(harness.repository.insertAssignment).toHaveBeenCalledWith(
      harness.scope,
      expect.objectContaining({
        userId: 'user-9',
        roleId: 'role-1',
        roleKey: 'MEMBER',
        teamId: 'team-1',
        seasonId: null,
        effectiveFrom: NOW,
        grantedBy: 'admin-1',
      }),
    );
    expect(harness.repository.bumpPolicyVersion).toHaveBeenCalledWith(
      harness.scope,
      NOW,
    );
    expect(harness.repository.appendAuditEvent).toHaveBeenCalledWith(
      harness.scope,
      expect.objectContaining({
        eventType: 'rbac.roleAssigned',
        actorUserId: 'admin-1',
        context: expect.objectContaining({
          assignmentId: 'assign-1',
          targetUserId: 'user-9',
          roleKey: 'MEMBER',
          teamId: 'team-1',
        }),
      }),
    );
  });

  it('is idempotent: an existing live assignment writes nothing', async () => {
    harness.repository.findActiveAssignmentByScope.mockResolvedValue(
      ASSIGNMENT,
    );

    await harness.service.ensureTeamRole(harness.scope as never, COMMAND);

    expect(harness.repository.insertAssignment).not.toHaveBeenCalled();
    expect(harness.repository.bumpPolicyVersion).not.toHaveBeenCalled();
    expect(harness.repository.appendAuditEvent).not.toHaveBeenCalled();
  });

  it('checks the exact assignment natural key (user, role, team, season NULL)', async () => {
    await harness.service.ensureTeamRole(harness.scope as never, COMMAND);

    expect(harness.repository.findActiveAssignmentByScope).toHaveBeenCalledWith(
      harness.scope,
      'user-9',
      'role-1',
      'team-1',
      null,
    );
  });

  it('throws when the role key is unknown and writes nothing', async () => {
    harness.repository.findRoleByKey.mockResolvedValue(null);

    await expect(
      harness.service.ensureTeamRole(harness.scope as never, COMMAND),
    ).rejects.toBeInstanceOf(RoleNotFoundError);
    expect(harness.repository.insertAssignment).not.toHaveBeenCalled();
  });

  it('refuses a role that became protected between invite and accept', async () => {
    harness.repository.findRoleByKey.mockResolvedValue({
      ...ROLE,
      isAssignable: false,
    });

    await expect(
      harness.service.ensureTeamRole(harness.scope as never, COMMAND),
    ).rejects.toBeInstanceOf(ProtectedRoleError);
    expect(harness.repository.insertAssignment).not.toHaveBeenCalled();
  });

  it('carries a null grantedBy provenance through insert and audit', async () => {
    await harness.service.ensureTeamRole(harness.scope as never, {
      ...COMMAND,
      grantedBy: null,
    });

    expect(harness.repository.insertAssignment).toHaveBeenCalledWith(
      harness.scope,
      expect.objectContaining({ grantedBy: null }),
    );
    expect(harness.repository.appendAuditEvent).toHaveBeenCalledWith(
      harness.scope,
      expect.objectContaining({ actorUserId: null }),
    );
  });
});

describe('EnsureRoleAssignmentService.assertGrantable', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('resolves the slug against the open catalog and returns the record', async () => {
    const role = await harness.service.assertGrantable(
      harness.scope as never,
      ACTOR as never,
      'member',
      'team-1',
    );

    expect(harness.repository.findRoleByKey).toHaveBeenCalledWith(
      harness.scope,
      'MEMBER',
    );
    expect(role).toEqual(ROLE);
  });

  it('throws RoleNotFoundError for a slug outside the catalog', async () => {
    harness.repository.findRoleByKey.mockResolvedValue(null);

    await expect(
      harness.service.assertGrantable(
        harness.scope as never,
        ACTOR as never,
        'physio',
        'team-1',
      ),
    ).rejects.toBeInstanceOf(RoleNotFoundError);
    expect(harness.ceiling.assertCanManageRole).not.toHaveBeenCalled();
  });

  it('throws ProtectedRoleError for a platform-scoped role before the ceiling', async () => {
    harness.repository.findRoleByKey.mockResolvedValue({
      id: 'role-sa',
      key: 'SUPER_ADMIN',
      scope: 'platform',
      isAssignable: false,
    });

    await expect(
      harness.service.assertGrantable(
        harness.scope as never,
        ACTOR as never,
        'super_admin',
        'team-1',
      ),
    ).rejects.toBeInstanceOf(ProtectedRoleError);
    expect(harness.ceiling.assertCanManageRole).not.toHaveBeenCalled();
  });

  it('delegates the ceiling to the privilege-ceiling service in team scope', async () => {
    await harness.service.assertGrantable(
      harness.scope as never,
      ACTOR as never,
      'member',
      'team-1',
    );

    expect(harness.ceiling.assertCanManageRole).toHaveBeenCalledWith(
      harness.scope,
      ACTOR,
      'role-1',
      { teamId: 'team-1' },
    );
  });

  it('propagates an escalation denial from the ceiling', async () => {
    harness.ceiling.assertCanManageRole.mockRejectedValue(
      new EscalationDeniedError(),
    );

    await expect(
      harness.service.assertGrantable(
        harness.scope as never,
        ACTOR as never,
        'member',
        'team-1',
      ),
    ).rejects.toBeInstanceOf(EscalationDeniedError);
  });

  it('resolves a null team id to the global scope for the ceiling', async () => {
    await harness.service.assertGrantable(
      harness.scope as never,
      ACTOR as never,
      'member',
      null,
    );

    expect(harness.ceiling.assertCanManageRole).toHaveBeenCalledWith(
      harness.scope,
      ACTOR,
      'role-1',
      {},
    );
  });
});
