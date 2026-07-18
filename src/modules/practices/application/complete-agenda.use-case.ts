import type { AuthUserIdentity } from '@core/auth';
import { CLOCK_PORT, type ClockPort } from '@core/clock/clock.port';
import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import {
  AuditRecorderService,
  RecordDomainEventService,
} from '@modules/platform';
import { Inject, Injectable } from '@nestjs/common';

import { canComplete } from '../domain/agenda.state-machine';
import { InvalidAgendaTransitionError } from '../errors/invalid-agenda-transition.error';
import { OptimisticConflictError } from '../errors/optimistic-conflict.error';
import { PracticeAgendaRepository } from '../infrastructure/practice-agenda.repository';
import {
  buildAgendaAudit,
  buildAgendaEvent,
  buildAgendaLifecycleWrite,
} from '../lib/agendas.builders';
import { toAgendaSummaryView } from '../lib/agendas.mapper';
import {
  AGENDA_COMPLETED_ACTION,
  AGENDA_COMPLETED_EVENT,
} from '../model/agendas.constants';
import type {
  Agenda,
  AgendaSummaryView,
  AgendaVersionCommand,
} from '../model/agendas.types';
import { AgendaLookupService } from './agenda-lookup.service';

/**
 * Completes a session's agenda in post-session review: PUBLISHED → COMPLETED under
 * optimistic concurrency, validated by the pure state machine. In one transaction
 * it flips the state, writes an audit row, and enqueues a versioned
 * `practice.agenda.completed` event to the transactional outbox.
 */
@Injectable()
export class CompleteAgendaUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    private readonly lookup: AgendaLookupService,
    private readonly agendas: PracticeAgendaRepository,
    private readonly audit: AuditRecorderService,
    private readonly events: RecordDomainEventService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    sessionId: string,
    command: AgendaVersionCommand,
  ): Promise<AgendaSummaryView> {
    return this.unitOfWork.runInTransaction(scope =>
      this.run(scope, actor, teamId, sessionId, command),
    );
  }

  private async run(
    scope: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    sessionId: string,
    command: AgendaVersionCommand,
  ): Promise<AgendaSummaryView> {
    const agenda = await this.lookup.requireAgenda(scope, teamId, sessionId);
    if (!canComplete(agenda.status)) {
      throw new InvalidAgendaTransitionError();
    }
    const completed = await this.complete(scope, agenda, command, actor);
    return this.record(scope, actor, completed);
  }

  private async complete(
    scope: TransactionScope,
    agenda: Agenda,
    command: AgendaVersionCommand,
    actor: AuthUserIdentity,
  ): Promise<Agenda> {
    const completed = await this.agendas.complete(
      scope,
      buildAgendaLifecycleWrite(
        agenda.id,
        actor.userId,
        command.expectedVersion,
        this.clock.now(),
      ),
    );
    if (completed === null) {
      throw new OptimisticConflictError();
    }
    return completed;
  }

  private async record(
    scope: TransactionScope,
    actor: AuthUserIdentity,
    agenda: Agenda,
  ): Promise<AgendaSummaryView> {
    await this.audit.record(
      scope,
      buildAgendaAudit(AGENDA_COMPLETED_ACTION, agenda, actor.userId, {
        status: agenda.status,
      }),
    );
    await this.events.enqueue(
      scope,
      buildAgendaEvent(AGENDA_COMPLETED_EVENT, agenda, actor.userId, {
        sessionId: agenda.sessionId,
        status: agenda.status,
      }),
    );
    return toAgendaSummaryView(agenda);
  }
}
