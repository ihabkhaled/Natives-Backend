import type { AuthUserIdentity } from '@core/auth';
import { Role } from '@shared/enums';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UserNotEligibleError } from '../errors/user-not-eligible.error';
import { RBAC_SUPER_ADMIN_PROMOTED_EVENT } from '../model/rbac.constants';
import type { SuperAdminEntry } from '../model/rbac.types';
import { PromoteSuperAdminUseCase } from './promote-super-admin.use-case';

const NOW = new Date('2026-07-01T12:00:00.000Z');

const ACTOR: AuthUserIdentity = {
  userId: 'root-1',
  email: 'root@example.test',
  roles: [Role.Admin],
};

const ENTRY: SuperAdminEntry = {
  assignmentId: 'assign-1',
  userId: 'user-9',
  email: 'promoted@example.test',
  displayName: 'Promoted',
  effectiveFrom: NOW,
  grantedBy: 'root-1',
};

const COMMAND = { userId: 'user-9', reason: 'Founding operator handover' };

function build() {
  const scope = { run: vi.fn() };
  const unitOfWork = {
    runInTransaction: vi.fn(async (op: (s: typeof scope) => Promise<unknown>) =>
      op(scope),
    ),
  };
  const clock = { now: vi.fn().mockReturnValue(NOW), uptime: vi.fn() };
  const idGenerator = { generate: vi.fn().mockReturnValue('generated-id') };
  const repository = {
    isUserActive: vi.fn().mockResolvedValue(true),
    findActiveGlobalAssignmentEntry: vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValue(ENTRY),
    findRoleByKey: vi.fn().mockResolvedValue({
      id: 'role-sa',
      key: 'SUPER_ADMIN',
      scope: 'platform',
      isAssignable: false,
    }),
    insertAssignment: vi.fn().mockResolvedValue({
      id: 'assign-1',
      userId: 'user-9',
      roleId: 'role-sa',
      roleKey: 'SUPER_ADMIN',
      teamId: null,
      seasonId: null,
      effectiveFrom: NOW,
      effectiveTo: null,
      grantedBy: 'root-1',
      revokedAt: null,
      createdAt: NOW,
      version: 1,
    }),
    bumpPolicyVersion: vi.fn(),
    appendAuditEvent: vi.fn(),
  };
  const useCase = new PromoteSuperAdminUseCase(
    unitOfWork as never,
    clock,
    idGenerator,
    repository as never,
  );
  return { useCase, repository, scope };
}

describe('PromoteSuperAdminUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('grants the global assignment, bumps the policy version, and audits the reason', async () => {
    const entry = await harness.useCase.execute(ACTOR, COMMAND);

    expect(entry).toEqual(ENTRY);
    expect(harness.repository.insertAssignment).toHaveBeenCalledWith(
      harness.scope,
      expect.objectContaining({
        userId: 'user-9',
        roleKey: 'SUPER_ADMIN',
        teamId: null,
        seasonId: null,
        effectiveTo: null,
        grantedBy: 'root-1',
      }),
    );
    expect(harness.repository.bumpPolicyVersion).toHaveBeenCalled();
    expect(harness.repository.appendAuditEvent).toHaveBeenCalledWith(
      harness.scope,
      expect.objectContaining({
        eventType: RBAC_SUPER_ADMIN_PROMOTED_EVENT,
        actorUserId: 'root-1',
        context: {
          assignmentId: 'assign-1',
          targetUserId: 'user-9',
          reason: COMMAND.reason,
          grantedBy: 'root-1',
        },
      }),
    );
  });

  it('is idempotent: an existing live holder is returned without a new grant', async () => {
    harness.repository.findActiveGlobalAssignmentEntry
      .mockReset()
      .mockResolvedValue(ENTRY);

    const entry = await harness.useCase.execute(ACTOR, COMMAND);

    expect(entry).toEqual(ENTRY);
    expect(harness.repository.insertAssignment).not.toHaveBeenCalled();
    expect(harness.repository.bumpPolicyVersion).not.toHaveBeenCalled();
    expect(harness.repository.appendAuditEvent).not.toHaveBeenCalled();
  });

  it('rejects a missing or inactive target before any write', async () => {
    harness.repository.isUserActive.mockResolvedValue(false);

    await expect(
      harness.useCase.execute(ACTOR, COMMAND),
    ).rejects.toBeInstanceOf(UserNotEligibleError);
    expect(harness.repository.insertAssignment).not.toHaveBeenCalled();
    expect(harness.repository.appendAuditEvent).not.toHaveBeenCalled();
  });
});
