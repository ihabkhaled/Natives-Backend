import type { AuthUserIdentity } from '@core/auth';
import { CLOCK_PORT, type ClockPort } from '@core/clock/clock.port';
import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import {
  type AuditInput,
  AuditOutcome,
  AuditRecorderService,
} from '@modules/platform';
import { Inject, Injectable } from '@nestjs/common';

import { InvalidScheduleError } from '../errors/invalid-schedule.error';
import { OptimisticConflictError } from '../errors/optimistic-conflict.error';
import { PracticeScheduleRepository } from '../infrastructure/practice-schedule.repository';
import { isValidScheduleCommand } from '../lib/practices.helpers';
import {
  DEFAULT_INTERVAL_WEEKS,
  DEFAULT_TIMEZONE,
  SCHEDULE_RESOURCE_TYPE,
  SCHEDULE_UPDATED_ACTION,
} from '../model/practices.constants';
import { SessionVisibility } from '../model/practices.enums';
import type {
  PracticeSchedule,
  ScheduleUpdate,
  UpdateScheduleCommand,
} from '../model/practices.types';
import { PracticeLookupService } from './practice-lookup.service';
import { ScopeValidationService } from './scope-validation.service';

/**
 * Updates a schedule template under optimistic concurrency. Editing a template
 * never rewrites already-generated sessions (those are stable instances);
 * changes only affect sessions produced by a subsequent generation run. Missing
 * or cross-team schedules resolve to not-found; a stale version raises a conflict.
 */
@Injectable()
export class UpdatePracticeScheduleUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    private readonly lookup: PracticeLookupService,
    private readonly scopeValidation: ScopeValidationService,
    private readonly schedules: PracticeScheduleRepository,
    private readonly audit: AuditRecorderService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    scheduleId: string,
    command: UpdateScheduleCommand,
  ): Promise<PracticeSchedule> {
    return this.unitOfWork.runInTransaction(scope =>
      this.run(scope, actor, teamId, scheduleId, command),
    );
  }

  private async run(
    scope: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    scheduleId: string,
    command: UpdateScheduleCommand,
  ): Promise<PracticeSchedule> {
    const existing = await this.lookup.requireSchedule(
      scope,
      teamId,
      scheduleId,
    );
    if (existing.version !== command.expectedVersion) {
      throw new OptimisticConflictError();
    }
    if (!isValidScheduleCommand(command)) {
      throw new InvalidScheduleError();
    }
    await this.scopeValidation.validateReferences(
      scope,
      teamId,
      command.seasonId,
      command.defaultVenueId,
    );
    return this.applyUpdate(scope, actor, teamId, scheduleId, command);
  }

  private async applyUpdate(
    scope: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    scheduleId: string,
    command: UpdateScheduleCommand,
  ): Promise<PracticeSchedule> {
    const updated = await this.schedules.update(
      scope,
      this.buildUpdate(teamId, scheduleId, command, actor),
    );
    if (updated === null) {
      throw new OptimisticConflictError();
    }
    await this.audit.record(scope, this.buildAudit(actor, updated));
    return updated;
  }

  private buildUpdate(
    teamId: string,
    scheduleId: string,
    command: UpdateScheduleCommand,
    actor: AuthUserIdentity,
  ): ScheduleUpdate {
    return {
      id: scheduleId,
      teamId,
      seasonId: command.seasonId,
      name: command.name,
      sessionType: command.sessionType,
      timezone: command.timezone ?? DEFAULT_TIMEZONE,
      frequency: command.frequency,
      intervalWeeks: command.intervalWeeks ?? DEFAULT_INTERVAL_WEEKS,
      weekdays: command.weekdays,
      startTimeLocal: command.startTimeLocal,
      durationMinutes: command.durationMinutes,
      meetOffsetMinutes: command.meetOffsetMinutes,
      rsvpCutoffMinutes: command.rsvpCutoffMinutes,
      defaultVenueId: command.defaultVenueId,
      defaultField: command.defaultField,
      defaultCapacity: command.defaultCapacity,
      visibility: command.visibility ?? SessionVisibility.Team,
      organizerUserId: command.organizerUserId,
      notes: command.notes,
      generationStart: command.generationStart,
      generationUntil: command.generationUntil,
      exceptions: command.exceptions,
      status: command.status,
      updatedBy: actor.userId,
      expectedVersion: command.expectedVersion,
      now: this.clock.now(),
    };
  }

  private buildAudit(
    actor: AuthUserIdentity,
    schedule: PracticeSchedule,
  ): AuditInput {
    return {
      actorUserId: actor.userId,
      action: SCHEDULE_UPDATED_ACTION,
      resourceType: SCHEDULE_RESOURCE_TYPE,
      resourceId: schedule.id,
      teamId: schedule.teamId,
      seasonId: schedule.seasonId,
      correlationId: null,
      outcome: AuditOutcome.Success,
      diff: { version: schedule.version, name: schedule.name },
    };
  }
}
