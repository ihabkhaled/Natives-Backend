import {
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { MembershipRepository } from '../infrastructure/membership.repository';
import type { ListMembersResult, PageRequest } from '../model/members.types';

/**
 * Read side for the team member directory: a bounded, deterministically ordered,
 * name-sorted page of coarse directory rows (no private fields). Guarded by
 * member.list at the route; every row is safe for any lister to see.
 */
@Injectable()
export class MemberDirectoryService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    private readonly memberships: MembershipRepository,
  ) {}

  listMembers(teamId: string, page: PageRequest): Promise<ListMembersResult> {
    return this.unitOfWork.runInTransaction(scope =>
      this.memberships.listDirectory(scope, teamId, page),
    );
  }
}
