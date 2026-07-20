import type { AuthUserIdentity } from '@core/auth';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MemberAccountRequiredError } from '../errors/member-account-required.error';
import { ReplaceMemberRolesUseCase } from './replace-member-roles.use-case';

const ACTOR: AuthUserIdentity = {
  userId: 'actor-1',
  email: 'admin@example.test',
  roles: [],
};

const VIEW = {
  membershipId: 'membership-1',
  roles: ['coach'],
  assignableRoles: ['coach', 'member'],
};

function build() {
  const roles = {
    resolveUserId: vi.fn().mockResolvedValue('user-1'),
    view: vi.fn().mockResolvedValue(VIEW),
  };
  const replaceTeamRoles = { execute: vi.fn().mockResolvedValue(['COACH']) };
  const useCase = new ReplaceMemberRolesUseCase(
    roles as never,
    replaceTeamRoles as never,
  );
  return { replaceTeamRoles, roles, useCase };
}

describe('ReplaceMemberRolesUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('delegates the reconciliation to RBAC and returns the fresh view', async () => {
    const result = await harness.useCase.execute(
      ACTOR,
      'team-1',
      'membership-1',
      ['coach'],
    );

    expect(harness.replaceTeamRoles.execute).toHaveBeenCalledWith(ACTOR, {
      userId: 'user-1',
      teamId: 'team-1',
      roleKeys: ['coach'],
    });
    expect(result).toBe(VIEW);
  });

  it('refuses to assign roles to a membership with no account', async () => {
    harness.roles.resolveUserId.mockResolvedValue(null);

    await expect(
      harness.useCase.execute(ACTOR, 'team-1', 'membership-1', ['coach']),
    ).rejects.toBeInstanceOf(MemberAccountRequiredError);
    expect(harness.replaceTeamRoles.execute).not.toHaveBeenCalled();
  });
});
