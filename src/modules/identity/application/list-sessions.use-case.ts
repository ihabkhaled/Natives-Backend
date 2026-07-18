import { CLOCK_PORT, type ClockPort } from '@core/clock/clock.port';
import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { RefreshSessionRepository } from '../infrastructure/refresh-session.repository';
import { toDeviceSessionList } from '../lib/identity.mapper';
import type {
  DeviceSessionList,
  SessionListQuery,
} from '../model/identity.types';

@Injectable()
export class ListSessionsUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    private readonly sessions: RefreshSessionRepository,
  ) {}

  execute(
    userId: string,
    currentSessionId: string | undefined,
    query: SessionListQuery,
  ): Promise<DeviceSessionList> {
    return this.unitOfWork.runInTransaction(scope =>
      this.run(scope, userId, currentSessionId, query),
    );
  }

  private async run(
    scope: TransactionScope,
    userId: string,
    currentSessionId: string | undefined,
    query: SessionListQuery,
  ): Promise<DeviceSessionList> {
    const page = await this.sessions.listActiveForUser(
      scope,
      userId,
      this.clock.now(),
      query,
    );
    return toDeviceSessionList(page, currentSessionId, query);
  }
}
