import type { AuthUserIdentity } from '@core/auth';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TeamRoleQueryService } from './team-role-query.service';

const ACTOR: AuthUserIdentity = {
  userId: 'actor-1',
  email: 'admin@example.test',
  roles: [],
};

const CATALOG = [
  { role_key: 'MEMBER', permission_key: 'team.read' },
  { role_key: 'COACH', permission_key: 'team.read' },
  { role_key: 'COACH', permission_key: 'practice.manage' },
];

function build() {
  const scope = { run: vi.fn() };
  const unitOfWork = {
    runInTransaction: vi.fn(async (op: (s: typeof scope) => Promise<unknown>) =>
      op(scope),
    ),
  };
  const repository = {
    listActiveTeamAssignments: vi.fn().mockResolvedValue([]),
    listRoleCatalog: vi.fn().mockResolvedValue(CATALOG),
  };
  const ceiling = {
    resolveActorPermissions: vi.fn().mockResolvedValue(new Set(['team.read'])),
  };
  const service = new TeamRoleQueryService(
    unitOfWork as never,
    repository as never,
    ceiling as never,
  );
  return { ceiling, repository, scope, service };
}

describe('TeamRoleQueryService', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('returns the held slugs sorted and de-duplicated', async () => {
    harness.repository.listActiveTeamAssignments.mockResolvedValue([
      { roleKey: 'TEAM_ADMIN' },
      { roleKey: 'MEMBER' },
      { roleKey: 'MEMBER' },
    ]);

    const view = await harness.service.view(ACTOR, 'user-1', 'team-1');

    expect(view.roles).toEqual(['member', 'team_admin']);
    expect(harness.repository.listActiveTeamAssignments).toHaveBeenCalledWith(
      harness.scope,
      'user-1',
      'team-1',
    );
  });

  it('offers only the bundles inside the actor privilege ceiling', async () => {
    const view = await harness.service.view(ACTOR, 'user-1', 'team-1');

    expect(view.assignableRoles).toEqual(['member']);
    expect(harness.ceiling.resolveActorPermissions).toHaveBeenCalledWith(
      harness.scope,
      ACTOR,
      { teamId: 'team-1' },
    );
  });

  it('widens the ceiling as the actor permissions widen', async () => {
    harness.ceiling.resolveActorPermissions.mockResolvedValue(
      new Set(['team.read', 'practice.manage']),
    );

    const view = await harness.service.view(ACTOR, 'user-1', 'team-1');

    expect(view.assignableRoles).toEqual(['coach', 'member']);
  });

  it('reports no held roles for a membership with no linked account', async () => {
    const view = await harness.service.view(ACTOR, null, 'team-1');

    expect(view.roles).toEqual([]);
    expect(harness.repository.listActiveTeamAssignments).not.toHaveBeenCalled();
  });
});
