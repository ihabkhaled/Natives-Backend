import type { AuthUserIdentity } from '@core/auth';
import { CLOCK_PORT, type ClockPort } from '@core/clock/clock.port';
import {
  ID_GENERATOR_PORT,
  type IdGeneratorPort,
} from '@core/id-generator/id-generator.port';
import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { SettingVersionConflictError } from '../errors/setting-version-conflict.error';
import { SettingVersionRepository } from '../infrastructure/setting-version.repository';
import { TeamAuditRepository } from '../infrastructure/team-audit.repository';
import { SETTING_VERSION_CREATED_EVENT } from '../model/teams.constants';
import type {
  CreateSettingVersionCommand,
  NewAuditEvent,
  NewSettingVersion,
  SettingVersion,
} from '../model/teams.types';
import { TeamLookupService } from './team-lookup.service';

/**
 * Appends an effective-dated setting version for a team. Setting versions are
 * immutable and effective-unique: a second version at the same instant for the
 * same key is a conflict. Changing a setting means writing a new version at a
 * later effective instant; history stays interpretable across config changes.
 */
@Injectable()
export class CreateSettingVersionUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    private readonly teamLookup: TeamLookupService,
    private readonly settings: SettingVersionRepository,
    private readonly audit: TeamAuditRepository,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    command: CreateSettingVersionCommand,
  ): Promise<SettingVersion> {
    return this.unitOfWork.runInTransaction(scope =>
      this.run(scope, actor, teamId, command),
    );
  }

  private async run(
    scope: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    command: CreateSettingVersionCommand,
  ): Promise<SettingVersion> {
    await this.teamLookup.requireActive(scope, teamId);
    const effectiveFrom = new Date(command.effectiveFrom);
    if (
      await this.settings.existsAtInstant(
        scope,
        teamId,
        command.settingKey,
        effectiveFrom,
      )
    ) {
      throw new SettingVersionConflictError();
    }
    const now = this.clock.now();
    const version = await this.settings.insert(
      scope,
      this.buildVersion(teamId, command, effectiveFrom, actor, now),
    );
    await this.audit.append(scope, this.buildAudit(actor, version, now));
    return version;
  }

  private buildVersion(
    teamId: string,
    command: CreateSettingVersionCommand,
    effectiveFrom: Date,
    actor: AuthUserIdentity,
    now: Date,
  ): NewSettingVersion {
    return {
      id: this.idGenerator.generate(),
      teamId,
      settingKey: command.settingKey,
      effectiveFrom,
      value: command.value,
      note: command.note,
      createdBy: actor.userId,
      now,
    };
  }

  private buildAudit(
    actor: AuthUserIdentity,
    version: SettingVersion,
    now: Date,
  ): NewAuditEvent {
    return {
      id: this.idGenerator.generate(),
      eventType: SETTING_VERSION_CREATED_EVENT,
      actorUserId: actor.userId,
      context: {
        teamId: version.teamId,
        settingKey: version.settingKey,
        settingVersionId: version.id,
      },
      occurredAt: now,
    };
  }
}
