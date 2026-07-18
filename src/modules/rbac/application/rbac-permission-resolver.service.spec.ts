import type { AuthUserIdentity } from '@core/auth';
import { Permission, Role } from '@shared/enums';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GrantEffect } from '../model/rbac.enums';
import type { PermissionGrant } from '../model/rbac.types';
import { RbacPermissionResolverService } from './rbac-permission-resolver.service';

const NOW = new Date('2026-06-01T12:00:00.000Z');
const PAST = new Date('2026-01-01T00:00:00.000Z');

const PRINCIPAL: AuthUserIdentity = {
  userId: 'user-1',
  email: 'user@example.com',
  roles: [Role.User],
};

const SCOPED_GRANT: PermissionGrant = {
  permission: Permission.MatchScore,
  effect: GrantEffect.Allow,
  teamId: 'team-1',
  seasonId: null,
  effectiveFrom: PAST,
  effectiveTo: null,
};

function build() {
  const scopeStub = {};
  const clock = { now: vi.fn().mockReturnValue(NOW), uptime: vi.fn() };
  const unitOfWork = {
    runInTransaction: vi.fn(
      async (op: (s: typeof scopeStub) => Promise<unknown>) => op(scopeStub),
    ),
  };
  const repository = {
    isUserActive: vi.fn().mockResolvedValue(true),
    currentPolicyVersion: vi.fn().mockResolvedValue(1),
    loadAssignmentGrants: vi.fn().mockResolvedValue([SCOPED_GRANT]),
  };
  const logger = {
    setContext: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
  const service = new RbacPermissionResolverService(
    clock,
    unitOfWork as never,
    repository as never,
    logger as never,
  );
  return { service, clock, unitOfWork, repository, logger };
}

describe('RbacPermissionResolverService', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('unions the account-role baseline with scoped database grants', async () => {
    const granted = await harness.service.resolve(PRINCIPAL, {
      teamId: 'team-1',
    });

    expect(granted.has(Permission.TeamRead)).toBe(true); // baseline (MEMBER)
    expect(granted.has(Permission.MatchScore)).toBe(true); // scoped grant
  });

  it('excludes scoped grants outside the requested scope', async () => {
    const granted = await harness.service.resolve(PRINCIPAL, {
      teamId: 'team-2',
    });

    expect(granted.has(Permission.MatchScore)).toBe(false);
  });

  it('caches raw grants and only reloads when the policy version changes', async () => {
    await harness.service.resolve(PRINCIPAL, { teamId: 'team-1' });
    await harness.service.resolve(PRINCIPAL, { teamId: 'team-1' });

    expect(harness.repository.currentPolicyVersion).toHaveBeenCalledTimes(2);
    expect(harness.repository.loadAssignmentGrants).toHaveBeenCalledTimes(1);
  });

  it('invalidates the cache when the policy version is bumped', async () => {
    await harness.service.resolve(PRINCIPAL, { teamId: 'team-1' });
    harness.repository.currentPolicyVersion.mockResolvedValue(2);

    await harness.service.resolve(PRINCIPAL, { teamId: 'team-1' });

    expect(harness.repository.loadAssignmentGrants).toHaveBeenCalledTimes(2);
  });

  it('denies all permissions for an inactive principal', async () => {
    harness.repository.isUserActive.mockResolvedValue(false);

    const granted = await harness.service.resolve(PRINCIPAL, {
      teamId: 'team-1',
    });

    expect(granted.size).toBe(0);
  });

  it('degrades to the baseline when the policy store is unreachable', async () => {
    harness.unitOfWork.runInTransaction.mockRejectedValue(new Error('down'));

    const granted = await harness.service.resolve(PRINCIPAL, {
      teamId: 'team-1',
    });

    expect(granted.has(Permission.TeamRead)).toBe(true);
    expect(granted.has(Permission.MatchScore)).toBe(false);
    expect(harness.logger.debug).toHaveBeenCalled();
  });
});
