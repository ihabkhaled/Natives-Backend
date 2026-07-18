import type { AuthUserIdentity } from '@core/auth';
import {
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { NotificationRepository } from '../infrastructure/notification.repository';
import { toNotificationView } from '../lib/platform.mapper';
import type {
  NotificationView,
  PagedResult,
  PageRequest,
} from '../model/platform.types';

/**
 * Read side for the caller's own in-app inbox: a bounded, newest-first page of
 * notifications with the internal dedupe key stripped. Always scoped to the
 * authenticated principal's id (never a client-supplied user id).
 */
@Injectable()
export class ListNotificationsService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    private readonly notifications: NotificationRepository,
  ) {}

  async list(
    actor: AuthUserIdentity,
    page: PageRequest,
  ): Promise<PagedResult<NotificationView>> {
    const result = await this.unitOfWork.runInTransaction(scope =>
      this.notifications.listForUser(scope, actor.userId, page),
    );
    return {
      ...result,
      items: result.items.map(item => toNotificationView(item)),
    };
  }
}
