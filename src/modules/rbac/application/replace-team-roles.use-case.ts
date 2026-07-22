import type { AuthUserIdentity } from '@core/auth';
import { CLOCK_PORT, type ClockPort } from '@core/clock/clock.port';
import {
  ID_GENERATOR_PORT,
  type IdGeneratorPort,
} from '@core/id-generator/id-generator.port';
import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { isProtectedRole } from '../domain/role-protection.policy';
import { diffTeamRoles } from '../domain/role-set-diff.policy';
import { ProtectedRoleError } from '../errors/protected-role.error';
import { RoleNotFoundError } from '../errors/role-not-found.error';
import { RbacRepository } from '../infrastructure/rbac.repository';
import { toPermissionScope } from '../lib/rbac.helpers';
import { toRoleKey } from '../lib/role-slug.mapper';
import {
  RBAC_ROLE_ASSIGNED_EVENT,
  RBAC_ROLE_REVOKED_EVENT,
} from '../model/rbac.constants';
import type {
  NewRbacAuditEvent,
  ReplaceTeamRolesCommand,
  RoleAssignment,
} from '../model/rbac.types';
import { PrivilegeCeilingService } from './privilege-ceiling.service';

/**
 * Replaces a user's team-scoped role assignments with the requested set inside
 * one transaction. Every role added and every role removed is checked against
 * the actor's privilege ceiling first, so an actor can neither hand out nor take
 * away a capability they do not themselves hold in that team. Roles the user
 * already holds are left untouched (their grant history is preserved). Bumps the
 * policy version once so resolver caches invalidate, and audits each change.
 */
@Injectable()
export class ReplaceTeamRolesUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    private readonly repository: RbacRepository,
    private readonly ceiling: PrivilegeCeilingService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    command: ReplaceTeamRolesCommand,
  ): Promise<readonly string[]> {
    return this.unitOfWork.runInTransaction(scope =>
      this.run(scope, actor, command),
    );
  }

  private async run(
    scope: TransactionScope,
    actor: AuthUserIdentity,
    command: ReplaceTeamRolesCommand,
  ): Promise<readonly string[]> {
    const requested = this.toRoleKeys(command.roleKeys);
    const current = await this.repository.listActiveTeamAssignments(
      scope,
      command.userId,
      command.teamId,
    );
    const diff = diffTeamRoles(current, requested);
    await this.grantAll(scope, actor, command, diff.toGrant);
    await this.revokeAll(scope, actor, diff.toRevoke, command.teamId);
    await this.repository.bumpPolicyVersion(scope, this.clock.now());
    return requested;
  }

  private toRoleKeys(slugs: readonly string[]): readonly string[] {
    return slugs.map(slug => {
      const key = toRoleKey(slug);
      if (key === null) {
        throw new RoleNotFoundError();
      }
      return key;
    });
  }

  private async grantAll(
    scope: TransactionScope,
    actor: AuthUserIdentity,
    command: ReplaceTeamRolesCommand,
    roleKeys: readonly string[],
  ): Promise<void> {
    for (const roleKey of roleKeys) {
      const role = await this.repository.findRoleByKey(scope, roleKey);
      if (role === null) {
        throw new RoleNotFoundError();
      }
      if (isProtectedRole(role)) {
        throw new ProtectedRoleError();
      }
      await this.assertCeiling(scope, actor, role.id, command.teamId);
      const assignment = await this.repository.insertAssignment(scope, {
        id: this.idGenerator.generate(),
        userId: command.userId,
        roleId: role.id,
        roleKey: role.key,
        teamId: command.teamId,
        seasonId: null,
        effectiveFrom: this.clock.now(),
        effectiveTo: null,
        grantedBy: actor.userId,
      });
      await this.audit(scope, actor, assignment, RBAC_ROLE_ASSIGNED_EVENT);
    }
  }

  private async revokeAll(
    scope: TransactionScope,
    actor: AuthUserIdentity,
    assignments: readonly RoleAssignment[],
    teamId: string,
  ): Promise<void> {
    for (const assignment of assignments) {
      await this.assertCeiling(scope, actor, assignment.roleId, teamId);
      await this.repository.revokeAssignment(
        scope,
        assignment.id,
        this.clock.now(),
      );
      await this.audit(scope, actor, assignment, RBAC_ROLE_REVOKED_EVENT);
    }
  }

  private assertCeiling(
    scope: TransactionScope,
    actor: AuthUserIdentity,
    roleId: string,
    teamId: string,
  ): Promise<void> {
    return this.ceiling.assertCanManageRole(
      scope,
      actor,
      roleId,
      toPermissionScope(teamId, null),
    );
  }

  private audit(
    scope: TransactionScope,
    actor: AuthUserIdentity,
    assignment: RoleAssignment,
    eventType: string,
  ): Promise<void> {
    const event: NewRbacAuditEvent = {
      id: this.idGenerator.generate(),
      eventType,
      actorUserId: actor.userId,
      context: {
        assignmentId: assignment.id,
        targetUserId: assignment.userId,
        roleKey: assignment.roleKey,
        teamId: assignment.teamId,
        seasonId: assignment.seasonId,
      },
      occurredAt: this.clock.now(),
    };
    return this.repository.appendAuditEvent(scope, event);
  }
}
