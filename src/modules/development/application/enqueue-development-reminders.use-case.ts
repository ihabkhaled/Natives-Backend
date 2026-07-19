import { CLOCK_PORT, type ClockPort } from '@core/clock/clock.port';
import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { RecordDomainEventService } from '@modules/platform';
import { Inject, Injectable } from '@nestjs/common';

import { CoachFeedbackRepository } from '../infrastructure/coach-feedback.repository';
import { DevelopmentGoalRepository } from '../infrastructure/development-goal.repository';
import { buildFeedbackReminderEvent } from '../lib/feedback.builders';
import { buildGoalOverdueReminderEvent } from '../lib/goal.builders';
import type { ReminderResult } from '../model/development.types';
import { DevelopmentScopeService } from './development-scope.service';

/**
 * Scans the team for unacknowledged shared feedback and overdue active goals and
 * enqueues one privacy-safe reminder event per finding (identifiers only — never
 * a coach note, field text, or goal free-text). Bounded by the reminder scan cap.
 * The whole scan and enqueue run in a single transaction with the outbox.
 */
@Injectable()
export class EnqueueDevelopmentRemindersUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    private readonly scope: DevelopmentScopeService,
    private readonly feedback: CoachFeedbackRepository,
    private readonly goals: DevelopmentGoalRepository,
    private readonly events: RecordDomainEventService,
  ) {}

  execute(teamId: string): Promise<ReminderResult> {
    return this.unitOfWork.runInTransaction(tx => this.run(tx, teamId));
  }

  private async run(
    tx: TransactionScope,
    teamId: string,
  ): Promise<ReminderResult> {
    await this.scope.validate(tx, teamId, null);
    const feedbackReminders = await this.remindFeedback(tx, teamId);
    const goalReminders = await this.remindGoals(tx, teamId);
    return { feedbackReminders, goalReminders };
  }

  private async remindFeedback(
    tx: TransactionScope,
    teamId: string,
  ): Promise<number> {
    const rows = await this.feedback.listReminders(tx, teamId);
    for (const row of rows) {
      await this.events.enqueue(tx, buildFeedbackReminderEvent(row));
    }
    return rows.length;
  }

  private async remindGoals(
    tx: TransactionScope,
    teamId: string,
  ): Promise<number> {
    const today = this.clock.now().toISOString().slice(0, 10);
    const rows = await this.goals.listOverdue(tx, teamId, today);
    for (const row of rows) {
      await this.events.enqueue(tx, buildGoalOverdueReminderEvent(row));
    }
    return rows.length;
  }
}
