import {
  type MembershipContext,
  MembershipContextService,
  MembershipStatus,
} from '@modules/members';
import { Injectable } from '@nestjs/common';

import { DashboardTeamForbiddenError } from '../errors/dashboard-team-forbidden.error';
import type { DashboardScope } from '../model/dashboard.types';

/**
 * Resolves which team the summary is computed for, always from the caller's own
 * memberships. When the request names a team the caller has no membership in,
 * the read is refused — that ownership check also stops a globally-privileged
 * principal from reading another team's dashboard. A caller with no memberships
 * at all resolves to null, and the summary comes back with no team-scoped
 * widgets rather than an error.
 */
@Injectable()
export class DashboardScopeService {
  constructor(private readonly memberships: MembershipContextService) {}

  async resolve(
    userId: string,
    requestedTeamId: string | null,
  ): Promise<DashboardScope | null> {
    const contexts = await this.memberships.listForUser(userId);
    const chosen = this.choose(contexts, requestedTeamId);
    if (chosen !== undefined) {
      return {
        teamId: chosen.teamId,
        seasonId: chosen.seasonId,
        membershipId: chosen.membershipId,
      };
    }
    if (requestedTeamId !== null) {
      throw new DashboardTeamForbiddenError();
    }
    return null;
  }

  private choose(
    contexts: readonly MembershipContext[],
    requestedTeamId: string | null,
  ): MembershipContext | undefined {
    const active = contexts.filter(
      context => context.status === MembershipStatus.Active,
    );
    if (requestedTeamId === null) {
      return active[0];
    }
    return active.find(context => context.teamId === requestedTeamId);
  }
}
