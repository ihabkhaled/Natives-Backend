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
import {
  type AuditInput,
  AuditOutcome,
  AuditRecorderService,
} from '@modules/platform';
import { Inject, Injectable } from '@nestjs/common';

import { InvalidScheduleError } from '../errors/invalid-schedule.error';
import { PracticeScheduleRepository } from '../infrastructure/practice-schedule.repository';
import { isValidScheduleCommand } from '../lib/practices.helpers';
import {
  DEFAULT_INTERVAL_WEEKS,
  DEFAULT_TIMEZONE,
  SCHEDULE_CREATED_ACTION,
  SCHEDULE_RESOURCE_TYPE,
} from '../model/practices.constants';
import { SessionVisibility } from '../model/practices.enums';
import type {
  CreateScheduleCommand,
  NewSchedule,
  PracticeSchedule,
} from '../model/practices.types';
import { ScopeValidationService } from './scope-validation.service';

/**
 * Creates a recurring (or one-off) practice schedule template within a team.
 * Validates the target scope (active team, in-team season/venue) and the
 * recurrence/horizon, then persists the template and an audit row in one
 * transaction. Generation of sessions is a separate, explicit, idempotent step.
 */
@Injectable()
export class CreatePracticeScheduleUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    private readonly scopeValidation: ScopeValidationService,
    private readonly schedules: PracticeScheduleRepository,
    private readonly audit: AuditRecorderService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    command: CreateScheduleCommand,
  ): Promise<PracticeSchedule> {
    return this.unitOfWork.runInTransaction(scope =>
      this.run(scope, actor, teamId, command),
    );
  }

  private async run(
    scope: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    command: CreateScheduleCommand,
  ): Promise<PracticeSchedule> {
    if (!isValidScheduleCommand(command)) {
      throw new InvalidScheduleError();
    }
    await this.scopeValidation.validate(
      scope,
      teamId,
      command.seasonId,
      command.defaultVenueId,
    );
    const now = this.clock.now();
    const schedule = await this.schedules.insert(
      scope,
      this.buildSchedule(teamId, command, actor, now),
    );
    await this.audit.record(scope, this.buildAudit(actor, schedule));
    return schedule;
  }

  private buildSchedule(
    teamId: string,
    command: CreateScheduleCommand,
    actor: AuthUserIdentity,
    now: Date,
  ): NewSchedule {
    return {
      id: this.idGenerator.generate(),
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
      createdBy: actor.userId,
      now,
    };
  }

  private buildAudit(
    actor: AuthUserIdentity,
    schedule: PracticeSchedule,
  ): AuditInput {
    return {
      actorUserId: actor.userId,
      action: SCHEDULE_CREATED_ACTION,
      resourceType: SCHEDULE_RESOURCE_TYPE,
      resourceId: schedule.id,
      teamId: schedule.teamId,
      seasonId: schedule.seasonId,
      correlationId: null,
      outcome: AuditOutcome.Success,
      diff: {
        name: schedule.name,
        frequency: schedule.frequency,
        sessionType: schedule.sessionType,
      },
    };
  }
}
