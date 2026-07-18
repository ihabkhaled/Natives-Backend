import type { AuthUserIdentity } from '@core/auth';
import { Permission, Role } from '@shared/enums';
import { describe, expect, it, vi } from 'vitest';

import { GetEffectivePermissionsUseCase } from './get-effective-permissions.use-case';

const PRINCIPAL: AuthUserIdentity = {
  userId: 'user-1',
  email: 'user@example.com',
  roles: [Role.User],
};

describe('GetEffectivePermissionsUseCase', () => {
  it('returns sorted permissions and the resolved scope', async () => {
    const resolver = {
      resolve: vi
        .fn()
        .mockResolvedValue(
          new Set<string>([Permission.TeamRead, Permission.MatchScore]),
        ),
    };
    const useCase = new GetEffectivePermissionsUseCase(resolver);

    const result = await useCase.execute(PRINCIPAL, { teamId: 'team-1' });

    expect(result).toEqual({
      userId: 'user-1',
      teamId: 'team-1',
      seasonId: null,
      permissions: [Permission.MatchScore, Permission.TeamRead].sort(),
    });
    expect(resolver.resolve).toHaveBeenCalledWith(PRINCIPAL, {
      teamId: 'team-1',
    });
  });

  it('reports null scope dimensions when unscoped', async () => {
    const resolver = { resolve: vi.fn().mockResolvedValue(new Set<string>()) };
    const useCase = new GetEffectivePermissionsUseCase(resolver);

    const result = await useCase.execute(PRINCIPAL, {});

    expect(result.teamId).toBeNull();
    expect(result.seasonId).toBeNull();
    expect(result.permissions).toEqual([]);
  });
});
