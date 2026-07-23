import { CLOCK_PORT, type ClockPort } from '@core/clock/clock.port';
import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { buildSettingsSnapshot } from '../domain/effective-settings.policy';
import {
  classifyEffectiveVersion,
  classifySettingVersion,
} from '../domain/setting-value.policy';
import { SettingVersionRepository } from '../infrastructure/setting-version.repository';
import type { SettingKey } from '../model/teams.enums';
import type {
  ListClassifiedSettingVersionsResult,
  PageRequest,
  SettingsSnapshot,
} from '../model/teams.types';

/**
 * Read side for versioned team settings: the deterministic effective snapshot
 * as-of an instant (defaulting to now), and a bounded page of a key's version
 * history. Every value is classified on read (P2, D4): version rows carry
 * `valueState` (raw document still visible for the legacy replace flow) and the
 * snapshot never serves a legacy value as effective.
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
  ): Promise<ListClassifiedSettingVersionsResult> {
    return this.unitOfWork.runInTransaction(scope =>
      this.listClassified(scope, teamId, settingKey, page),
    );
  }

  private async listClassified(
    scope: TransactionScope,
    teamId: string,
    settingKey: SettingKey,
    page: PageRequest,
  ): Promise<ListClassifiedSettingVersionsResult> {
    const result = await this.settings.listForKey(
      scope,
      teamId,
      settingKey,
      page,
    );
    return {
      ...result,
      items: result.items.map(version => classifySettingVersion(version)),
    };
  }

  private async buildSnapshot(
    scope: TransactionScope,
    teamId: string,
    asOf: Date,
  ): Promise<SettingsSnapshot> {
    const effective = await this.settings.loadEffective(scope, teamId, asOf);
    return buildSettingsSnapshot(
      teamId,
      asOf,
      effective.map(version => classifyEffectiveVersion(version)),
    );
  }
}
