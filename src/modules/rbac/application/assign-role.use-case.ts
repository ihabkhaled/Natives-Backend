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
import { ProtectedRoleError } from '../errors/protected-role.error';
import { RoleNotFoundError } from '../errors/role-not-found.error';
import { RbacRepository } from '../infrastructure/rbac.repository';
import { toPermissionScope } from '../lib/rbac.helpers';
import { RBAC_ROLE_ASSIGNED_EVENT } from '../model/rbac.constants';
import type {
  AssignRoleCommand,
  NewRbacAuditEvent,
  NewRoleAssignment,
  RbacRoleRecord,
  RoleAssignment,
} from '../model/rbac.types';
import { PrivilegeCeilingService } from './privilege-ceiling.service';

/**
 * Assigns a role bundle to a user within an optional team/season scope. Enforces
 * the privilege ceiling (the actor may only grant permissions they themselves
 * hold in that scope), bumps the policy version to invalidate resolver caches,
 * and appends an audit event — all in one transaction.
 */
@Injectable()
export class AssignRoleUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    private readonly repository: RbacRepository,
    private readonly ceiling: PrivilegeCeilingService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    command: AssignRoleCommand,
  ): Promise<RoleAssignment> {
    return this.unitOfWork.runInTransaction(scope =>
      this.run(scope, actor, command),
    );
  }

  private async run(
    scope: TransactionScope,
    actor: AuthUserIdentity,
    command: AssignRoleCommand,
  ): Promise<RoleAssignment> {
    const role = await this.repository.findRoleByKey(scope, command.roleKey);
    if (role === null) {
      throw new RoleNotFoundError();
    }
    // A team-scoped assignment can never carry a platform-scoped/unassignable
    // role; the platform promotion flow is the only path to those.
    if (command.teamId !== null && isProtectedRole(role)) {
      throw new ProtectedRoleError();
    }
    const target = toPermissionScope(command.teamId, command.seasonId);
    await this.ceiling.assertCanManageRole(scope, actor, role.id, target);
    const assignment = await this.repository.insertAssignment(
      scope,
      this.buildAssignment(command, role, actor),
    );
    await this.repository.bumpPolicyVersion(scope, this.clock.now());
    await this.repository.appendAuditEvent(
      scope,
      this.buildAudit(actor, command, assignment.id),
    );
    return assignment;
  }

  private buildAssignment(
    command: AssignRoleCommand,
    role: RbacRoleRecord,
    actor: AuthUserIdentity,
  ): NewRoleAssignment {
    return {
      id: this.idGenerator.generate(),
      userId: command.userId,
      roleId: role.id,
      roleKey: role.key,
      teamId: command.teamId,
      seasonId: command.seasonId,
      effectiveFrom: this.clock.now(),
      effectiveTo:
        command.effectiveTo === null ? null : new Date(command.effectiveTo),
      grantedBy: actor.userId,
    };
  }

  private buildAudit(
    actor: AuthUserIdentity,
    command: AssignRoleCommand,
    assignmentId: string,
  ): NewRbacAuditEvent {
    return {
      id: this.idGenerator.generate(),
      eventType: RBAC_ROLE_ASSIGNED_EVENT,
      actorUserId: actor.userId,
      context: {
        assignmentId,
        targetUserId: command.userId,
        roleKey: command.roleKey,
        teamId: command.teamId,
        seasonId: command.seasonId,
      },
      occurredAt: this.clock.now(),
    };
  }
}
