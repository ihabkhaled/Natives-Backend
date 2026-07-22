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
import { RbacRole } from '@shared/enums';

import { RoleNotFoundError } from '../errors/role-not-found.error';
import { UserNotEligibleError } from '../errors/user-not-eligible.error';
import { RbacRepository } from '../infrastructure/rbac.repository';
import { RBAC_SUPER_ADMIN_PROMOTED_EVENT } from '../model/rbac.constants';
import type {
  NewRbacAuditEvent,
  PromoteSuperAdminCommand,
  RbacRoleRecord,
  SuperAdminEntry,
} from '../model/rbac.types';

/**
 * Grants the global SUPER_ADMIN role to an active user through the separately
 * protected platform flow (global `platform.admin` guard — an existing super
 * admin only). Idempotent: promoting a user who already holds the live global
 * assignment returns it unchanged, minting no duplicate. A fresh grant bumps
 * the policy version and appends the promotion audit event carrying the
 * mandatory reason — actor, target, reason, all in one transaction.
 */
@Injectable()
export class PromoteSuperAdminUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    private readonly repository: RbacRepository,
  ) {}

  execute(
    actor: AuthUserIdentity,
    command: PromoteSuperAdminCommand,
  ): Promise<SuperAdminEntry> {
    return this.unitOfWork.runInTransaction(scope =>
      this.run(scope, actor, command),
    );
  }

  private async run(
    scope: TransactionScope,
    actor: AuthUserIdentity,
    command: PromoteSuperAdminCommand,
  ): Promise<SuperAdminEntry> {
    if (!(await this.repository.isUserActive(scope, command.userId))) {
      throw new UserNotEligibleError();
    }
    const existing = await this.repository.findActiveGlobalAssignmentEntry(
      scope,
      command.userId,
      RbacRole.SuperAdmin,
    );
    if (existing !== null) {
      return existing;
    }
    return this.grant(scope, actor, command);
  }

  private async grant(
    scope: TransactionScope,
    actor: AuthUserIdentity,
    command: PromoteSuperAdminCommand,
  ): Promise<SuperAdminEntry> {
    const role = await this.requireSuperAdminRole(scope);
    const assignment = await this.repository.insertAssignment(scope, {
      id: this.idGenerator.generate(),
      userId: command.userId,
      roleId: role.id,
      roleKey: role.key,
      teamId: null,
      seasonId: null,
      effectiveFrom: this.clock.now(),
      effectiveTo: null,
      grantedBy: actor.userId,
    });
    await this.repository.bumpPolicyVersion(scope, this.clock.now());
    await this.repository.appendAuditEvent(
      scope,
      this.buildAudit(actor, command, assignment.id),
    );
    return this.requireEntry(scope, command.userId);
  }

  private async requireSuperAdminRole(
    scope: TransactionScope,
  ): Promise<RbacRoleRecord> {
    const role = await this.repository.findRoleByKey(
      scope,
      RbacRole.SuperAdmin,
    );
    if (role === null) {
      throw new RoleNotFoundError();
    }
    return role;
  }

  private async requireEntry(
    scope: TransactionScope,
    userId: string,
  ): Promise<SuperAdminEntry> {
    const entry = await this.repository.findActiveGlobalAssignmentEntry(
      scope,
      userId,
      RbacRole.SuperAdmin,
    );
    if (entry === null) {
      throw new UserNotEligibleError();
    }
    return entry;
  }

  private buildAudit(
    actor: AuthUserIdentity,
    command: PromoteSuperAdminCommand,
    assignmentId: string,
  ): NewRbacAuditEvent {
    return {
      id: this.idGenerator.generate(),
      eventType: RBAC_SUPER_ADMIN_PROMOTED_EVENT,
      actorUserId: actor.userId,
      context: {
        assignmentId,
        targetUserId: command.userId,
        reason: command.reason,
        grantedBy: actor.userId,
      },
      occurredAt: this.clock.now(),
    };
  }
}
