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

import {
  collectRosterCrossReferenceIssues,
  collectWeightsCrossReferenceIssues,
} from '../domain/setting-cross-references.policy';
import {
  isAttendanceWeightsValue,
  isRosterLimitsValue,
  validateAttendanceStatusesValue,
  validateSettingValue,
} from '../domain/setting-value.policy';
import { SettingEffectiveInvalidError } from '../errors/setting-effective-invalid.error';
import { SettingEffectiveInPastError } from '../errors/setting-effective-past.error';
import { SettingValueInvalidError } from '../errors/setting-value-invalid.error';
import { SettingVersionConflictError } from '../errors/setting-version-conflict.error';
import { SettingVersionStaleError } from '../errors/setting-version-stale.error';
import { CatalogRepository } from '../infrastructure/catalog.repository';
import { SettingVersionRepository } from '../infrastructure/setting-version.repository';
import { TeamAuditRepository } from '../infrastructure/team-audit.repository';
import { parseStrictUtcInstant } from '../lib/teams.helpers';
import { SettingValueState } from '../model/setting-values.enums';
import type {
  AttendanceStatusesValue,
  TypedSettingValue,
} from '../model/setting-values.types';
import {
  SETTING_EFFECTIVE_GRACE_MS,
  SETTING_VERSION_CREATED_EVENT,
} from '../model/teams.constants';
import { CatalogName, SettingKey } from '../model/teams.enums';
import type {
  ClassifiedSettingVersion,
  CreateSettingVersionCommand,
  NewAuditEvent,
  NewSettingVersion,
  SettingVersion,
} from '../model/teams.types';
import { TeamLookupService } from './team-lookup.service';

/**
 * Appends an effective-dated setting version for a team. P2 hardening: the
 * effective instant must be strict UTC and never in the past (D5), the value
 * must satisfy its per-key domain contract (D1) plus cross-setting references
 * (D3), the reason is mandatory (D6), and an optional head guard rejects
 * concurrent double-scheduling (D8). The persisted document is the policy's
 * normalized output, never the raw request body.
 */
@Injectable()
export class CreateSettingVersionUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    private readonly teamLookup: TeamLookupService,
    private readonly settings: SettingVersionRepository,
    private readonly catalog: CatalogRepository,
    private readonly audit: TeamAuditRepository,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    command: CreateSettingVersionCommand,
  ): Promise<ClassifiedSettingVersion> {
    return this.unitOfWork.runInTransaction(scope =>
      this.run(scope, actor, teamId, command),
    );
  }

  private async run(
    scope: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    command: CreateSettingVersionCommand,
  ): Promise<ClassifiedSettingVersion> {
    await this.teamLookup.requireActive(scope, teamId);
    const effectiveFrom = this.parseEffectiveFrom(command.effectiveFrom);
    const value = this.parseValue(command);
    await this.checkCrossReferences(
      scope,
      teamId,
      command.settingKey,
      value,
      effectiveFrom,
    );
    await this.checkHeadGuard(scope, teamId, command);
    await this.checkInstantFree(scope, teamId, command, effectiveFrom);
    const now = this.clock.now();
    const version = await this.settings.insert(
      scope,
      this.buildVersion(teamId, command, effectiveFrom, value, actor, now),
    );
    await this.audit.append(scope, this.buildAudit(actor, version, now));
    return { ...version, valueState: SettingValueState.Valid };
  }

  private parseEffectiveFrom(raw: string): Date {
    const parsed = parseStrictUtcInstant(raw);
    if (parsed === null) {
      throw new SettingEffectiveInvalidError();
    }
    const earliest = this.clock.now().getTime() - SETTING_EFFECTIVE_GRACE_MS;
    if (parsed.getTime() < earliest) {
      throw new SettingEffectiveInPastError();
    }
    return parsed;
  }

  private parseValue(command: CreateSettingVersionCommand): TypedSettingValue {
    const result = validateSettingValue(command.settingKey, command.value);
    if (!result.ok) {
      throw new SettingValueInvalidError(result.issues);
    }
    return result.value;
  }

  private async checkCrossReferences(
    scope: TransactionScope,
    teamId: string,
    key: SettingKey,
    value: TypedSettingValue,
    effectiveFrom: Date,
  ): Promise<void> {
    if (isAttendanceWeightsValue(key, value)) {
      const statuses = await this.loadStatusesAt(scope, teamId, effectiveFrom);
      const issues = collectWeightsCrossReferenceIssues(value, statuses);
      if (issues.length > 0) {
        throw new SettingValueInvalidError(issues);
      }
    }
    if (isRosterLimitsValue(key, value) && value.perPosition !== undefined) {
      const activeKeys = await this.catalog.listActiveKeys(
        scope,
        teamId,
        CatalogName.Position,
      );
      const issues = collectRosterCrossReferenceIssues(value, activeKeys);
      if (issues.length > 0) {
        throw new SettingValueInvalidError(issues);
      }
    }
  }

  private async loadStatusesAt(
    scope: TransactionScope,
    teamId: string,
    instant: Date,
  ): Promise<AttendanceStatusesValue | null> {
    const version = await this.settings.findEffectiveForKey(
      scope,
      teamId,
      SettingKey.AttendanceStatuses,
      instant,
    );
    if (version === null) {
      return null;
    }
    const parsed = validateAttendanceStatusesValue(version.value);
    return parsed.ok ? parsed.value : null;
  }

  private async checkHeadGuard(
    scope: TransactionScope,
    teamId: string,
    command: CreateSettingVersionCommand,
  ): Promise<void> {
    if (command.expectedHeadVersionId === undefined) {
      return;
    }
    const head = await this.settings.findHead(
      scope,
      teamId,
      command.settingKey,
    );
    const headId = head === null ? null : head.id;
    if (headId !== command.expectedHeadVersionId) {
      throw new SettingVersionStaleError();
    }
  }

  private async checkInstantFree(
    scope: TransactionScope,
    teamId: string,
    command: CreateSettingVersionCommand,
    effectiveFrom: Date,
  ): Promise<void> {
    const taken = await this.settings.existsAtInstant(
      scope,
      teamId,
      command.settingKey,
      effectiveFrom,
    );
    if (taken) {
      throw new SettingVersionConflictError();
    }
  }

  private buildVersion(
    teamId: string,
    command: CreateSettingVersionCommand,
    effectiveFrom: Date,
    value: TypedSettingValue,
    actor: AuthUserIdentity,
    now: Date,
  ): NewSettingVersion {
    return {
      id: this.idGenerator.generate(),
      teamId,
      settingKey: command.settingKey,
      effectiveFrom,
      value,
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
