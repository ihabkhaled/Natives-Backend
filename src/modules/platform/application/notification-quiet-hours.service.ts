import type { AuthUserIdentity } from '@core/auth';
import { CLOCK_PORT, type ClockPort } from '@core/clock/clock.port';
import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { isDeliveryAllowed } from '../domain/notification-quiet-hours.policy';
import { NotificationQuietHoursError } from '../errors/notification-quiet-hours.error';
import { NotificationQuietHoursRepository } from '../infrastructure/notification-quiet-hours.repository';
import {
  DEFAULT_QUIET_HOURS_END,
  DEFAULT_QUIET_HOURS_START,
  DEFAULT_QUIET_HOURS_TIMEZONE,
  DEFAULT_URGENT_CANCELLATION_OVERRIDE,
} from '../model/platform.constants';
import type {
  NotificationQuietHours,
  QuietHoursUpdate,
} from '../model/platform.types';

@Injectable()
export class NotificationQuietHoursService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    private readonly quietHours: NotificationQuietHoursRepository,
  ) {}

  get(actor: AuthUserIdentity): Promise<NotificationQuietHours> {
    return this.unitOfWork.runInTransaction(scope =>
      this.resolve(scope, actor.userId),
    );
  }

  update(
    actor: AuthUserIdentity,
    update: QuietHoursUpdate,
  ): Promise<NotificationQuietHours> {
    return this.unitOfWork.runInTransaction(scope =>
      this.apply(scope, actor.userId, update),
    );
  }

  isAllowed(
    userId: string,
    now: Date,
    urgentCancellation: boolean,
  ): Promise<boolean> {
    return this.unitOfWork.runInTransaction(async scope =>
      isDeliveryAllowed(
        now,
        await this.resolve(scope, userId),
        urgentCancellation,
      ),
    );
  }

  private async apply(
    scope: TransactionScope,
    userId: string,
    update: QuietHoursUpdate,
  ): Promise<NotificationQuietHours> {
    if (!this.isTimezone(update.timezone)) {
      throw new NotificationQuietHoursError();
    }
    const value = { userId, ...update };
    await this.quietHours.upsert(scope, value, this.clock.now());
    return (await this.quietHours.findForUser(scope, userId)) ?? value;
  }

  private async resolve(
    scope: TransactionScope,
    userId: string,
  ): Promise<NotificationQuietHours> {
    return (
      (await this.quietHours.findForUser(scope, userId)) ?? {
        userId,
        timezone: DEFAULT_QUIET_HOURS_TIMEZONE,
        startsLocal: DEFAULT_QUIET_HOURS_START,
        endsLocal: DEFAULT_QUIET_HOURS_END,
        urgentCancellationOverride: DEFAULT_URGENT_CANCELLATION_OVERRIDE,
      }
    );
  }

  private isTimezone(value: string): boolean {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: value }).format();
      return true;
    } catch {
      return false;
    }
  }
}
