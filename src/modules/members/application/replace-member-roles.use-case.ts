import type { AuthUserIdentity } from '@core/auth';
import { ReplaceTeamRolesUseCase } from '@modules/rbac';
import { Injectable } from '@nestjs/common';

import { MemberAccountRequiredError } from '../errors/member-account-required.error';
import type { MemberRolesView } from '../model/members.types';
import { MemberRolesService } from './member-roles.service';

/**
 * Replaces the role set a member holds in their team. Resolves the membership
 * inside the caller's team scope, requires a linked account (roles are granted
 * to accounts), then hands the reconciliation to the RBAC module, which owns the
 * transaction, the privilege ceiling, the policy-version bump, and the audit
 * trail. This module never writes role rows itself.
 */
@Injectable()
export class ReplaceMemberRolesUseCase {
  constructor(
    private readonly roles: MemberRolesService,
    private readonly replaceTeamRoles: ReplaceTeamRolesUseCase,
  ) {}

  async execute(
    actor: AuthUserIdentity,
    teamId: string,
    membershipId: string,
    roleSlugs: readonly string[],
  ): Promise<MemberRolesView> {
    const userId = await this.roles.resolveUserId(teamId, membershipId);
    if (userId === null) {
      throw new MemberAccountRequiredError();
    }
    await this.replaceTeamRoles.execute(actor, {
      userId,
      teamId,
      roleKeys: roleSlugs,
    });
    return this.roles.view(actor, teamId, membershipId);
  }
}
