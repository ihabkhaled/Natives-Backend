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

import { PracticeScheduleRepository } from '../infrastructure/practice-schedule.repository';
import {
  SCHEDULE_ARCHIVED_ACTION,
  SCHEDULE_RESOURCE_TYPE,
} from '../model/practices.constants';
import type { PracticeSchedule } from '../model/practices.types';
import { PracticeLookupService } from './practice-lookup.service';

/**
 * Archives (soft-retires) a schedule template so it produces no further sessions.
 * Already-generated sessions are untouched — cancellation/retirement of the
 * template never deletes historical occurrences. Archival is idempotent: a
 * schedule already archived is returned unchanged. Missing/cross-team resolves to
 * not-found.
 */
@Injectable()
export class ArchivePracticeScheduleUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    private readonly lookup: PracticeLookupService,
    private readonly schedules: PracticeScheduleRepository,
    private readonly audit: AuditRecorderService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    scheduleId: string,
  ): Promise<PracticeSchedule> {
    return this.unitOfWork.runInTransaction(scope =>
      this.run(scope, actor, teamId, scheduleId),
    );
  }

  private async run(
    scope: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    scheduleId: string,
  ): Promise<PracticeSchedule> {
    const existing = await this.lookup.requireSchedule(
      scope,
      teamId,
      scheduleId,
    );
    const archived = await this.schedules.archive(
      scope,
      teamId,
      scheduleId,
      actor.userId,
      this.clock.now(),
    );
    const result = archived ?? existing;
    await this.audit.record(scope, this.buildAudit(actor, result));
    return result;
  }

  private buildAudit(
    actor: AuthUserIdentity,
    schedule: PracticeSchedule,
  ): AuditInput {
    return {
      actorUserId: actor.userId,
      action: SCHEDULE_ARCHIVED_ACTION,
      resourceType: SCHEDULE_RESOURCE_TYPE,
      resourceId: schedule.id,
      teamId: schedule.teamId,
      seasonId: schedule.seasonId,
      correlationId: null,
      outcome: AuditOutcome.Success,
      diff: { status: schedule.status },
    };
  }
}
