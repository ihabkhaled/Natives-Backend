import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RoleMatrixQueryService } from './role-matrix-query.service';

function build() {
  const scope = { run: vi.fn() };
  const unitOfWork = {
    runInTransaction: vi.fn(async (op: (s: typeof scope) => Promise<unknown>) =>
      op(scope),
    ),
  };
  const repository = {
    currentPolicyVersion: vi.fn().mockResolvedValue(4),
    listPermissionCatalog: vi
      .fn()
      .mockResolvedValue([
        { key: 'team.read', area: 'team', description: 'View a team' },
      ]),
    listRoleDefinitions: vi.fn().mockResolvedValue([
      {
        key: 'MEMBER',
        display_name: 'Member',
        description: 'Baseline member',
        is_system: true,
      },
    ]),
    listRoleCatalog: vi
      .fn()
      .mockResolvedValue([{ role_key: 'MEMBER', permission_key: 'team.read' }]),
  };
  const service = new RoleMatrixQueryService(
    unitOfWork as never,
    repository as never,
  );
  return { repository, scope, service, unitOfWork };
}

describe('RoleMatrixQueryService', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('reads the catalog, the bundles and the policy version in one transaction', async () => {
    const view = await harness.service.execute();

    expect(harness.unitOfWork.runInTransaction).toHaveBeenCalledTimes(1);
    expect(harness.repository.listPermissionCatalog).toHaveBeenCalledWith(
      harness.scope,
    );
    expect(harness.repository.listRoleDefinitions).toHaveBeenCalledWith(
      harness.scope,
    );
    expect(harness.repository.listRoleCatalog).toHaveBeenCalledWith(
      harness.scope,
    );
    expect(view).toEqual({
      policyVersion: 4,
      permissions: [
        { key: 'team.read', area: 'team', description: 'View a team' },
      ],
      roles: [
        {
          key: 'MEMBER',
          displayName: 'Member',
          description: 'Baseline member',
          isSystem: true,
          permissions: ['team.read'],
        },
      ],
    });
  });
});
