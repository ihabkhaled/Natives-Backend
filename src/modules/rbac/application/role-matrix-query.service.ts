import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { RbacRepository } from '../infrastructure/rbac.repository';
import { toRoleMatrixView } from '../lib/role-matrix.mapper';
import type { RoleMatrixView } from '../model/rbac.types';

/**
 * Read side for the role x permission matrix: the whole seeded catalog joined
 * with every role bundle, straight from `roles` / `permissions` /
 * `role_permissions` — the seeded source of truth — never from the compiled
 * catalog constant, so what an administrator sees is what the resolver enforces.
 *
 * Every read is bounded and deterministically ordered, and the four reads run
 * sequentially inside one transaction scope (never Promise.all) so the matrix
 * and the policy version it is stamped with are a consistent snapshot.
 */
@Injectable()
export class RoleMatrixQueryService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    private readonly repository: RbacRepository,
  ) {}

  execute(): Promise<RoleMatrixView> {
    return this.unitOfWork.runInTransaction(scope => this.load(scope));
  }

  private async load(scope: TransactionScope): Promise<RoleMatrixView> {
    const policyVersion = await this.repository.currentPolicyVersion(scope);
    const permissions = await this.repository.listPermissionCatalog(scope);
    const roles = await this.repository.listRoleDefinitions(scope);
    const bundles = await this.repository.listRoleCatalog(scope);
    return toRoleMatrixView(policyVersion, permissions, roles, bundles);
  }
}
