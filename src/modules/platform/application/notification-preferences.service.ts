import type { AuthUserIdentity } from '@core/auth';
import { CLOCK_PORT, type ClockPort } from '@core/clock/clock.port';
import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { NotificationPreferenceRepository } from '../infrastructure/notification-preference.repository';
import type {
  PreferencesView,
  PreferenceUpdate,
} from '../model/platform.types';

/**
 * Read + update the caller's own notification preferences. Always keyed on the
 * authenticated principal's id. Absence of a row means enabled, so a preference
 * row is only written when a user explicitly changes a category/channel toggle.
 */
@Injectable()
export class NotificationPreferencesService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    private readonly preferences: NotificationPreferenceRepository,
  ) {}

  get(actor: AuthUserIdentity): Promise<PreferencesView> {
    return this.unitOfWork.runInTransaction(async scope => ({
      items: await this.preferences.listForUser(scope, actor.userId),
    }));
  }

  update(
    actor: AuthUserIdentity,
    update: PreferenceUpdate,
  ): Promise<PreferencesView> {
    return this.unitOfWork.runInTransaction(scope =>
      this.apply(scope, actor.userId, update),
    );
  }

  private async apply(
    scope: TransactionScope,
    userId: string,
    update: PreferenceUpdate,
  ): Promise<PreferencesView> {
    await this.preferences.upsert(
      scope,
      userId,
      { userId, ...update },
      this.clock.now(),
    );
    return { items: await this.preferences.listForUser(scope, userId) };
  }
}
