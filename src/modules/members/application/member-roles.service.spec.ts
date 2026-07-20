import type { AuthUserIdentity } from '@core/auth';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MembershipNotFoundError } from '../errors/membership-not-found.error';
import { MemberRolesService } from './member-roles.service';

const ACTOR: AuthUserIdentity = {
  userId: 'actor-1',
  email: 'admin@example.test',
  roles: [],
};

function build() {
  const scope = { run: vi.fn() };
  const unitOfWork = {
    runInTransaction: vi.fn(async (op: (s: typeof scope) => Promise<unknown>) =>
      op(scope),
    ),
  };
  const lookup = {
    requireMembership: vi.fn().mockResolvedValue({ userId: 'user-1' }),
  };
  const teamRoles = {
    view: vi
      .fn()
      .mockResolvedValue({ roles: ['member'], assignableRoles: ['member'] }),
  };
  const service = new MemberRolesService(
    unitOfWork as never,
    lookup as never,
    teamRoles as never,
  );
  return { lookup, scope, service, teamRoles };
}

describe('MemberRolesService', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('resolves the membership in team scope before reading roles', async () => {
    const view = await harness.service.view(ACTOR, 'team-1', 'membership-1');

    expect(harness.lookup.requireMembership).toHaveBeenCalledWith(
      harness.scope,
      'team-1',
      'membership-1',
    );
    expect(harness.teamRoles.view).toHaveBeenCalledWith(
      ACTOR,
      'user-1',
      'team-1',
    );
    expect(view).toEqual({
      membershipId: 'membership-1',
      roles: ['member'],
      assignableRoles: ['member'],
    });
  });

  it('reads a membership with no linked account as holding nothing', async () => {
    harness.lookup.requireMembership.mockResolvedValue({ userId: null });
    harness.teamRoles.view.mockResolvedValue({
      roles: [],
      assignableRoles: ['member'],
    });

    const view = await harness.service.view(ACTOR, 'team-1', 'membership-1');

    expect(harness.teamRoles.view).toHaveBeenCalledWith(ACTOR, null, 'team-1');
    expect(view.roles).toEqual([]);
  });

  it('never leaks a member addressed under the wrong team', async () => {
    harness.lookup.requireMembership.mockRejectedValue(
      new MembershipNotFoundError(),
    );

    await expect(
      harness.service.view(ACTOR, 'other-team', 'membership-1'),
    ).rejects.toBeInstanceOf(MembershipNotFoundError);
  });
});
