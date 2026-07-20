import type { AuthUserIdentity } from '@core/auth';
import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { selectAssignableRoles } from '../domain/privilege-ceiling.policy';
import { RbacRepository } from '../infrastructure/rbac.repository';
import { toPermissionScope } from '../lib/rbac.helpers';
import { toRoleBundles } from '../lib/role-catalog.mapper';
import { toRoleSlug } from '../lib/role-slug.mapper';
import type { TeamRolesView } from '../model/rbac.types';
import { PrivilegeCeilingService } from './privilege-ceiling.service';

/**
 * Public RBAC read surface for team-scoped role management: the role slugs a
 * user holds inside one team, plus the slugs the acting principal may set there
 * under the privilege ceiling. Two bounded reads in one transaction — no N+1 and
 * no per-role round trip.
 */
@Injectable()
export class TeamRoleQueryService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    private readonly repository: RbacRepository,
    private readonly ceiling: PrivilegeCeilingService,
  ) {}

  view(
    actor: AuthUserIdentity,
    userId: string | null,
    teamId: string,
  ): Promise<TeamRolesView> {
    return this.unitOfWork.runInTransaction(scope =>
      this.read(scope, actor, userId, teamId),
    );
  }

  private async read(
    scope: TransactionScope,
    actor: AuthUserIdentity,
    userId: string | null,
    teamId: string,
  ): Promise<TeamRolesView> {
    const held =
      userId === null ? [] : await this.heldRoles(scope, userId, teamId);
    return {
      roles: held,
      assignableRoles: await this.assignableRoles(scope, actor, teamId),
    };
  }

  private async assignableRoles(
    scope: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
  ): Promise<readonly string[]> {
    const permissions = await this.ceiling.resolveActorPermissions(
      scope,
      actor,
      toPermissionScope(teamId, null),
    );
    const catalog = await this.repository.listRoleCatalog(scope);
    const keys = selectAssignableRoles(toRoleBundles(catalog), permissions);
    return keys.map(key => toRoleSlug(key)).sort();
  }

  private async heldRoles(
    scope: TransactionScope,
    userId: string,
    teamId: string,
  ): Promise<readonly string[]> {
    const assignments = await this.repository.listActiveTeamAssignments(
      scope,
      userId,
      teamId,
    );
    return [...new Set(assignments.map(a => toRoleSlug(a.roleKey)))].sort();
  }
}
