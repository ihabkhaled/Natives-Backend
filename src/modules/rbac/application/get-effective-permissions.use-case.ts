import {
  type AuthUserIdentity,
  EFFECTIVE_PERMISSION_RESOLVER_PORT,
  type EffectivePermissionResolverPort,
  type PermissionScope,
} from '@core/auth';
import { Inject, Injectable } from '@nestjs/common';

import type { EffectivePermissionsView } from '../model/rbac.types';

/**
 * Current-principal contract: returns the caller's own effective permissions for
 * the active team/season scope, resolved server-side through the cached resolver.
 * No private data is exposed — only the permission keys the caller holds.
 */
@Injectable()
export class GetEffectivePermissionsUseCase {
  constructor(
    @Inject(EFFECTIVE_PERMISSION_RESOLVER_PORT)
    private readonly resolver: EffectivePermissionResolverPort,
  ) {}

  async execute(
    principal: AuthUserIdentity,
    scope: PermissionScope,
  ): Promise<EffectivePermissionsView> {
    const permissions = await this.resolver.resolve(principal, scope);
    return {
      userId: principal.userId,
      teamId: scope.teamId ?? null,
      seasonId: scope.seasonId ?? null,
      permissions: [...permissions].sort(),
    };
  }
}
