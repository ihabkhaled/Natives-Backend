import {
  ID_GENERATOR_PORT,
  type IdGeneratorPort,
} from '@core/id-generator/id-generator.port';
import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { RoleNotFoundError } from '../errors/role-not-found.error';
import { RbacRepository } from '../infrastructure/rbac.repository';
import { RBAC_ROLE_ASSIGNED_EVENT } from '../model/rbac.constants';
import type {
  EnsureTeamRoleCommand,
  NewRbacAuditEvent,
  NewRoleAssignment,
  RbacRoleRecord,
  RoleAssignment,
} from '../model/rbac.types';

/**
 * Public RBAC surface for system-granted roles: ensure a user holds one role
 * bundle within a team scope, inside the CALLER'S transaction. Find-then-write
 * on the assignment natural key (user+role+team, season NULL) so it is
 * idempotent; a fresh grant bumps the policy version (resolver caches
 * invalidate) and appends the standard role-assigned audit event. No privilege
 * ceiling runs here — the grant is a workflow effect (invitation acceptance
 * granting the default MEMBER role), not an actor-initiated escalation, and the
 * role key comes from code, never from client input.
 */
@Injectable()
export class EnsureRoleAssignmentService {
  constructor(
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    private readonly repository: RbacRepository,
  ) {}

  async ensureTeamRole(
    scope: TransactionScope,
    command: EnsureTeamRoleCommand,
  ): Promise<void> {
    const role = await this.requireRole(scope, command.roleKey);
    const existing = await this.repository.findActiveAssignmentByScope(
      scope,
      command.userId,
      role.id,
      command.teamId,
      null,
    );
    if (existing !== null) {
      return;
    }
    await this.grant(scope, role, command);
  }

  private async grant(
    scope: TransactionScope,
    role: RbacRoleRecord,
    command: EnsureTeamRoleCommand,
  ): Promise<void> {
    const assignment = await this.repository.insertAssignment(
      scope,
      this.buildAssignment(role, command),
    );
    await this.repository.bumpPolicyVersion(scope, command.now);
    await this.repository.appendAuditEvent(
      scope,
      this.buildAudit(assignment, command),
    );
  }

  private buildAssignment(
    role: RbacRoleRecord,
    command: EnsureTeamRoleCommand,
  ): NewRoleAssignment {
    return {
      id: this.idGenerator.generate(),
      userId: command.userId,
      roleId: role.id,
      roleKey: role.key,
      teamId: command.teamId,
      seasonId: null,
      effectiveFrom: command.now,
      effectiveTo: null,
      grantedBy: command.grantedBy,
    };
  }

  private async requireRole(
    scope: TransactionScope,
    roleKey: string,
  ): Promise<RbacRoleRecord> {
    const role = await this.repository.findRoleByKey(scope, roleKey);
    if (role === null) {
      throw new RoleNotFoundError();
    }
    return role;
  }

  private buildAudit(
    assignment: RoleAssignment,
    command: EnsureTeamRoleCommand,
  ): NewRbacAuditEvent {
    return {
      id: this.idGenerator.generate(),
      eventType: RBAC_ROLE_ASSIGNED_EVENT,
      actorUserId: command.grantedBy,
      context: {
        assignmentId: assignment.id,
        targetUserId: assignment.userId,
        roleKey: assignment.roleKey,
        teamId: assignment.teamId,
        seasonId: assignment.seasonId,
      },
      occurredAt: command.now,
    };
  }
}
