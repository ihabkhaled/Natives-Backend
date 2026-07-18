import type { AuthUserIdentity } from '@core/auth';
import { CLOCK_PORT, type ClockPort } from '@core/clock/clock.port';
import {
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { NotificationNotFoundError } from '../errors/notification-not-found.error';
import { NotificationRepository } from '../infrastructure/notification.repository';
import { toNotificationView } from '../lib/platform.mapper';
import type { NotificationView } from '../model/platform.types';

/**
 * Marks one of the caller's own notifications as read. Idempotent (re-marking
 * keeps the first read instant) and ownership-scoped: a notification the caller
 * does not own is indistinguishable from a missing one (404), never leaked.
 */
@Injectable()
export class MarkNotificationReadService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    private readonly notifications: NotificationRepository,
  ) {}

  async markRead(
    actor: AuthUserIdentity,
    notificationId: string,
  ): Promise<NotificationView> {
    const updated = await this.unitOfWork.runInTransaction(scope =>
      this.notifications.markRead(
        scope,
        actor.userId,
        notificationId,
        this.clock.now(),
      ),
    );
    if (updated === null) {
      throw new NotificationNotFoundError();
    }
    return toNotificationView(updated);
  }
}
