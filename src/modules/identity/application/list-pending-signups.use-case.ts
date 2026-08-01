import {
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { UserRepository } from '../infrastructure/user.repository';
import { toSignupRequestSummary } from '../lib/identity.mapper';
import { UserStatus } from '../model/identity.enums';
import type { PendingSignupList } from '../model/identity.types';

/**
 * Lists every self-signup still awaiting review, oldest first, for the admin
 * review queue. Read-only and credential-free — each row is projected to the
 * summary the admin UI renders.
 */
@Injectable()
export class ListPendingSignupsUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    private readonly users: UserRepository,
  ) {}

  async execute(): Promise<PendingSignupList> {
    const pending = await this.unitOfWork.runInTransaction(scope =>
      this.users.listByStatus(scope, UserStatus.Pending),
    );
    return { items: pending.map(user => toSignupRequestSummary(user)) };
  }
}
