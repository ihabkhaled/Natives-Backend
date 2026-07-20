import { Injectable } from '@nestjs/common';

import type { UserAssignmentsView } from '../model/rbac.types';
import { RoleAssignmentQueryService } from './role-assignment-query.service';

/**
 * Inspection: lists a user's active role assignments. Guarded by a manage
 * permission at the controller. Delegates the read to the shared query service
 * so the module has exactly one owner of assignment reads.
 */
@Injectable()
export class ListUserAssignmentsUseCase {
  constructor(private readonly assignments: RoleAssignmentQueryService) {}

  async execute(userId: string): Promise<UserAssignmentsView> {
    return { userId, assignments: await this.assignments.listForUser(userId) };
  }
}
