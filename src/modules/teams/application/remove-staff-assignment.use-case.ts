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

import { StaffAssignmentNotFoundError } from '../errors/staff-assignment-not-found.error';
import { StaffAssignmentRepository } from '../infrastructure/staff-assignment.repository';
import { TeamAuditRepository } from '../infrastructure/team-audit.repository';
import { STAFF_ASSIGNMENT_REMOVED_EVENT } from '../model/teams.constants';
import type { NewAuditEvent, StaffAssignment } from '../model/teams.types';
import { TeamLookupService } from './team-lookup.service';

/**
 * Removes (soft-archives) a staff-title assignment. The assignment row is
 * never deleted — `status` moves to 'removed' so the "who held what title
 * when" history stays queryable.
 */
@Injectable()
export class RemoveStaffAssignmentUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    private readonly teamLookup: TeamLookupService,
    private readonly staff: StaffAssignmentRepository,
    private readonly audit: TeamAuditRepository,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    assignmentId: string,
  ): Promise<StaffAssignment> {
    return this.unitOfWork.runInTransaction(scope =>
      this.run(scope, actor, teamId, assignmentId),
    );
  }

  private async run(
    scope: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    assignmentId: string,
  ): Promise<StaffAssignment> {
    await this.teamLookup.requireActive(scope, teamId);
    const now = this.clock.now();
    const removed = await this.staff.remove(scope, {
      id: assignmentId,
      teamId,
      updatedBy: actor.userId,
      now,
    });
    if (removed === null) {
      throw new StaffAssignmentNotFoundError();
    }
    await this.audit.append(scope, this.buildAudit(actor, removed, now));
    return removed;
  }

  private buildAudit(
    actor: AuthUserIdentity,
    assignment: StaffAssignment,
    now: Date,
  ): NewAuditEvent {
    return {
      id: this.idGenerator.generate(),
      eventType: STAFF_ASSIGNMENT_REMOVED_EVENT,
      actorUserId: actor.userId,
      context: {
        teamId: assignment.teamId,
        membershipId: assignment.membershipId,
        titleEntryId: assignment.titleEntryId,
        assignmentId: assignment.id,
      },
      occurredAt: now,
    };
  }
}
