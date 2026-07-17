import {
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { RbacRepository } from '../infrastructure/rbac.repository';
import type { UserAssignmentsView } from '../model/rbac.types';

/**
 * Inspection: lists a user's active role assignments. Guarded by a manage
 * permission at the controller. Deterministically ordered by the repository.
 */
@Injectable()
export class ListUserAssignmentsUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    private readonly repository: RbacRepository,
  ) {}

  async execute(userId: string): Promise<UserAssignmentsView> {
    const assignments = await this.unitOfWork.runInTransaction(scope =>
      this.repository.listActiveAssignmentsForUser(scope, userId),
    );
    return { userId, assignments };
  }
}
