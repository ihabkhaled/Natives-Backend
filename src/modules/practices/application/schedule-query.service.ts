import {
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { PracticeScheduleRepository } from '../infrastructure/practice-schedule.repository';
import type {
  ListSchedulesResult,
  PageRequest,
  PracticeSchedule,
} from '../model/practices.types';
import { PracticeLookupService } from './practice-lookup.service';

/**
 * Read side for practice schedules: a bounded, deterministically ordered page of
 * a team's templates, or a single template resolved within team scope (not-found
 * when missing/cross-team). Team scope comes from the route param the guard
 * enforces.
 */
@Injectable()
export class ScheduleQueryService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    private readonly schedules: PracticeScheduleRepository,
    private readonly lookup: PracticeLookupService,
  ) {}

  listSchedules(
    teamId: string,
    page: PageRequest,
  ): Promise<ListSchedulesResult> {
    return this.unitOfWork.runInTransaction(scope =>
      this.schedules.list(scope, teamId, page),
    );
  }

  getSchedule(teamId: string, scheduleId: string): Promise<PracticeSchedule> {
    return this.unitOfWork.runInTransaction(scope =>
      this.lookup.requireSchedule(scope, teamId, scheduleId),
    );
  }
}
