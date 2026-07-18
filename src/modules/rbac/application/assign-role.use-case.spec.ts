import type { AuthUserIdentity } from '@core/auth';
import { Role } from '@shared/enums';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EscalationDeniedError } from '../errors/escalation-denied.error';
import { RoleNotFoundError } from '../errors/role-not-found.error';
import { RBAC_ROLE_ASSIGNED_EVENT } from '../model/rbac.constants';
import type { AssignRoleCommand, RoleAssignment } from '../model/rbac.types';
import { AssignRoleUseCase } from './assign-role.use-case';

const NOW = new Date('2026-06-01T12:00:00.000Z');

const ACTOR: AuthUserIdentity = {
  userId: 'admin-1',
  email: 'admin@example.com',
  roles: [Role.Admin],
};

const COMMAND: AssignRoleCommand = {
  userId: 'user-1',
  roleKey: 'MEMBER',
  teamId: 'team-1',
  seasonId: null,
  effectiveTo: null,
};

const ASSIGNMENT: RoleAssignment = {
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
    findRoleByKey: vi.fn().mockResolvedValue({ id: 'role-1', key: 'MEMBER' }),
    insertAssignment: vi.fn().mockResolvedValue(ASSIGNMENT),
    bumpPolicyVersion: vi.fn(),
    appendAuditEvent: vi.fn(),
  };
  const ceiling = { assertCanManageRole: vi.fn().mockResolvedValue(undefined) };
  const useCase = new AssignRoleUseCase(
    unitOfWork as never,
    clock,
    idGenerator,
    repository as never,
    ceiling as never,
  );
  return { useCase, repository, ceiling };
}

describe('AssignRoleUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('assigns the role, bumps the policy version, and audits', async () => {
    const result = await harness.useCase.execute(ACTOR, COMMAND);

    expect(result).toBe(ASSIGNMENT);
    expect(harness.repository.bumpPolicyVersion).toHaveBeenCalled();
    expect(harness.repository.appendAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: RBAC_ROLE_ASSIGNED_EVENT }),
    );
  });

  it('throws when the role does not exist', async () => {
    harness.repository.findRoleByKey.mockResolvedValue(null);

    await expect(
      harness.useCase.execute(ACTOR, COMMAND),
    ).rejects.toBeInstanceOf(RoleNotFoundError);
    expect(harness.repository.insertAssignment).not.toHaveBeenCalled();
  });

  it('does not assign when the privilege ceiling is exceeded', async () => {
    harness.ceiling.assertCanManageRole.mockRejectedValue(
      new EscalationDeniedError(),
    );

    await expect(
      harness.useCase.execute(ACTOR, COMMAND),
    ).rejects.toBeInstanceOf(EscalationDeniedError);
    expect(harness.repository.insertAssignment).not.toHaveBeenCalled();
    expect(harness.repository.bumpPolicyVersion).not.toHaveBeenCalled();
  });
});
