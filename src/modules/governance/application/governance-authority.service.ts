import {
  type AuthUserIdentity,
  EFFECTIVE_PERMISSION_RESOLVER_PORT,
  type EffectivePermissionResolverPort,
} from '@core/auth';
import { Inject, Injectable } from '@nestjs/common';
import { Permission } from '@shared/enums';

import type { GovernanceViewer } from '../model/governance.types';

/**
 * Resolves the governance permission tiers of a caller within a team, server
 * side, from effective permissions — never inferred from a governance TITLE. A
 * title (Team Captain, Board Member, …) grants no authority here; only a real
 * RBAC grant does. `governance.manage` sees everything; board-visibility minutes
 * additionally need `discipline.read` (the board-confidential tier).
 */
@Injectable()
export class GovernanceAuthorityService {
  constructor(
    @Inject(EFFECTIVE_PERMISSION_RESOLVER_PORT)
    private readonly permissions: EffectivePermissionResolverPort,
  ) {}

  async viewerFor(
    actor: AuthUserIdentity,
    teamId: string,
  ): Promise<GovernanceViewer> {
    const granted = await this.permissions.resolve(actor, { teamId });
    return {
      canManage: granted.has(Permission.GovernanceManage),
      canReadBoard: granted.has(Permission.DisciplineRead),
    };
  }

  async canReviewDiscipline(
    actor: AuthUserIdentity,
    teamId: string,
  ): Promise<boolean> {
    const granted = await this.permissions.resolve(actor, { teamId });
    return granted.has(Permission.DisciplineManage);
  }
}
