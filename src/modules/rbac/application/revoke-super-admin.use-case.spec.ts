import type { AuthUserIdentity } from '@core/auth';
import { Role } from '@shared/enums';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AssignmentNotFoundError } from '../errors/assignment-not-found.error';
import { LastSuperAdminError } from '../errors/last-super-admin.error';
import { RBAC_SUPER_ADMIN_REVOKED_EVENT } from '../model/rbac.constants';
import type { SuperAdminEntry } from '../model/rbac.types';
import { RevokeSuperAdminUseCase } from './revoke-super-admin.use-case';

const NOW = new Date('2026-07-01T12:00:00.000Z');

const ACTOR: AuthUserIdentity = {
  userId: 'root-1',
  email: 'root@example.test',
  roles: [Role.Admin],
};

const ENTRY: SuperAdminEntry = {
  assignmentId: 'assign-9',
  userId: 'user-9',
  email: 'demoted@example.test',
  displayName: null,
  effectiveFrom: NOW,
  grantedBy: 'root-1',
};

const REASON = 'Left the organization';

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
    findActiveGlobalAssignmentEntry: vi.fn().mockResolvedValue(ENTRY),
    countActiveGlobalAssignments: vi.fn().mockResolvedValue(2),
    revokeAssignment: vi.fn().mockResolvedValue(true),
    bumpPolicyVersion: vi.fn(),
    appendAuditEvent: vi.fn(),
  };
  const useCase = new RevokeSuperAdminUseCase(
    unitOfWork as never,
    clock,
    idGenerator,
    repository as never,
  );
  return { useCase, repository, scope };
}

describe('RevokeSuperAdminUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('revokes the live global assignment, bumps the version, and audits the reason', async () => {
    const entry = await harness.useCase.execute(ACTOR, 'user-9', REASON);

    expect(entry).toEqual(ENTRY);
    expect(harness.repository.revokeAssignment).toHaveBeenCalledWith(
      harness.scope,
      'assign-9',
      NOW,
    );
    expect(harness.repository.bumpPolicyVersion).toHaveBeenCalled();
    expect(harness.repository.appendAuditEvent).toHaveBeenCalledWith(
      harness.scope,
      expect.objectContaining({
        eventType: RBAC_SUPER_ADMIN_REVOKED_EVENT,
        actorUserId: 'root-1',
        context: {
          assignmentId: 'assign-9',
          targetUserId: 'user-9',
          reason: REASON,
          revokedBy: 'root-1',
        },
      }),
    );
  });

  it('is a 404 when the target holds no live global assignment', async () => {
    harness.repository.findActiveGlobalAssignmentEntry.mockResolvedValue(null);

    await expect(
      harness.useCase.execute(ACTOR, 'user-9', REASON),
    ).rejects.toBeInstanceOf(AssignmentNotFoundError);
    expect(harness.repository.revokeAssignment).not.toHaveBeenCalled();
  });

  it('refuses to remove the last super administrator and writes nothing', async () => {
    harness.repository.countActiveGlobalAssignments.mockResolvedValue(1);

    await expect(
      harness.useCase.execute(ACTOR, 'user-9', REASON),
    ).rejects.toBeInstanceOf(LastSuperAdminError);
    expect(harness.repository.revokeAssignment).not.toHaveBeenCalled();
    expect(harness.repository.bumpPolicyVersion).not.toHaveBeenCalled();
    expect(harness.repository.appendAuditEvent).not.toHaveBeenCalled();
  });

  it('covers self-demotion of the last admin through the same live count', async () => {
    harness.repository.findActiveGlobalAssignmentEntry.mockResolvedValue({
      ...ENTRY,
      userId: ACTOR.userId,
    });
    harness.repository.countActiveGlobalAssignments.mockResolvedValue(1);

    await expect(
      harness.useCase.execute(ACTOR, ACTOR.userId, REASON),
    ).rejects.toBeInstanceOf(LastSuperAdminError);
  });
});
