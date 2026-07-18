import type { AuthUserIdentity } from '@core/auth';
import { Role } from '@shared/enums';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AssignmentNotFoundError } from '../errors/assignment-not-found.error';
import { EscalationDeniedError } from '../errors/escalation-denied.error';
import { RBAC_ROLE_REVOKED_EVENT } from '../model/rbac.constants';
import type { RoleAssignment } from '../model/rbac.types';
import { RevokeRoleAssignmentUseCase } from './revoke-role-assignment.use-case';

const NOW = new Date('2026-06-01T12:00:00.000Z');

const ACTOR: AuthUserIdentity = {
  userId: 'admin-1',
  email: 'admin@example.com',
  roles: [Role.Admin],
};

const EXISTING: RoleAssignment = {
  id: 'assign-1',
  userId: 'user-1',
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

function build() {
  const scopeStub = {};
  const unitOfWork = {
    runInTransaction: vi.fn(
      async (op: (s: typeof scopeStub) => Promise<unknown>) => op(scopeStub),
    ),
  };
  const clock = { now: vi.fn().mockReturnValue(NOW), uptime: vi.fn() };
  const idGenerator = { generate: vi.fn().mockReturnValue('generated-id') };
  const repository = {
    findActiveAssignmentById: vi.fn().mockResolvedValue(EXISTING),
    revokeAssignment: vi.fn().mockResolvedValue(true),
    bumpPolicyVersion: vi.fn(),
    appendAuditEvent: vi.fn(),
  };
  const ceiling = { assertCanManageRole: vi.fn().mockResolvedValue(undefined) };
  const useCase = new RevokeRoleAssignmentUseCase(
    unitOfWork as never,
    clock,
    idGenerator,
    repository as never,
    ceiling as never,
  );
  return { useCase, repository, ceiling };
}

describe('RevokeRoleAssignmentUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('revokes the assignment, bumps the version, and audits', async () => {
    const result = await harness.useCase.execute(ACTOR, 'assign-1');

    expect(result.revokedAt).toEqual(NOW);
    expect(harness.repository.revokeAssignment).toHaveBeenCalledWith(
      expect.anything(),
      'assign-1',
      NOW,
    );
    expect(harness.repository.appendAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: RBAC_ROLE_REVOKED_EVENT }),
    );
  });

  it('throws when the assignment does not exist', async () => {
    harness.repository.findActiveAssignmentById.mockResolvedValue(null);

    await expect(
      harness.useCase.execute(ACTOR, 'missing'),
    ).rejects.toBeInstanceOf(AssignmentNotFoundError);
    expect(harness.repository.revokeAssignment).not.toHaveBeenCalled();
  });

  it('does not revoke when the privilege ceiling is exceeded', async () => {
    harness.ceiling.assertCanManageRole.mockRejectedValue(
      new EscalationDeniedError(),
    );

    await expect(
      harness.useCase.execute(ACTOR, 'assign-1'),
    ).rejects.toBeInstanceOf(EscalationDeniedError);
    expect(harness.repository.revokeAssignment).not.toHaveBeenCalled();
  });
});
