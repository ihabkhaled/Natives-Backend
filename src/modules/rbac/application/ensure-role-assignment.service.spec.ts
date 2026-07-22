import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RoleNotFoundError } from '../errors/role-not-found.error';
import type { RoleAssignment } from '../model/rbac.types';
import { EnsureRoleAssignmentService } from './ensure-role-assignment.service';

const NOW = new Date('2026-07-01T12:00:00.000Z');

const ROLE = { id: 'role-1', key: 'MEMBER' };

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
  const service = new EnsureRoleAssignmentService(
    idGenerator,
    repository as never,
  );
  return { scope, service, repository };
}

describe('EnsureRoleAssignmentService', () => {
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
