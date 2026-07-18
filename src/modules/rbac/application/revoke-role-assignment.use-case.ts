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

import { AssignmentNotFoundError } from '../errors/assignment-not-found.error';
import { RbacRepository } from '../infrastructure/rbac.repository';
import { toPermissionScope } from '../lib/rbac.helpers';
import { RBAC_ROLE_REVOKED_EVENT } from '../model/rbac.constants';
import type { NewRbacAuditEvent, RoleAssignment } from '../model/rbac.types';
import { PrivilegeCeilingService } from './privilege-ceiling.service';

/**
 * Revokes an active role assignment (soft-revoke via revoked_at). Re-checks the
 * privilege ceiling against the assignment's own scope so a lower-privileged
 * actor cannot revoke a role they could not themselves grant, bumps the policy
 * version, and audits — all in one transaction.
 */
@Injectable()
export class RevokeRoleAssignmentUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    private readonly repository: RbacRepository,
    private readonly ceiling: PrivilegeCeilingService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    assignmentId: string,
  ): Promise<RoleAssignment> {
    return this.unitOfWork.runInTransaction(scope =>
      this.run(scope, actor, assignmentId),
    );
  }

  private async run(
    scope: TransactionScope,
    actor: AuthUserIdentity,
    assignmentId: string,
  ): Promise<RoleAssignment> {
    const existing = await this.repository.findActiveAssignmentById(
      scope,
      assignmentId,
    );
    if (existing === null) {
      throw new AssignmentNotFoundError();
    }
    const target = toPermissionScope(existing.teamId, existing.seasonId);
    await this.ceiling.assertCanManageRole(
      scope,
      actor,
      existing.roleId,
      target,
    );
    await this.repository.revokeAssignment(
      scope,
      assignmentId,
      this.clock.now(),
    );
    await this.repository.bumpPolicyVersion(scope, this.clock.now());
    await this.repository.appendAuditEvent(
      scope,
      this.buildAudit(actor, existing),
    );
    return { ...existing, revokedAt: this.clock.now() };
  }

  private buildAudit(
    actor: AuthUserIdentity,
    assignment: RoleAssignment,
  ): NewRbacAuditEvent {
    return {
      id: this.idGenerator.generate(),
      eventType: RBAC_ROLE_REVOKED_EVENT,
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
  }
}
