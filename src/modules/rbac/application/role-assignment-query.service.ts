import { CLOCK_PORT, type ClockPort } from '@core/clock/clock.port';
import {
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { assignmentIsLive } from '../domain/assignment-window.policy';
import { RbacRepository } from '../infrastructure/rbac.repository';
import type { RoleAssignment } from '../model/rbac.types';

/**
 * Public RBAC read surface for role assignments. `listForUser` returns every
 * unrevoked assignment (the admin inspection view); `listLiveForUser` narrows it
 * to the assignments actually in effect right now, which is what a principal or
 * a membership roles panel may claim to hold. Time comes from the clock port so
 * tests freeze it.
 */
@Injectable()
export class RoleAssignmentQueryService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    private readonly repository: RbacRepository,
  ) {}

  listForUser(userId: string): Promise<readonly RoleAssignment[]> {
    return this.unitOfWork.runInTransaction(scope =>
      this.repository.listActiveAssignmentsForUser(scope, userId),
    );
  }

  async listLiveForUser(userId: string): Promise<readonly RoleAssignment[]> {
    const assignments = await this.listForUser(userId);
    const now = this.clock.now();
    return assignments.filter(assignment => assignmentIsLive(assignment, now));
  }
}
