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

import { generateOccurrenceDates } from '../domain/recurrence.policy';
import { PracticeSessionRepository } from '../infrastructure/practice-session.repository';
import { resolveOccurrenceWindow } from '../lib/practices.helpers';
import {
  OCCURRENCE_SCAN_LIMIT,
  SESSION_RESOURCE_TYPE,
  SESSIONS_GENERATED_ACTION,
} from '../model/practices.constants';
import { ScheduleStatus, SessionStatus } from '../model/practices.enums';
import type {
  GenerationResult,
  NewSession,
  PracticeSchedule,
  PracticeSession,
  RecurrenceRule,
} from '../model/practices.types';
import { PracticeLookupService } from './practice-lookup.service';

/**
 * Idempotently materializes concrete sessions from a schedule's recurrence over
 * its bounded horizon. Only missing occurrences (by local date) are inserted;
 * existing stable instances are never rewritten — so recurrence edits, timezone
 * changes, exception edits, and duplicate retries converge to the same set. An
 * archived schedule generates nothing.
 */
@Injectable()
export class GenerateSessionsUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    private readonly lookup: PracticeLookupService,
    private readonly sessions: PracticeSessionRepository,
    private readonly audit: AuditRecorderService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    scheduleId: string,
  ): Promise<GenerationResult> {
    return this.unitOfWork.runInTransaction(scope =>
      this.run(scope, actor, teamId, scheduleId),
    );
  }

  private async run(
    scope: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    scheduleId: string,
  ): Promise<GenerationResult> {
    const schedule = await this.lookup.requireSchedule(
      scope,
      teamId,
      scheduleId,
    );
    if (schedule.status !== ScheduleStatus.Active) {
      return { created: 0, skipped: 0, sessions: [] };
    }
    return this.generate(scope, actor, schedule);
  }

  private async generate(
    scope: TransactionScope,
    actor: AuthUserIdentity,
    schedule: PracticeSchedule,
  ): Promise<GenerationResult> {
    const target = generateOccurrenceDates(this.buildRule(schedule));
    const existing = new Set(
      await this.sessions.listOccurrenceDates(
        scope,
        schedule.id,
        OCCURRENCE_SCAN_LIMIT,
      ),
    );
    const missing = target.filter(date => !existing.has(date));
    const created = await this.insertOccurrences(scope, schedule, missing);
    const skipped = target.length - created.length;
    await this.audit.record(
      scope,
      this.buildAudit(actor, schedule, created.length, skipped),
    );
    return { created: created.length, skipped, sessions: created };
  }

  private async insertOccurrences(
    scope: TransactionScope,
    schedule: PracticeSchedule,
    dates: readonly string[],
  ): Promise<PracticeSession[]> {
    const now = this.clock.now();
    const created: PracticeSession[] = [];
    for (const date of dates) {
      const inserted = await this.sessions.insertGenerated(
        scope,
        this.buildSession(schedule, date, now),
      );
      if (inserted !== null) {
        created.push(inserted);
      }
    }
    return created;
  }

  private buildRule(schedule: PracticeSchedule): RecurrenceRule {
    return {
      frequency: schedule.frequency,
      intervalWeeks: schedule.intervalWeeks,
      weekdays: schedule.weekdays,
      generationStart: schedule.generationStart,
      generationUntil: schedule.generationUntil,
      exceptions: schedule.exceptions,
    };
  }

  private buildSession(
    schedule: PracticeSchedule,
    occurrenceDate: string,
    now: Date,
  ): NewSession {
    const window = resolveOccurrenceWindow(
      occurrenceDate,
      schedule.startTimeLocal,
      schedule.durationMinutes,
      schedule.meetOffsetMinutes,
      schedule.rsvpCutoffMinutes,
      schedule.timezone,
    );
    return {
      id: this.idGenerator.generate(),
      teamId: schedule.teamId,
      seasonId: schedule.seasonId,
      scheduleId: schedule.id,
      occurrenceDate,
      sessionType: schedule.sessionType,
      timezone: schedule.timezone,
      venueId: schedule.defaultVenueId,
      field: schedule.defaultField,
      capacity: schedule.defaultCapacity,
      meetAt: window.meetAt,
      startsAt: window.startsAt,
      endsAt: window.endsAt,
      rsvpCutoffAt: window.rsvpCutoffAt,
      visibility: schedule.visibility,
      organizerUserId: schedule.organizerUserId,
      notes: schedule.notes,
      status: SessionStatus.Published,
      createdBy: schedule.createdBy,
      now,
    };
  }

  private buildAudit(
    actor: AuthUserIdentity,
    schedule: PracticeSchedule,
    created: number,
    skipped: number,
  ): AuditInput {
    return {
      actorUserId: actor.userId,
      action: SESSIONS_GENERATED_ACTION,
      resourceType: SESSION_RESOURCE_TYPE,
      resourceId: schedule.id,
      teamId: schedule.teamId,
      seasonId: schedule.seasonId,
      correlationId: null,
      outcome: AuditOutcome.Success,
      diff: { created, skipped },
    };
  }
}
