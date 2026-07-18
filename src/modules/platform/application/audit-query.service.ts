import {
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { AuditLogRepository } from '../infrastructure/audit-log.repository';
import type {
  AuditEntry,
  PagedResult,
  PageRequest,
} from '../model/platform.types';

/**
 * Read side for the append-only audit ledger, scoped to a team. Guarded by
 * `audit.read` at the route and by the team scope in the guard, so an actor only
 * sees audit within a team they administer. Bounded and deterministically ordered.
 */
@Injectable()
export class AuditQueryService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    private readonly repository: AuditLogRepository,
  ) {}

  listForTeam(
    teamId: string,
    page: PageRequest,
  ): Promise<PagedResult<AuditEntry>> {
    return this.unitOfWork.runInTransaction(scope =>
      this.repository.listByTeam(scope, teamId, page),
    );
  }
}
