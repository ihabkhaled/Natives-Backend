import {
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { StaffAssignmentRepository } from '../infrastructure/staff-assignment.repository';
import type {
  ListStaffAssignmentsResult,
  PageRequest,
} from '../model/teams.types';

/** Read side for the admin staff-assignment list: a bounded page per team. */
@Injectable()
export class StaffAssignmentQueryService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    private readonly staff: StaffAssignmentRepository,
  ) {}

  list(teamId: string, page: PageRequest): Promise<ListStaffAssignmentsResult> {
    return this.unitOfWork.runInTransaction(scope =>
      this.staff.listByTeam(scope, teamId, page),
    );
  }
}
