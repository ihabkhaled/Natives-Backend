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

import { assertNotLastSuperAdmin } from '../domain/super-admin-guard.policy';
import { AssignmentNotFoundError } from '../errors/assignment-not-found.error';
import { RbacRepository } from '../infrastructure/rbac.repository';
import { RBAC_SUPER_ADMIN_REVOKED_EVENT } from '../model/rbac.constants';
import type { NewRbacAuditEvent, SuperAdminEntry } from '../model/rbac.types';

/**
 * Revokes a user's global SUPER_ADMIN assignment through the platform flow.
 * The last-administrator safeguard runs on the live count read inside the same
 * transaction, so removal of the final super admin — self-demotion included —
 * is a 409 and never a lockout. Bumps the policy version and appends the
 * revocation audit event carrying the mandatory reason.
 */
@Injectable()
export class RevokeSuperAdminUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    private readonly repository: RbacRepository,
  ) {}

  execute(
    actor: AuthUserIdentity,
    userId: string,
    reason: string,
  ): Promise<SuperAdminEntry> {
    return this.unitOfWork.runInTransaction(scope =>
      this.run(scope, actor, userId, reason),
    );
  }

  private async run(
    scope: TransactionScope,
    actor: AuthUserIdentity,
    userId: string,
    reason: string,
  ): Promise<SuperAdminEntry> {
    const entry = await this.repository.findActiveGlobalAssignmentEntry(
      scope,
      userId,
      RbacRole.SuperAdmin,
    );
    if (entry === null) {
      throw new AssignmentNotFoundError();
    }
    const activeCount = await this.repository.countActiveGlobalAssignments(
      scope,
      RbacRole.SuperAdmin,
    );
    assertNotLastSuperAdmin(activeCount);
    await this.revoke(scope, actor, entry, reason);
    return entry;
  }

  private async revoke(
    scope: TransactionScope,
    actor: AuthUserIdentity,
    entry: SuperAdminEntry,
    reason: string,
  ): Promise<void> {
    await this.repository.revokeAssignment(
      scope,
      entry.assignmentId,
      this.clock.now(),
    );
    await this.repository.bumpPolicyVersion(scope, this.clock.now());
    await this.repository.appendAuditEvent(
      scope,
      this.buildAudit(actor, entry, reason),
    );
  }

  private buildAudit(
    actor: AuthUserIdentity,
    entry: SuperAdminEntry,
    reason: string,
  ): NewRbacAuditEvent {
    return {
      id: this.idGenerator.generate(),
      eventType: RBAC_SUPER_ADMIN_REVOKED_EVENT,
      actorUserId: actor.userId,
      context: {
        assignmentId: entry.assignmentId,
        targetUserId: entry.userId,
        reason,
        revokedBy: actor.userId,
      },
      occurredAt: this.clock.now(),
    };
  }
}
