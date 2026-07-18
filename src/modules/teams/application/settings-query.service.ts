import { CLOCK_PORT, type ClockPort } from '@core/clock/clock.port';
import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { buildSettingsSnapshot } from '../domain/effective-settings.policy';
import { SettingVersionRepository } from '../infrastructure/setting-version.repository';
import type { SettingKey } from '../model/teams.enums';
import type {
  ListSettingVersionsResult,
  PageRequest,
  SettingsSnapshot,
} from '../model/teams.types';

/**
 * Read side for versioned team settings: the deterministic effective snapshot
 * as-of an instant (defaulting to now), and a bounded page of a key's version
 * history. The snapshot resolves one in-effect version per key server-side.
 */
@Injectable()
export class SettingsQueryService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    private readonly settings: SettingVersionRepository,
  ) {}

  getSnapshot(teamId: string, asOf: string | null): Promise<SettingsSnapshot> {
    const effectiveAsOf = asOf === null ? this.clock.now() : new Date(asOf);
    return this.unitOfWork.runInTransaction(scope =>
      this.buildSnapshot(scope, teamId, effectiveAsOf),
    );
  }

  listVersions(
    teamId: string,
    settingKey: SettingKey,
    page: PageRequest,
  ): Promise<ListSettingVersionsResult> {
    return this.unitOfWork.runInTransaction(scope =>
      this.settings.listForKey(scope, teamId, settingKey, page),
    );
  }

  private async buildSnapshot(
    scope: TransactionScope,
    teamId: string,
    asOf: Date,
  ): Promise<SettingsSnapshot> {
    const effective = await this.settings.loadEffective(scope, teamId, asOf);
    return buildSettingsSnapshot(teamId, asOf, effective);
  }
}
