import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';
import { RbacRole } from '@shared/enums';

import { RbacRepository } from '../infrastructure/rbac.repository';
import { RBAC_SUPER_ADMIN_LIST_MAX } from '../model/rbac.constants';
import type { SuperAdminListView } from '../model/rbac.types';

/**
 * Bounded read of the current platform super administrators: every live global
 * SUPER_ADMIN assignment joined with its holder's identity, ordered by when the
 * authority became effective. Guarded by global `platform.admin` at the route.
 */
@Injectable()
export class ListSuperAdminsUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    private readonly repository: RbacRepository,
  ) {}

  execute(): Promise<SuperAdminListView> {
    return this.unitOfWork.runInTransaction(scope => this.load(scope));
  }

  private async load(scope: TransactionScope): Promise<SuperAdminListView> {
    const items = await this.repository.listActiveGlobalAssignments(
      scope,
      RbacRole.SuperAdmin,
      RBAC_SUPER_ADMIN_LIST_MAX,
    );
    const total = await this.repository.countActiveGlobalAssignments(
      scope,
      RbacRole.SuperAdmin,
    );
    return { items, total };
  }
}
