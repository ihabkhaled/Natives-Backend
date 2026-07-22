import type { AuthUserIdentity } from '@core/auth';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EscalationDeniedError } from '../errors/escalation-denied.error';
import { ProtectedRoleError } from '../errors/protected-role.error';
import { RoleNotFoundError } from '../errors/role-not-found.error';
import {
  RBAC_ROLE_ASSIGNED_EVENT,
  RBAC_ROLE_REVOKED_EVENT,
} from '../model/rbac.constants';
import type { RoleAssignment } from '../model/rbac.types';
import { ReplaceTeamRolesUseCase } from './replace-team-roles.use-case';

const NOW = new Date('2026-07-20T12:00:00.000Z');

const ACTOR: AuthUserIdentity = {
  userId: 'actor-1',
  email: 'admin@example.test',
  roles: [],
};

function assignment(roleKey: string, id = `a-${roleKey}`): RoleAssignment {
  return {
    id,
    userId: 'user-1',
    roleId: `role-${roleKey}`,
    roleKey,
    teamId: 'team-1',
    seasonId: null,
    effectiveFrom: NOW,
    effectiveTo: null,
    grantedBy: null,
    revokedAt: null,
    createdAt: NOW,
    version: 1,
  };
}

function build() {
  const scope = { run: vi.fn() };
  const unitOfWork = {
    runInTransaction: vi.fn(async (op: (s: typeof scope) => Promise<unknown>) =>
      op(scope),
    ),
  };
  const clock = { now: vi.fn().mockReturnValue(NOW), uptime: vi.fn() };
  let sequence = 0;
  const idGenerator = {
    generate: vi.fn(() => {
      sequence += 1;
      return `generated-${sequence}`;
    }),
  };
  const repository = {
    listActiveTeamAssignments: vi.fn().mockResolvedValue([]),
    findRoleByKey: vi.fn().mockImplementation((_scope: unknown, key: string) =>
      Promise.resolve({
        id: `role-${key}`,
        key,
        scope: key === 'SUPER_ADMIN' ? 'platform' : 'team',
        isAssignable: key !== 'SUPER_ADMIN',
      }),
    ),
    insertAssignment: vi
      .fn()
      .mockImplementation((_scope: unknown, draft: RoleAssignment) =>
        Promise.resolve({ ...assignment(draft.roleKey), id: draft.id }),
      ),
    revokeAssignment: vi.fn().mockResolvedValue(true),
    bumpPolicyVersion: vi.fn(),
    appendAuditEvent: vi.fn(),
  };
  const ceiling = { assertCanManageRole: vi.fn() };
  const useCase = new ReplaceTeamRolesUseCase(
    unitOfWork as never,
    clock,
    idGenerator,
    repository as never,
    ceiling as never,
  );
  return { ceiling, repository, scope, useCase };
}

function command(roleKeys: readonly string[]) {
  return { userId: 'user-1', teamId: 'team-1', roleKeys };
}

describe('ReplaceTeamRolesUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('grants a missing role, audits it, and bumps the policy version', async () => {
    const result = await harness.useCase.execute(ACTOR, command(['coach']));

    expect(result).toEqual(['COACH']);
    expect(harness.repository.insertAssignment).toHaveBeenCalledTimes(1);
    expect(harness.repository.bumpPolicyVersion).toHaveBeenCalledTimes(1);
    expect(harness.repository.appendAuditEvent).toHaveBeenCalledWith(
      harness.scope,
      expect.objectContaining({ eventType: RBAC_ROLE_ASSIGNED_EVENT }),
    );
  });

  it('revokes a role that is no longer requested', async () => {
    harness.repository.listActiveTeamAssignments.mockResolvedValue([
      assignment('COACH'),
    ]);

    await harness.useCase.execute(ACTOR, command([]));

    expect(harness.repository.revokeAssignment).toHaveBeenCalledWith(
      harness.scope,
      'a-COACH',
      NOW,
    );
    expect(harness.repository.appendAuditEvent).toHaveBeenCalledWith(
      harness.scope,
      expect.objectContaining({ eventType: RBAC_ROLE_REVOKED_EVENT }),
    );
  });

  it('leaves an already-held role untouched', async () => {
    harness.repository.listActiveTeamAssignments.mockResolvedValue([
      assignment('MEMBER'),
    ]);

    await harness.useCase.execute(ACTOR, command(['member']));

    expect(harness.repository.insertAssignment).not.toHaveBeenCalled();
    expect(harness.repository.revokeAssignment).not.toHaveBeenCalled();
  });

  it('checks the privilege ceiling for every grant and every revoke', async () => {
    harness.repository.listActiveTeamAssignments.mockResolvedValue([
      assignment('ANALYST'),
    ]);

    await harness.useCase.execute(ACTOR, command(['coach']));

    expect(harness.ceiling.assertCanManageRole).toHaveBeenCalledWith(
      harness.scope,
      ACTOR,
      'role-COACH',
      { teamId: 'team-1' },
    );
    expect(harness.ceiling.assertCanManageRole).toHaveBeenCalledWith(
      harness.scope,
      ACTOR,
      'role-ANALYST',
      { teamId: 'team-1' },
    );
  });

  it('propagates the escalation denial and writes nothing', async () => {
    harness.ceiling.assertCanManageRole.mockRejectedValue(
      new EscalationDeniedError(),
    );

    await expect(
      harness.useCase.execute(ACTOR, command(['team_admin'])),
    ).rejects.toBeInstanceOf(EscalationDeniedError);
    expect(harness.repository.insertAssignment).not.toHaveBeenCalled();
    expect(harness.repository.bumpPolicyVersion).not.toHaveBeenCalled();
  });

  it('rejects a slug outside the seeded catalog', async () => {
    await expect(
      harness.useCase.execute(ACTOR, command(['superuser'])),
    ).rejects.toBeInstanceOf(RoleNotFoundError);
  });

  it('rejects a catalog key with no row behind it', async () => {
    harness.repository.findRoleByKey.mockResolvedValue(null);

    await expect(
      harness.useCase.execute(ACTOR, command(['coach'])),
    ).rejects.toBeInstanceOf(RoleNotFoundError);
  });

  it('refuses a protected role before the ceiling and writes nothing', async () => {
    await expect(
      harness.useCase.execute(ACTOR, command(['super_admin'])),
    ).rejects.toBeInstanceOf(ProtectedRoleError);
    expect(harness.ceiling.assertCanManageRole).not.toHaveBeenCalled();
    expect(harness.repository.insertAssignment).not.toHaveBeenCalled();
    expect(harness.repository.bumpPolicyVersion).not.toHaveBeenCalled();
  });
});
