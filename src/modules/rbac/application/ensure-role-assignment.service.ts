import type { AuthUserIdentity } from '@core/auth';
import {
  ID_GENERATOR_PORT,
  type IdGeneratorPort,
} from '@core/id-generator/id-generator.port';
import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { isProtectedRole } from '../domain/role-protection.policy';
import { ProtectedRoleError } from '../errors/protected-role.error';
import { RoleNotFoundError } from '../errors/role-not-found.error';
import { RbacRepository } from '../infrastructure/rbac.repository';
import { toPermissionScope } from '../lib/rbac.helpers';
import { toOpenRoleKey } from '../lib/role-slug.mapper';
import { RBAC_ROLE_ASSIGNED_EVENT } from '../model/rbac.constants';
import type {
  EnsureTeamRoleCommand,
  NewRbacAuditEvent,
  NewRoleAssignment,
  RbacRoleRecord,
  RoleAssignment,
} from '../model/rbac.types';
import { PrivilegeCeilingService } from './privilege-ceiling.service';

/**
 * Public RBAC surface for workflow-granted team roles, inside the CALLER'S
 * transaction.
 *
 * `assertGrantable` is the actor-facing validation an inviting flow runs at
 * request time: open catalog lookup (404 for an unknown slug), the structural
 * protected-role rule (403 for platform-scoped/unassignable roles), and the
 * privilege ceiling against the acting principal (403 on escalation).
 *
 * `ensureTeamRole` is the workflow grant itself: find-then-write on the
 * assignment natural key (user+role+team, season NULL) so it is idempotent; a
 * fresh grant bumps the policy version (resolver caches invalidate) and appends
 * the standard role-assigned audit event. No privilege ceiling runs here — the
 * ceiling was enforced against the actor when the workflow was initiated — but
 * the protected-role rule still does, so a role deactivated or reclassified
 * between initiation and completion is refused rather than granted silently.
 */
@Injectable()
export class EnsureRoleAssignmentService {
  constructor(
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    private readonly repository: RbacRepository,
    private readonly ceiling: PrivilegeCeilingService,
  ) {}

  async assertGrantable(
    scope: TransactionScope,
    actor: AuthUserIdentity,
    roleSlug: string,
    teamId: string | null,
  ): Promise<RbacRoleRecord> {
    const role = await this.requireRole(scope, toOpenRoleKey(roleSlug));
    await this.ceiling.assertCanManageRole(
      scope,
      actor,
      role.id,
      toPermissionScope(teamId, null),
    );
    return role;
  }

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
    if (isProtectedRole(role)) {
      throw new ProtectedRoleError();
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
