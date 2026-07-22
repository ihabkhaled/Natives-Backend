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

const DEFINITIONS = [
  {
    key: 'COACH',
    display_name: 'Coach',
    description: 'Runs practices',
    is_system: true,
    scope: 'team',
    is_assignable: true,
  },
  {
    key: 'MEMBER',
    display_name: 'Member',
    description: 'Baseline team member',
    is_system: true,
    scope: 'team',
    is_assignable: true,
  },
  {
    key: 'SUPER_ADMIN',
    display_name: 'Super administrator',
    description: 'Platform-wide',
    is_system: true,
    scope: 'platform',
    is_assignable: false,
  },
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
    listRoleDefinitions: vi.fn().mockResolvedValue(DEFINITIONS),
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

  it('joins the ceiling projection with catalog display metadata', async () => {
    harness.ceiling.resolveActorPermissions.mockResolvedValue(
      new Set(['team.read', 'practice.manage']),
    );

    const view = await harness.service.catalogView(ACTOR, 'team-1');

    expect(view).toEqual({
      teamId: 'team-1',
      roles: [
        { slug: 'coach', displayName: 'Coach', description: 'Runs practices' },
        {
          slug: 'member',
          displayName: 'Member',
          description: 'Baseline team member',
        },
      ],
    });
  });

  it('never surfaces a platform-scoped role in the assignable catalog', async () => {
    harness.repository.listRoleCatalog.mockResolvedValue([
      ...CATALOG,
      { role_key: 'SUPER_ADMIN', permission_key: 'team.read' },
    ]);
    harness.ceiling.resolveActorPermissions.mockResolvedValue(
      new Set(['team.read', 'practice.manage']),
    );

    const view = await harness.service.catalogView(ACTOR, 'team-1');

    expect(view.roles.map(role => role.slug)).toEqual(['coach', 'member']);
  });

  it('projects an empty catalog for an actor with no permissions', async () => {
    harness.ceiling.resolveActorPermissions.mockResolvedValue(new Set());

    const view = await harness.service.catalogView(ACTOR, 'team-1');

    expect(view.roles).toEqual([]);
  });
});
