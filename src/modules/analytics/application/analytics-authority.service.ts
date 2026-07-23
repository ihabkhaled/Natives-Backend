import {
  type AuthUserIdentity,
  EFFECTIVE_PERMISSION_RESOLVER_PORT,
  type EffectivePermissionResolverPort,
} from '@core/auth';
import { Inject, Injectable } from '@nestjs/common';
import { Permission } from '@shared/enums';

import type { AnalyticsReadTiers } from '../model/analytics.types';

/**
 * Resolves the caller's analytics read tiers within a team, server side, from
 * effective permissions (B3). `analytics.read.team` reads any subject;
 * `analytics.read.self` reads exactly the caller's own membership series. The
 * tiers are resolved once per request — never inferred from a client-supplied
 * role or the request body.
 */
@Injectable()
export class AnalyticsAuthorityService {
  constructor(
    @Inject(EFFECTIVE_PERMISSION_RESOLVER_PORT)
    private readonly permissions: EffectivePermissionResolverPort,
  ) {}

  async readTiersFor(
    actor: AuthUserIdentity,
    teamId: string,
  ): Promise<AnalyticsReadTiers> {
    const granted = await this.permissions.resolve(actor, { teamId });
    return {
      canReadTeam: granted.has(Permission.AnalyticsReadTeam),
      canReadSelf: granted.has(Permission.AnalyticsReadSelf),
    };
  }
}
