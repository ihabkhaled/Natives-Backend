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

import { SettingVersionNotCancellableError } from '../errors/setting-version-not-cancellable.error';
import { SettingVersionNotFoundError } from '../errors/setting-version-not-found.error';
import { SettingVersionRepository } from '../infrastructure/setting-version.repository';
import { TeamAuditRepository } from '../infrastructure/team-audit.repository';
import { SETTING_VERSION_CANCELLED_EVENT } from '../model/teams.constants';
import type { NewAuditEvent, SettingVersion } from '../model/teams.types';
import { TeamLookupService } from './team-lookup.service';

/**
 * Cancels a FUTURE-effective setting version (P2, D7). A never-in-effect row is
 * not history, so deleting it does not rewrite the past; versions already (or
 * ever) in effect are immutable and refuse cancellation with a conflict. The
 * cancellation is audited with the actor and the cancelled instant.
 */
@Injectable()
export class CancelSettingVersionUseCase {
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
    versionId: string,
  ): Promise<void> {
    return this.unitOfWork.runInTransaction(scope =>
      this.run(scope, actor, teamId, versionId),
    );
  }

  private async run(
    scope: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    versionId: string,
  ): Promise<void> {
    await this.teamLookup.requireActive(scope, teamId);
    const version = await this.settings.findById(scope, teamId, versionId);
    if (version === null) {
      throw new SettingVersionNotFoundError();
    }
    const now = this.clock.now();
    if (version.effectiveFrom.getTime() <= now.getTime()) {
      throw new SettingVersionNotCancellableError();
    }
    await this.settings.deleteById(scope, teamId, versionId);
    await this.audit.append(scope, this.buildAudit(actor, version, now));
  }

  private buildAudit(
    actor: AuthUserIdentity,
    version: SettingVersion,
    now: Date,
  ): NewAuditEvent {
    return {
      id: this.idGenerator.generate(),
      eventType: SETTING_VERSION_CANCELLED_EVENT,
      actorUserId: actor.userId,
      context: {
        teamId: version.teamId,
        settingKey: version.settingKey,
        settingVersionId: version.id,
        effectiveFrom: version.effectiveFrom.toISOString(),
      },
      occurredAt: now,
    };
  }
}
