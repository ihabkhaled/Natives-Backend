import {
  type AuthUserIdentity,
  EFFECTIVE_PERMISSION_RESOLVER_PORT,
  type EffectivePermissionResolverPort,
} from '@core/auth';
import {
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';
import { Permission } from '@shared/enums';

import { MembershipRepository } from '../infrastructure/membership.repository';
import { MemberViewTier } from '../model/members.enums';
import type { MemberAccess, Membership } from '../model/members.types';

/**
 * Resolves a viewer's effective access to a specific member: the privacy tier
 * that shapes reads (admin > coach > teammate > public) and whether they may
 * manage the profile (own it, or hold member.lifecycle.manage in this team
 * scope). Permissions come from the core resolver port — the same source the
 * global guard uses — so field-level shaping honors real scoped grants.
 */
@Injectable()
export class MemberAccessService {
  constructor(
    @Inject(EFFECTIVE_PERMISSION_RESOLVER_PORT)
    private readonly resolver: EffectivePermissionResolverPort,
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    private readonly memberships: MembershipRepository,
  ) {}

  async resolveAccess(
    actor: AuthUserIdentity,
    teamId: string,
    membership: Membership,
  ): Promise<MemberAccess> {
    const permissions = await this.resolver.resolve(actor, { teamId });
    const tier = await this.resolveTier(actor, teamId, permissions);
    return {
      viewer: { tier, isSelf: this.isSelf(actor, membership) },
      canManage: permissions.has(Permission.MemberLifecycleManage),
    };
  }

  private async resolveTier(
    actor: AuthUserIdentity,
    teamId: string,
    permissions: ReadonlySet<string>,
  ): Promise<MemberViewTier> {
    if (permissions.has(Permission.MemberProfileReadAdmin)) {
      return MemberViewTier.Admin;
    }
    if (permissions.has(Permission.MemberProfileReadCoach)) {
      return MemberViewTier.Coach;
    }
    if (await this.isActiveTeamMember(actor, teamId)) {
      return MemberViewTier.Teammate;
    }
    return MemberViewTier.Public;
  }

  private isActiveTeamMember(
    actor: AuthUserIdentity,
    teamId: string,
  ): Promise<boolean> {
    return this.unitOfWork.runInTransaction(async scope => {
      const found = await this.memberships.findActiveByUser(
        scope,
        teamId,
        actor.userId,
      );
      return found !== null;
    });
  }

  private isSelf(actor: AuthUserIdentity, membership: Membership): boolean {
    return membership.userId !== null && membership.userId === actor.userId;
  }
}
