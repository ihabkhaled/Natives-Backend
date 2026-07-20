import type { AuthUserIdentity } from '@core/auth';
import {
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { TeamRoleQueryService } from '@modules/rbac';
import { Inject, Injectable } from '@nestjs/common';

import type { MemberRolesView } from '../model/members.types';
import { MemberLookupService } from './member-lookup.service';

/**
 * Membership-scoped read of the roles a member holds in their team, plus the
 * roles the acting principal may set there. Resolves the membership inside the
 * caller's team scope first (a member addressed under the wrong team is simply
 * not found), then delegates the role vocabulary and the privilege ceiling to
 * the RBAC public surface. A membership with no linked account holds no roles.
 */
@Injectable()
export class MemberRolesService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    private readonly lookup: MemberLookupService,
    private readonly teamRoles: TeamRoleQueryService,
  ) {}

  async view(
    actor: AuthUserIdentity,
    teamId: string,
    membershipId: string,
  ): Promise<MemberRolesView> {
    const userId = await this.resolveUserId(teamId, membershipId);
    const view = await this.teamRoles.view(actor, userId, teamId);
    return {
      membershipId,
      roles: view.roles,
      assignableRoles: view.assignableRoles,
    };
  }

  resolveUserId(teamId: string, membershipId: string): Promise<string | null> {
    return this.unitOfWork.runInTransaction(async scope => {
      const membership = await this.lookup.requireMembership(
        scope,
        teamId,
        membershipId,
      );
      return membership.userId;
    });
  }
}
